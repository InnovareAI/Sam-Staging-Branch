import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

// Helper function to check for duplicate LinkedIn accounts
async function checkAndHandleDuplicateAccounts(userId: string, newAccountData: any) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    // Get all existing LinkedIn accounts for this user
    const { data: existingAccounts, error } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'LINKEDIN')
      .eq('connection_status', 'active')
    
    if (error) {
      console.error('Error checking for duplicates:', error)
      return { isDuplicate: false, existingAccount: null }
    }
    
    if (!existingAccounts || existingAccounts.length === 0) {
      return { isDuplicate: false, existingAccount: null }
    }
    
    // Check if this account is a duplicate based on LinkedIn profile info
    const connectionParams = newAccountData.connection_params?.im || {}
    const newProfileId = connectionParams.publicIdentifier || connectionParams.email
    
    for (const existing of existingAccounts) {
      // If same Unipile account ID, it's the same account (reconnect case)
      if (existing.unipile_account_id === newAccountData.id) {
        return { isDuplicate: false, existingAccount: existing }
      }
      
      // If same LinkedIn profile, it's a duplicate
      if (existing.linkedin_public_identifier === newProfileId ||
          existing.account_email === connectionParams.email) {
        return { isDuplicate: true, existingAccount: existing }
      }
    }
    
    return { isDuplicate: false, existingAccount: null }
  } catch (error) {
    console.error('Exception checking for duplicates:', error)
    return { isDuplicate: false, existingAccount: null }
  }
}

// Helper function to delete duplicate account from Unipile
async function deleteDuplicateUnipileAccount(accountId: string) {
  try {
    const unipileDsn = process.env.UNIPILE_DSN
    const unipileApiKey = process.env.UNIPILE_API_KEY
    
    if (!unipileDsn || !unipileApiKey) {
      console.error('Missing Unipile credentials for account deletion')
      return false
    }
    
    const response = await fetch(`https://${unipileDsn}/api/v1/accounts/${accountId}`, {
      method: 'DELETE',
      headers: {
        'X-API-KEY': unipileApiKey,
        'Accept': 'application/json'
      }
    })
    
    if (response.ok) {
      console.log(`✅ Successfully deleted duplicate account ${accountId} from Unipile`)
      return true
    } else {
      const errorText = await response.text()
      console.error(`❌ Failed to delete duplicate account: ${response.status} ${errorText}`)
      return false
    }
  } catch (error) {
    console.error('Exception deleting duplicate account:', error)
    return false
  }
}

// Helper function to store user account association
async function storeUserAccountAssociation(
  supabase: SupabaseClient,
  userId: string,
  unipileAccount: any
) {
  try {
    console.log(`🔗 Starting association storage for user ${userId} and account ${unipileAccount.id}`)
    
    const connectionParams = unipileAccount.connection_params?.im || {}
    
    // Use the robust RPC function that bypasses schema cache issues
    const { data, error } = await supabase.rpc('create_user_association', {
      p_user_id: userId,
      p_unipile_account_id: unipileAccount.id,
      p_platform: unipileAccount.type,
      p_account_name: unipileAccount.name,
      p_account_email: connectionParams.email || connectionParams.username,
      p_linkedin_public_identifier: connectionParams.publicIdentifier,
      p_linkedin_profile_url: connectionParams.publicIdentifier ? 
        `https://www.linkedin.com/in/${connectionParams.publicIdentifier}` : null,
      p_connection_status: 'active'
    })
    
    if (error) {
      console.error('❌ Failed to store user account association via RPC:', error)
      
      // Fallback: Try direct insert as a last resort
      console.log('🔄 Attempting fallback direct insert...')
      const fallbackData = {
        user_id: userId,
        unipile_account_id: unipileAccount.id,
        platform: unipileAccount.type,
        account_name: unipileAccount.name,
        account_email: connectionParams.email || connectionParams.username,
        connection_status: 'active'
      }
      
      const { data: fallbackResult, error: fallbackError } = await supabase
        .from('user_unipile_accounts')
        .upsert(fallbackData, { 
          onConflict: 'unipile_account_id',
          ignoreDuplicates: false 
        })
        .select()
      
      if (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError)
        return false
      }
      
      console.log(`✅ Fallback association successful:`, fallbackResult)
      return true
    }
    
    console.log(`✅ Stored user account association successfully via RPC:`, {
      userId,
      unipileAccountId: unipileAccount.id,
      accountName: unipileAccount.name,
      platform: unipileAccount.type,
      data: data
    })
    
    return true
  } catch (error) {
    console.error('💥 Exception in storing user account association:', error)
    return false
  }
}

