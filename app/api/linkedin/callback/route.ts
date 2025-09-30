import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

// In-memory lock to prevent race conditions when webhook is called multiple times
const processingLocks = new Map<string, Promise<any>>()

// LinkedIn connection callback with workspace isolation - Unipile hosted auth webhook
export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseAdmin()
    const body = await request.json()
    
    console.log(`🔄 LinkedIn hosted auth webhook received:`, body)
    
    // Extract fields according to Unipile hosted auth documentation
    const { account_id, name: workspaceUserId, status } = body
    
    // RACE CONDITION PROTECTION: Check if we're already processing this account
    if (processingLocks.has(account_id)) {
      console.log(`⏳ Account ${account_id} is already being processed, waiting for completion...`)
      try {
        await processingLocks.get(account_id)
        return NextResponse.json({ 
          success: true, 
          message: 'Account already processed by concurrent request',
          account_id,
          duplicate_prevented: true
        })
      } catch (error) {
        console.log(`⚠️ Concurrent processing failed, will retry this request`)
        // Continue with processing if the other request failed
      }
    }
    
    // Create a promise for this processing operation
    let resolveLock: (value: any) => void
    let rejectLock: (error: any) => void
    const lockPromise = new Promise((resolve, reject) => {
      resolveLock = resolve
      rejectLock = reject
    })
    processingLocks.set(account_id, lockPromise)
    
    try {
      // Process the webhook
      const result = await processLinkedInCallback(supabase, account_id, workspaceUserId, status, body)
      resolveLock!(result)
      return result
    } catch (error) {
      rejectLock!(error)
      throw error
    } finally {
      // Clean up lock after processing (or after timeout)
      setTimeout(() => processingLocks.delete(account_id), 5000)
    }
    
  } catch (error) {
    console.error('❌ Error in LinkedIn callback:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unexpected error' 
    }, { status: 500 })
  }
}