async function upsertWorkspaceAccount(
  supabase: SupabaseClient,
  workspaceId: string | null,
  userId: string,
  unipileAccount: any
) {
  if (!workspaceId) {
    const errorMsg = `🚨 CRITICAL: No workspace ID for user ${userId} account ${unipileAccount.id}. Account stored in user_unipile_accounts but NOT in workspace_accounts!`
    console.error(errorMsg)
    throw new Error('Workspace ID is required to associate account with workspace')
  }

  const connectionParams = unipileAccount.connection_params?.im || unipileAccount.connection_params || {}
  const accountIdentifier =
    connectionParams.email?.toLowerCase() ||
    connectionParams.username?.toLowerCase() ||
    unipileAccount.connection_params?.email?.toLowerCase() ||
    unipileAccount.id

  const connectionStatus = unipileAccount.sources?.some((source: any) => source.status === 'OK')
    ? 'connected'
    : unipileAccount.sources?.[0]?.status?.toLowerCase() || 'pending'

  // Determine account type based on Unipile account type
  const unipileType = unipileAccount.type?.toUpperCase() || '';
  console.log('🔍 Account type detection:', {
    raw_type: unipileAccount.type,
    normalized_type: unipileType,
    account_id: unipileAccount.id,
    account_name: unipileAccount.name
  })
  
  const accountType = unipileType === 'LINKEDIN' ? 'linkedin' :
                      unipileType.includes('GOOGLE') ? 'email' :
                      unipileType.includes('OUTLOOK') ? 'email' :
                      unipileType === 'MESSAGING' ? 'email' :
                      unipileType.includes('MICROSOFT') ? 'email' :
                      unipileType.includes('OFFICE365') ? 'email' :
                      unipileType.includes('GMAIL') ? 'email' :
                      'email' // Default to email for non-LinkedIn accounts
  
  console.log(`✅ Mapped Unipile type "${unipileType}" → account_type "${accountType}"`)

  // First, check if there's an existing account with different Unipile ID (reconnection case)
  const { data: existingAccounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('account_type', accountType)
    .eq('account_identifier', accountIdentifier)

  if (existingAccounts && existingAccounts.length > 0) {
    // Found existing account(s) with same identifier
    for (const existing of existingAccounts) {
      if (existing.unipile_account_id !== unipileAccount.id) {
        // Different Unipile ID = reconnection, delete old entry
        console.log(`🔄 Reconnection detected - removing old account: ${existing.unipile_account_id}`)
        await supabase
          .from('workspace_accounts')
          .delete()
          .eq('id', existing.id)
      }
    }
  }

  // Now insert/update the new account
  const { error } = await supabase
    .from('workspace_accounts')
    .upsert(
      {
        workspace_id: workspaceId,
        user_id: userId,
        account_type: accountType,
        account_identifier: accountIdentifier,
        account_name: unipileAccount.name || connectionParams.publicIdentifier || accountIdentifier,
        unipile_account_id: unipileAccount.id,
        connection_status: connectionStatus,
        is_active: true,
        connected_at: new Date().toISOString(), // Update connection timestamp
        account_metadata: {
          unipile_instance: process.env.UNIPILE_DSN || null,
          product_type: unipileAccount.connection_params?.product_type || null,
          provider: unipileAccount.type, // Store original provider type
          premium_features: connectionParams.premiumFeatures || [] // Store detected features
        }
      },
      { onConflict: 'workspace_id,user_id,account_type,account_identifier', ignoreDuplicates: false }
    )

  if (error) {
    console.error('❌ FAILED to upsert workspace account during hosted auth callback:', {
      error: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      accountType,
      accountId: unipileAccount.id,
      workspaceId,
      userId,
      accountIdentifier
    })
  } else {
    console.log('✅ Workspace account upserted successfully:', {
      accountType,
      accountId: unipileAccount.id,
      accountName: unipileAccount.name,
      workspaceId,
      userId,
      connectionStatus
    })
  }
}

// GET - Handle hosted auth callback from Unipile
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')
    const accountId = searchParams.get('account_id')
    const status = searchParams.get('status')
    const error = searchParams.get('error')
    const userContext = searchParams.get('user_context')

    console.log('🔄 Hosted auth callback received:', {
      sessionId,
      accountId,
      status,
      error,
      userContext
    })

    // Parse user context if available
    let parsedUserContext
    try {
      parsedUserContext = userContext ? JSON.parse(decodeURIComponent(userContext)) : null
    } catch (parseError) {
      console.error('Failed to parse user context:', parseError)
    }

    // Handle error cases
    if (error || status === 'error') {
      const errorMessage = error || 'Authentication failed'
      console.error('❌ Hosted auth failed:', errorMessage)

      // Redirect to workspace page with error
      // Try to get workspace_id from user context, fallback to generic error page
      const workspaceId = parsedUserContext?.workspace_id
      const redirectUrl = workspaceId
        ? `/workspace/${workspaceId}?error=${encodeURIComponent(errorMessage)}`
        : `/?error=${encodeURIComponent(errorMessage)}`
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    // Handle successful authentication
    if (status === 'success' && accountId) {
      console.log('✅ Hosted auth successful for account:', accountId)

      // If we have user context, store the association
      if (parsedUserContext?.user_id) {
        try {
          // Fetch account details from Unipile to store association
          const unipileDsn = process.env.UNIPILE_DSN
          const unipileApiKey = process.env.UNIPILE_API_KEY

          if (unipileDsn && unipileApiKey) {
            const accountResponse = await fetch(`https://${unipileDsn}/api/v1/accounts/${accountId}`, {
              headers: {
                'X-API-KEY': unipileApiKey,
                'Accept': 'application/json'
              }
            })

            if (accountResponse.ok) {
              const accountData = await accountResponse.json()
              const accountType = accountData.type // LINKEDIN, GOOGLE, OUTLOOK, etc.

              console.log('📧 Account details fetched:', {
                accountId,
                accountType,
                name: accountData.name,
                email: accountData.connection_params?.email || accountData.connection_params?.im?.email,
                userId: parsedUserContext.user_id
              })

              // Check for duplicates before storing (LinkedIn only)
              if (accountType === 'LINKEDIN') {
                const duplicateCheck = await checkAndHandleDuplicateAccounts(
                  parsedUserContext.user_id,
                  accountData
                )
                
                if (duplicateCheck.isDuplicate) {
                  console.log(`🔄 Duplicate LinkedIn account detected, cleaning up: ${accountData.id}`)
                  // Delete the duplicate account from Unipile to avoid billing
                  await deleteDuplicateUnipileAccount(accountData.id)
                  console.log(`✅ Duplicate account cleaned up successfully`)
                  
                  // Redirect to LinkedIn page with duplicate warning
                  const redirectUrl = `/linkedin-integration?warning=duplicate_account_removed`
                  return NextResponse.redirect(new URL(redirectUrl, request.url))
                }
              }
              
              // CRITICAL FIX: Always use the connector's workspace (person who clicked "Connect")
              // DO NOT try to match by LinkedIn email - this causes cross-workspace pollution
              const targetUserId = parsedUserContext.user_id;
              const targetWorkspaceId = parsedUserContext.workspace_id;

              console.log(`✅ Assigning account to connector: user=${targetUserId}, workspace=${targetWorkspaceId}`);
              
              // Auto-set profile_country from LinkedIn location if not already set
              if (accountType === 'LINKEDIN' && accountData.connection_params?.im?.location) {
                try {
                  const linkedinLocation = accountData.connection_params.im.location;
                  console.log(`🌍 LinkedIn location detected: ${linkedinLocation}`);
                  
                  // Extract country code from LinkedIn location (e.g., "Germany" -> "de")
                  const countryMapping: { [key: string]: string } = {
                    'germany': 'de', 'deutschland': 'de',
                    'united states': 'us', 'usa': 'us', 'america': 'us',
                    'united kingdom': 'gb', 'uk': 'gb', 'england': 'gb',
                    'france': 'fr',
                    'spain': 'es', 'españa': 'es',
                    'italy': 'it', 'italia': 'it',
                    'netherlands': 'nl',
                    'belgium': 'be',
                    'switzerland': 'ch',
                    'austria': 'at', 'österreich': 'at',
                    'canada': 'ca',
                    'australia': 'au',
                    'brazil': 'br',
                    'mexico': 'mx',
                    'india': 'in',
                    'singapore': 'sg',
                    'japan': 'jp',
                    'china': 'cn'
                  };
                  
                  const locationLower = linkedinLocation.toLowerCase();
                  let countryCode = null;
                  
                  // Find matching country
                  for (const [key, code] of Object.entries(countryMapping)) {
                    if (locationLower.includes(key)) {
                      countryCode = code;
                      break;
                    }
                  }
                  
                  if (countryCode) {
                    // Check if user already has a profile_country set
                    const { data: userData } = await supabase
                      .from('users')
                      .select('profile_country')
                      .eq('id', targetUserId)
                      .single();
                    
                    // Only update if not already set
                    if (!userData?.profile_country) {
                      const { error: updateError } = await supabase
                        .from('users')
                        .update({ profile_country: countryCode })
                        .eq('id', targetUserId);
                      
                      if (!updateError) {
                        console.log(`✅ Auto-set profile_country to ${countryCode} from LinkedIn location`);
                      } else {
                        console.error('Failed to set profile_country:', updateError);
                      }
                    } else {
                      console.log(`ℹ️ User already has profile_country set: ${userData.profile_country}`);
                    }
                  } else {
                    console.log(`⚠️ Could not map LinkedIn location "${linkedinLocation}" to country code`);
                  }
                } catch (locationError) {
                  console.error('Error setting profile_country from LinkedIn:', locationError);
                }
              }
              
              // ATOMIC: Store account in both tables atomically using RPC function
              // This prevents silent failures and table drift
              console.log(`🔗 Atomically associating ${accountType} account ${accountId} for user ${targetUserId} in workspace ${targetWorkspaceId}`)

              const { data: rpcResult, error: rpcError } = await supabase.rpc('associate_account_atomic', {
                p_user_id: targetUserId,
                p_workspace_id: targetWorkspaceId,
                p_unipile_account_id: accountId,
                p_account_data: accountData
              })

              if (rpcError) {
                console.error(`❌ CRITICAL: Atomic account association failed:`, rpcError)
                throw new Error(`Failed to associate ${accountType} account: ${rpcError.message}`)
              }

              console.log(`✅ Atomic account association successful:`, rpcResult)
              console.log(`✅ ${accountType} account stored in both user_unipile_accounts AND workspace_accounts`)

              // Redirect based on account type
              if (accountType === 'LINKEDIN') {
                const redirectUrl = `/linkedin-integration?success=true&account_id=${accountId}`
                return NextResponse.redirect(new URL(redirectUrl, request.url))
              } else if (accountType.includes('GOOGLE') || accountType.includes('OUTLOOK') || accountType === 'MESSAGING' || accountType === 'MAIL') {
                // For email connections, redirect to workspace with success message
                // Modal polling will detect the connection and close automatically
                const providerName = accountType.includes('GOOGLE') ? 'google' :
                                     accountType.includes('OUTLOOK') ? 'microsoft' : 'email';
                const redirectUrl = `/workspace/${targetWorkspaceId}?email_connected=true&provider=${providerName}&account_id=${accountId}&close_popup=true`
                return NextResponse.redirect(new URL(redirectUrl, request.url))
              }
            }
          }
        } catch (associationError) {
          console.error('❌ Error storing account association:', associationError)
          // CRITICAL: Fail the flow - redirect to error page instead of success
          const workspaceId = parsedUserContext?.workspace_id
          const errorMessage = associationError instanceof Error ? associationError.message : 'Failed to store account association'
          const redirectUrl = workspaceId
            ? `/workspace/${workspaceId}?error=account_connection_failed&message=${encodeURIComponent(errorMessage)}`
            : `/?error=account_connection_failed&message=${encodeURIComponent(errorMessage)}`
          return NextResponse.redirect(new URL(redirectUrl, request.url))
        }
      }

      // Default redirect to workspace page (works for any provider)
      const workspaceId = parsedUserContext?.workspace_id
      const redirectUrl = workspaceId
        ? `/workspace/${workspaceId}?account_connected=true&account_id=${accountId}`
        : `/?success=true&account_id=${accountId}`
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    // Handle pending/in-progress status
    if (status === 'pending' || status === 'in_progress') {
      console.log('⏳ Authentication still in progress')
      const redirectUrl = `/linkedin-integration?status=pending&session_id=${sessionId}`
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    // Default case - redirect with unknown status
    console.warn('⚠️ Unknown callback status:', status)
    const redirectUrl = `/linkedin-integration?status=unknown`
    return NextResponse.redirect(new URL(redirectUrl, request.url))

  } catch (error) {
    console.error('💥 Hosted auth callback error:', error)
    
    // Redirect to LinkedIn integration page with callback error
    const errorMessage = 'Authentication callback failed'
    const redirectUrl = `/linkedin-integration?error=${encodeURIComponent(errorMessage)}`
    return NextResponse.redirect(new URL(redirectUrl, request.url))
  }
}

// POST - Handle webhook callbacks from Unipile (alternative to GET for some implementations)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('🔄 Hosted auth webhook received:', body)

    const { session_id, account_id, status, error, user_context } = body

    // Handle the same logic as GET but return JSON response instead of redirect
    if (error || status === 'error') {
      return NextResponse.json({
        success: false,
        error: error || 'Authentication failed',
        timestamp: new Date().toISOString()
      }, { status: 400 })
    }

    if (status === 'success' && account_id) {
      // If we have user context, store the association
      const supabase = createRouteHandlerClient({ cookies })
      if (user_context?.user_id) {
        try {
          // Fetch account details and store association (same logic as GET)
          const unipileDsn = process.env.UNIPILE_DSN
          const unipileApiKey = process.env.UNIPILE_API_KEY

          if (unipileDsn && unipileApiKey) {
            const accountResponse = await fetch(`https://${unipileDsn}/api/v1/accounts/${account_id}`, {
              headers: {
                'X-API-KEY': unipileApiKey,
                'Accept': 'application/json'
              }
            })

            if (accountResponse.ok) {
              const accountData = await accountResponse.json()

              const associationStored = await storeUserAccountAssociation(
                supabase,
                user_context.user_id,
                accountData
              )

              if (!associationStored) {
                throw new Error(`Failed to store user association for account ${account_id}`)
              }

              console.log(`✅ Association stored for webhook: user ${user_context.user_id}`)

              // CRITICAL: Store in workspace_accounts
              try {
                await upsertWorkspaceAccount(
                  supabase,
                  user_context.workspace_id,
                  user_context.user_id,
                  accountData
                )
                console.log(`✅ Workspace account stored for workspace ${user_context.workspace_id}`)
              } catch (workspaceError) {
                console.error(`❌ CRITICAL: Failed to store workspace account in webhook:`, workspaceError)
                throw new Error(`Failed to associate account with workspace: ${workspaceError instanceof Error ? workspaceError.message : 'Unknown error'}`)
              }
            }
          }
        } catch (associationError) {
          console.error('❌ Webhook association error:', associationError)
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Authentication successful',
        account_id,
        session_id,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook received',
      status,
      session_id,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('💥 Hosted auth webhook error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Webhook processing failed',
      debug_info: {
        error_message: error instanceof Error ? error.message : 'Unknown error',
        error_type: error instanceof Error ? error.constructor.name : typeof error
      },
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