// Extracted processing logic
async function processLinkedInCallback(
  supabase: any,
  account_id: string,
  workspaceUserId: string,
  status: string,
  body: any
): Promise<NextResponse> {
  try {

    // Validate webhook format
    if (!account_id || !workspaceUserId || !status) {
      console.error('❌ Invalid webhook format received:', body)
      return NextResponse.json({ success: false, error: 'Invalid webhook format' }, { status: 400 })
    }

    // Parse workspace-specific user ID (format: workspaceId:userId)
    if (!workspaceUserId.includes(':')) {
      console.error('❌ Invalid workspace user ID format:', workspaceUserId)
      return NextResponse.json({ success: false, error: 'Invalid user ID format' }, { status: 400 })
    }
    
    const [workspaceId, user_id] = workspaceUserId.split(':', 2)

    console.log(`🔄 Processing webhook for:`, {
      account_id,
      workspaceUserId,
      workspace_id: workspaceId,
      user_id,
      status,
      timestamp: new Date().toISOString()
    })

    // Check if webhook indicates successful connection
    if (status !== 'CREATION_SUCCESS') {
      console.log(`❌ LinkedIn connection failed with status: ${status}`)
      // This is a webhook, not a redirect - return JSON response
      return NextResponse.json({ success: false, error: `Connection failed: ${status}` }, { status: 400 })
    }

    // Get Unipile configuration
    const unipileDsn = process.env.UNIPILE_DSN
    const unipileApiKey = process.env.UNIPILE_API_KEY

    if (!unipileDsn || !unipileApiKey) {
      console.error('❌ Unipile configuration missing')
      return NextResponse.json({ success: false, error: 'Unipile configuration missing' }, { status: 500 })
    }

    // ENHANCED: Handle PLACEHOLDER values with fallback user resolution
    let resolvedUserId = user_id
    let resolvedWorkspaceId = workspaceId
    let authUser = null

    if (user_id === 'PLACEHOLDER' || workspaceId === 'PLACEHOLDER') {
      console.log(`⚠️ Received placeholder values, attempting user resolution via LinkedIn account data`)
      
      // Fetch account details from Unipile first to get LinkedIn profile info
      try {
        const baseUrl = `https://${unipileDsn}/api/v1`
        const response = await fetch(`${baseUrl}/accounts/${account_id}`, {
          headers: { 'X-API-KEY': unipileApiKey }
        })
        
        if (!response.ok) {
          throw new Error(`Unipile API error: ${response.status}`)
        }
        
        const accountDetails = await response.json()
        const linkedInEmail = accountDetails.connection_params?.im?.email
        const linkedInUsername = accountDetails.connection_params?.im?.username
        
        console.log(`🔍 LinkedIn account details:`, {
          email: linkedInEmail,
          username: linkedInUsername,
          account_id: account_id
        })

        // Try to find user by LinkedIn email or known email patterns
        if (linkedInEmail) {
          const { data: userByEmail } = await supabase.auth.admin.listUsers()
          const matchingUser = userByEmail?.users?.find((u: any) => u.email === linkedInEmail)
          
          if (matchingUser) {
            resolvedUserId = matchingUser.id
            console.log(`✅ Resolved user by LinkedIn email: ${matchingUser.email} -> ${resolvedUserId}`)
            
            // Get user's current workspace
            const { data: userProfile } = await supabase
              .from('users')
              .select('current_workspace_id')
              .eq('id', resolvedUserId)
              .single()
            
            if (userProfile?.current_workspace_id) {
              resolvedWorkspaceId = userProfile.current_workspace_id
              console.log(`✅ Resolved workspace: ${resolvedWorkspaceId}`)
            }
          }
        }
        
        // If still not found, try manual resolution (for development/testing)
        if (resolvedUserId === 'PLACEHOLDER') {
          console.log(`⚠️ Could not resolve user automatically, using manual fallback`)
          // You can add manual resolution logic here if needed
          return NextResponse.json({ 
            success: false, 
            error: 'Could not resolve user from placeholder values',
            debug_info: {
              account_id,
              linkedin_email: linkedInEmail,
              linkedin_username: linkedInUsername
            }
          }, { status: 400 })
        }
        
      } catch (error) {
        console.error('❌ Failed to resolve user from placeholder values:', error)
        return NextResponse.json({ success: false, error: 'User resolution failed' }, { status: 500 })
      }
    }

    // Get user from admin client (callback doesn't have user session)
    const { data: { user: fetchedUser } } = await supabase.auth.admin.getUserById(resolvedUserId)
    authUser = fetchedUser
    
    if (!authUser) {
      console.error('❌ User verification failed - user not found:', resolvedUserId)
      return NextResponse.json({ success: false, error: 'User verification failed' }, { status: 401 })
    }

    console.log(`🏢 Processing LinkedIn connection for workspace: ${resolvedWorkspaceId}`)

    // Fetch account details from Unipile (avoid duplicate fetch if already done in placeholder resolution)
    const baseUrl = `https://${unipileDsn}/api/v1`
    let accountDetails
    try {
      const response = await fetch(`${baseUrl}/accounts/${account_id}`, {
        headers: { 'X-API-KEY': unipileApiKey }
      })
      
      if (!response.ok) {
        throw new Error(`Unipile API error: ${response.status}`)
      }
      
      accountDetails = await response.json()
      console.log(`📋 Fetched account details from Unipile:`, {
        id: accountDetails.id,
        name: accountDetails.name || accountDetails.connection_params?.im?.username,
        status: accountDetails.status
      })
    } catch (error) {
      console.error('❌ Failed to fetch account details from Unipile:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch account details' }, { status: 500 })
    }

    // Check for existing accounts (using integrations table)
    const { data: existingAccounts } = await supabase
      .from('integrations')
      .select('id, credentials, created_at')
      .eq('user_id', resolvedUserId)
      .eq('provider', 'linkedin')

    console.log(`🔍 Found ${existingAccounts?.length || 0} existing LinkedIn accounts in workspace`)
    
    // CRITICAL: Check if this exact account already exists to prevent duplicates
    const accountAlreadyExists = existingAccounts?.some(
      acc => acc.credentials?.unipile_account_id === account_id
    )
    
    if (accountAlreadyExists) {
      console.log(`⚠️ Account ${account_id} already exists in database - skipping duplicate insert`)
      return NextResponse.json({ 
        success: true, 
        message: 'LinkedIn account already connected (duplicate prevented)',
        account_id,
        workspace_id: resolvedWorkspaceId,
        duplicate_prevented: true
      })
    }
    
    // Also check if same LinkedIn profile (by email/identifier) already connected with different Unipile ID
    const linkedInEmail = accountDetails.connection_params?.im?.email
    const linkedInIdentifier = accountDetails.connection_params?.im?.public_identifier
    
    const sameProfileExists = existingAccounts?.some(acc => {
      const existingEmail = acc.credentials?.account_email
      const existingIdentifier = acc.credentials?.linkedin_public_identifier
      
      return (linkedInEmail && existingEmail && linkedInEmail === existingEmail) ||
             (linkedInIdentifier && existingIdentifier && linkedInIdentifier === existingIdentifier)
    })
    
    if (sameProfileExists) {
      console.log(`⚠️ LinkedIn profile already connected with different Unipile account - cleaning up duplicate`)
      
      // Delete the new duplicate from Unipile since the user already has this LinkedIn connected
      try {
        const deleteResponse = await fetch(`${baseUrl}/accounts/${account_id}`, {
          method: 'DELETE',
          headers: { 'X-API-KEY': unipileApiKey }
        })
        
        if (deleteResponse.ok) {
          console.log(`✅ Deleted duplicate Unipile account: ${account_id}`)
        } else {
          console.error(`❌ Failed to delete duplicate: ${deleteResponse.status}`)
        }
      } catch (deleteError) {
        console.error(`❌ Error deleting duplicate:`, deleteError)
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'LinkedIn profile already connected (duplicate cleaned up)',
        account_id,
        workspace_id: resolvedWorkspaceId,
        duplicate_prevented: true,
        duplicate_deleted: true
      })
    }

    // Determine LinkedIn experience type from connection params
    let linkedinExperience = 'classic' // default
    if (accountDetails.connection_params?.product_type) {
      const productType = accountDetails.connection_params.product_type.toLowerCase()
      if (productType.includes('sales')) {
        linkedinExperience = 'sales_navigator'
      } else if (productType.includes('recruiter')) {
        linkedinExperience = 'recruiter'
      }
    }

    // Store new account in integrations table
    const accountName = accountDetails.name || accountDetails.connection_params?.im?.username || 'LinkedIn Account'
    const accountIdentifier = accountDetails.connection_params?.im?.email || 
                             accountDetails.connection_params?.im?.public_identifier ||
                             accountName
    
    const { data: newAccount, error: insertError } = await supabase
      .from('integrations')
      .insert({
        user_id: resolvedUserId,
        provider: 'linkedin',
        type: 'social',
        status: 'active',
        credentials: {
          unipile_account_id: account_id,
          account_name: accountName,
          linkedin_public_identifier: accountDetails.connection_params?.im?.public_identifier,
          account_email: accountDetails.connection_params?.im?.email
        },
        settings: {
          workspace_id: resolvedWorkspaceId,
          linkedin_experience: linkedinExperience,
          linkedin_profile_url: accountDetails.connection_params?.im?.profile_url || 
            (accountDetails.connection_params?.im?.public_identifier ? 
              `https://linkedin.com/in/${accountDetails.connection_params.im.public_identifier}` : null),
          connection_method: 'hosted_auth',
          product_type: accountDetails.connection_params?.product_type
        }
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Failed to store association:', insertError)
      return NextResponse.json({ success: false, error: 'Failed to store account data' }, { status: 500 })
    }

    console.log(`✅ Successfully stored LinkedIn account in workspace ${resolvedWorkspaceId}`)

    // ENHANCED: Assign Bright Data IP based on LinkedIn profile location
    try {
      console.log('🌍 Assigning Bright Data IP based on LinkedIn location...');
      
      // Extract location from LinkedIn profile
      let linkedInLocation = null;
      if (accountDetails.connection_params?.im?.location) {
        linkedInLocation = accountDetails.connection_params.im.location;
      } else if (accountDetails.connection_params?.profile?.location) {
        linkedInLocation = accountDetails.connection_params.profile.location;
      } else if (accountDetails.metadata?.location) {
        linkedInLocation = accountDetails.metadata.location;
      }
      
      console.log('📍 LinkedIn profile location:', linkedInLocation);
      
      if (linkedInLocation) {
        const { AutoIPAssignmentService } = await import('@/lib/services/auto-ip-assignment');
        const autoIPService = new AutoIPAssignmentService();
        
        // Generate optimal proxy configuration based on LinkedIn location
        const proxyConfig = await autoIPService.generateOptimalProxyConfig(undefined, linkedInLocation);
        
        console.log('✅ Generated proxy config from LinkedIn location:', {
          linkedInLocation,
          country: proxyConfig.country,
          state: proxyConfig.state,
          confidence: proxyConfig.confidence,
          sessionId: proxyConfig.sessionId
        });
        
        // Check if user already has IP assignment
        const { data: existingProxy } = await supabase
          .from('user_proxy_preferences')
          .select('id, session_id')
          .eq('user_id', resolvedUserId)
          .single();
        
        if (existingProxy) {
          // Update existing proxy with LinkedIn-based location
          const { error: updateError } = await supabase
            .from('user_proxy_preferences')
            .update({
              linkedin_location: linkedInLocation,
              preferred_country: proxyConfig.country,
              preferred_state: proxyConfig.state,
              preferred_city: proxyConfig.city,
              confidence_score: proxyConfig.confidence,
              session_id: proxyConfig.sessionId,
              is_linkedin_based: true,
              last_updated: new Date().toISOString()
            })
            .eq('user_id', resolvedUserId);
          
          if (updateError) {
            console.error('❌ Failed to update proxy with LinkedIn location:', updateError);
          } else {
            console.log('✅ Updated proxy config with LinkedIn location');
          }
        } else {
          // Create new proxy assignment based on LinkedIn location
          const { error: proxyError } = await supabase
            .from('user_proxy_preferences')
            .insert({
              user_id: resolvedUserId,
              linkedin_location: linkedInLocation,
              preferred_country: proxyConfig.country,
              preferred_state: proxyConfig.state,
              preferred_city: proxyConfig.city,
              confidence_score: proxyConfig.confidence,
              session_id: proxyConfig.sessionId,
              is_linkedin_based: true,
              is_auto_assigned: true,
              created_at: new Date().toISOString(),
              last_updated: new Date().toISOString()
            });
          
          if (proxyError) {
            console.error('❌ Failed to create proxy from LinkedIn location:', proxyError);
          } else {
            console.log('✅ Created proxy config from LinkedIn location');
          }
        }
      } else {
        console.log('ℹ️ No location found in LinkedIn profile, keeping existing IP assignment');
      }
      
    } catch (ipError) {
      console.error('⚠️ LinkedIn-based IP assignment failed (non-critical):', ipError);
      // Don't fail the entire LinkedIn connection if IP assignment fails
    }

    // ENHANCED: Global duplicate detection and cleanup (prevents multiple LinkedIn logins)
    console.log(`🔍 Starting global duplicate detection for account: ${account_id}`)
    
    try {
      // Get all LinkedIn accounts from Unipile
      const unipileResponse = await fetch(`${baseUrl}/accounts`, {
        headers: { 'X-API-KEY': unipileApiKey }
      })
      
      if (unipileResponse.ok) {
        const allUnipileAccounts = await unipileResponse.json()
        const linkedInAccounts = allUnipileAccounts.items?.filter((acc: any) => acc.type === 'LINKEDIN') || []
        
        // Get all our database associations for this user (across all workspaces)
        const { data: allUserAssociations } = await supabase
          .from('integrations')
          .select('id, credentials, settings, created_at')
          .eq('user_id', resolvedUserId)
          .eq('provider', 'linkedin')
        
        console.log(`📊 Found ${linkedInAccounts.length} LinkedIn accounts in Unipile, ${allUserAssociations?.length || 0} in database`)
        
        // Find potential duplicates: same LinkedIn credentials but different Unipile IDs
        const duplicateUnipileAccounts = []
        const newAccountDetails = linkedInAccounts.find((acc: any) => acc.id === account_id)
        
        if (newAccountDetails?.connection_params?.im) {
          const newAccountEmail = newAccountDetails.connection_params.im.email || newAccountDetails.connection_params.im.username
          const newAccountLinkedInId = newAccountDetails.connection_params.im.id
          
          // Check for other Unipile accounts with same LinkedIn credentials
          for (const otherAccount of linkedInAccounts) {
            if (otherAccount.id !== account_id && otherAccount.connection_params?.im) {
              const otherEmail = otherAccount.connection_params.im.email || otherAccount.connection_params.im.username
              const otherLinkedInId = otherAccount.connection_params.im.id
              
              // Same LinkedIn account = duplicate
              if ((newAccountEmail && otherEmail && newAccountEmail === otherEmail) ||
                  (newAccountLinkedInId && otherLinkedInId && newAccountLinkedInId === otherLinkedInId)) {
                duplicateUnipileAccounts.push(otherAccount)
                console.log(`🔍 Found duplicate LinkedIn account: ${otherAccount.id} (${otherAccount.name})`)
              }
            }
          }
        }
        
        // Delete duplicates from Unipile (following Arnaud's advice)
        for (const duplicateAccount of duplicateUnipileAccounts) {
          console.log(`🗑️ Deleting duplicate Unipile account: ${duplicateAccount.id} (${duplicateAccount.name})`)
          
          try {
            // Delete from Unipile API (invoiced but prevents duplicates)
            const deleteResponse = await fetch(`${baseUrl}/accounts/${duplicateAccount.id}`, {
              method: 'DELETE',
              headers: { 'X-API-KEY': unipileApiKey }
            })
            
            if (deleteResponse.ok) {
              console.log(`✅ Successfully deleted duplicate from Unipile: ${duplicateAccount.id}`)
              
              // Remove from all integrations entries
              const { error: dbDeleteError } = await supabase
                .from('integrations')
                .delete()
                .eq('user_id', resolvedUserId)
                .eq('provider', 'linkedin')
                .like('credentials', `%"unipile_account_id":"${duplicateAccount.id}"%`)
              
              if (dbDeleteError) {
                console.error(`❌ Failed to delete from database: ${dbDeleteError.message}`)
              } else {
                console.log(`✅ Removed duplicate from database: ${duplicateAccount.id}`)
              }
            } else {
              console.error(`❌ Failed to delete from Unipile: ${deleteResponse.status}`)
            }
          } catch (deleteError) {
            console.error(`❌ Error deleting duplicate account ${duplicateAccount.id}:`, deleteError)
          }
        }
        
        console.log(`✅ Global duplicate cleanup completed - removed ${duplicateUnipileAccounts.length} duplicates`)
        
      } else {
        console.error(`❌ Failed to fetch Unipile accounts: ${unipileResponse.status}`)
      }
    } catch (error) {
      console.error('❌ Error during global duplicate cleanup:', error)
      // Don't fail the entire process if cleanup fails
    }

    console.log(`✅ LinkedIn connection successful for user ${resolvedUserId}`)
    
    // Return success JSON response for webhook
    return NextResponse.json({ 
      success: true, 
      message: 'LinkedIn account connected successfully',
      account_id,
      workspace_id: resolvedWorkspaceId,
      linkedin_experience: linkedinExperience
    })

  } catch (error) {
    console.error('❌ Error in processLinkedInCallback:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unexpected error' 
    }, { status: 500 })
  }
}

// GET method for webhook verification or status checks
export async function GET(request: NextRequest) {
  try {
    // Basic webhook verification endpoint
    const { searchParams } = new URL(request.url)
    const challenge = searchParams.get('challenge')
    
    if (challenge) {
      // Webhook verification
      return NextResponse.json({ challenge })
    }
    
    // Status endpoint
    return NextResponse.json({
      success: true,
      endpoint: 'linkedin_callback',
      timestamp: new Date().toISOString(),
      ready: true
    })

  } catch (error) {
    console.error('Error in LinkedIn callback GET:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}