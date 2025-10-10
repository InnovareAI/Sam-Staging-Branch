import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

// Helper function to make Unipile API calls
async function callUnipileAPI(endpoint: string, method: string = 'GET', body?: any) {
  const unipileDsn = process.env.UNIPILE_DSN
  const unipileApiKey = process.env.UNIPILE_API_KEY

  if (!unipileDsn || !unipileApiKey) {
    throw new Error('Unipile API credentials not configured')
  }

  const url = `https://${unipileDsn}/api/v1/${endpoint}`
  const options: RequestInit = {
    method,
    headers: {
      'X-API-KEY': unipileApiKey,
      'Accept': 'application/json',
      ...(body && { 'Content-Type': 'application/json' })
    },
    ...(body && { body: JSON.stringify(body) })
  }

  const response = await fetch(url, options)
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error(`Unipile API error: ${response.status} ${response.statusText}`, {
      url,
      method,
      body: body ? JSON.stringify(body, null, 2) : undefined,
      errorResponse: errorText
    })
    throw new Error(`Unipile API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  return await response.json()
}

// Helper function to store user account association using robust function
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
  workspaceId: string,
  userId: string,
  unipileAccount: any
) {
  if (!workspaceId) return

  const connectionParams = unipileAccount.connection_params?.im || {}
  const accountIdentifier =
    connectionParams.email?.toLowerCase() ||
    connectionParams.username?.toLowerCase() ||
    unipileAccount.connection_params?.email?.toLowerCase() ||
    unipileAccount.id

  const connectionStatus = unipileAccount.sources?.some((source: any) => source.status === 'OK')
    ? 'connected'
    : unipileAccount.sources?.[0]?.status?.toLowerCase() || 'pending'

  const { error } = await supabase
    .from('workspace_accounts')
    .upsert(
      {
        workspace_id: workspaceId,
        user_id: userId,
        account_type: 'linkedin',
        account_identifier: accountIdentifier,
        account_name: unipileAccount.name || connectionParams.publicIdentifier || accountIdentifier,
        unipile_account_id: unipileAccount.id,
        connection_status: connectionStatus,
        is_active: true,
        account_metadata: {
          unipile_instance: process.env.UNIPILE_DSN || null,
          product_type: unipileAccount.connection_params?.product_type || null
        }
      },
      { onConflict: 'workspace_id,user_id,account_type,account_identifier', ignoreDuplicates: false }
    )

  if (error) {
    console.error('⚠️ Failed to upsert workspace account association', error)
  }
}

// Helper function to check if a specific user's LinkedIn account exists and is connected
function checkUserLinkedInConnection(accounts: any[], userEmail?: string) {
  if (!userEmail) {
    // Without user context, we can't determine user-specific connections
    return { hasLinkedIn: false, userAccount: null }
  }
  
  const userLinkedInAccount = accounts.find(account => 
    account.type === 'LINKEDIN' && 
    (account.connection_params?.im?.username === userEmail ||
     account.connection_params?.email === userEmail ||
     account.metadata?.user_email === userEmail)
  )
  
  const isConnected = userLinkedInAccount?.sources?.some((source: any) => 
    source.status === 'OK' || source.status === 'CREDENTIALS'
  )
  
  return { 
    hasLinkedIn: !!userLinkedInAccount && isConnected,
    userAccount: userLinkedInAccount 
  }
}

// Helper function to find duplicate LinkedIn accounts
function findDuplicateLinkedInAccounts(accounts: any[]) {
  const linkedInAccounts = accounts.filter(account => account.type === 'LINKEDIN')
  
  // Group by username/identifier to find duplicates
  const accountsByIdentifier = new Map()
  
  linkedInAccounts.forEach(account => {
    const identifier = account.connection_params?.im?.username || 
                      account.connection_params?.im?.publicIdentifier || 
                      account.name
    
    if (!accountsByIdentifier.has(identifier)) {
      accountsByIdentifier.set(identifier, [])
    }
    accountsByIdentifier.get(identifier).push(account)
  })
  
  // Find accounts with duplicates
  const duplicates = []
  for (const [identifier, accounts] of accountsByIdentifier.entries()) {
    if (accounts.length > 1) {
      // Keep the most recent one, mark others as duplicates
      accounts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      duplicates.push(...accounts.slice(1)) // All except the first (most recent)
    }
  }
  
  return duplicates
}

export async function GET(request: NextRequest) {
  try {
    // 🚨 SECURITY: Get user authentication for workspace filtering
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          }
        }
      }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.log('🔐 Authentication check failed:', {
        authError: authError?.message,
        hasUser: !!user,
        timestamp: new Date().toISOString()
      })
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        debug_info: {
          auth_error: authError?.message,
          has_user: !!user,
          needs_signin: true
        }
      }, { status: 401 })
    }

    // Get user's current workspace - use user ID as fallback if no workspace table
    const userEmail = user.email?.toLowerCase() || ''
    const isInnovareAIManager = ['tl@innovareai.com', 'cl@innovareai.com', 'cs@innovareai.com', 'thorsten@innovareai.com', 'thorsten.linz@gmail.com'].includes(userEmail)
    const requestedWorkspaceId = request.nextUrl.searchParams.get('workspace_id')
    
    let workspaceId: string | null = null
    
    try {
      const { data: userProfile } = await supabase
        .from('users')
        .select('current_workspace_id')
        .eq('id', user.id)
        .maybeSingle()
      
      if (userProfile?.current_workspace_id) {
        workspaceId = userProfile.current_workspace_id as string
      }
    } catch (error) {
      console.log('⚠️ Users table not available, using fallback')
    }
    
    // Fallback: use requested workspace for managers or user ID
    if (!workspaceId) {
      if (isInnovareAIManager && requestedWorkspaceId) {
        workspaceId = requestedWorkspaceId
      } else {
        // Use user ID as workspace for compatibility
        workspaceId = user.id
        console.log('⚠️ Using user ID as workspace ID')
      }
    }

    console.log(`🔍 Debug: User ${user.email} workspace:`, {
      user_id: user.id,
      workspace_id: workspaceId
    })

    console.log(`🔍 User authentication check:`, {
      user_id: user.id,
      user_email: userEmail,
      is_innovareai_manager: isInnovareAIManager,
      workspace_id: workspaceId
    })
    
    console.log(`✅ User ${user.email} access granted for workspace ${workspaceId}`)

    // Fetch ALL accounts from Unipile (we'll filter by user associations)
    const data = await callUnipileAPI('accounts')
    const allAccounts = Array.isArray(data) ? data : (data.items || data.accounts || [])
    
    // No hardcoded user-specific logic - auto-association now handles all users generically
    
    // 🛡️ SECURITY: Get user's associated accounts only
    const { data: userAccounts } = await supabase
      .from('user_unipile_accounts')
      .select('unipile_account_id, platform, account_name, account_email, linkedin_profile_url')
      .eq('user_id', user.id)

    const userAccountIds = new Set(userAccounts?.map(acc => acc.unipile_account_id) || [])

    // 🔄 AUTO-ASSOCIATE: Check for LinkedIn accounts that belong to this user but aren't associated yet
    const allLinkedInAccounts = allAccounts.filter((account: any) => account.type === 'LINKEDIN')
    const userEmailLower = user.email?.toLowerCase()
    
    console.log(`🔍 Auto-association check for ${user.email}:`, {
      total_accounts: allAccounts.length,
      linkedin_accounts: allLinkedInAccounts.length,
      existing_user_associations: userAccountIds.size,
      user_email: userEmailLower
    })
    
    for (const linkedInAccount of allLinkedInAccounts) {
      // Skip if already associated
      if (userAccountIds.has(linkedInAccount.id)) {
        console.log(`⏭️ Skipping ${linkedInAccount.id} - already associated`)
        continue
      }
      
      // Enhanced matching logic for different account types and email patterns
      const accountData = linkedInAccount.connection_params?.im || {}
      const possibleEmails = [
        accountData.username?.toLowerCase(),
        accountData.email?.toLowerCase(),
        linkedInAccount.connection_params?.email?.toLowerCase(),
        linkedInAccount.metadata?.user_email?.toLowerCase()
      ].filter(Boolean)
      
      // Check for email domain matching (for corporate accounts)
      const userDomain = userEmailLower?.split('@')[1]
      const accountDomainMatches = possibleEmails.some(email => 
        email && userDomain && email.split('@')[1] === userDomain
      )
      
      // Exact email match
      const exactEmailMatch = possibleEmails.includes(userEmailLower)
      
      const trustedDomains = ['innovareai.com', '3cubed.ai', 'sendingcell.com']
      const isDomainTrusted = userDomain ? trustedDomains.includes(userDomain) : false

      console.log(`🔍 Checking account ${linkedInAccount.id}:`, {
        account_name: linkedInAccount.name,
        possible_emails: possibleEmails,
        user_email: userEmailLower,
        exact_match: exactEmailMatch,
        domain_match: accountDomainMatches && userDomain,
        will_associate: exactEmailMatch || (accountDomainMatches && isDomainTrusted),
        association_type: exactEmailMatch ? 'exact_email' : (accountDomainMatches && isDomainTrusted ? 'trusted_domain' : 'none')
      })
      
      // Auto-associate on exact email matches OR trusted domain matches
      if (exactEmailMatch || (accountDomainMatches && isDomainTrusted)) {
        const associationType = exactEmailMatch ? 'exact email match' : 'trusted domain match'
        console.log(`🔗 Auto-associating LinkedIn account ${linkedInAccount.id} with user ${user.email} (${associationType})`)
        
        // Check for existing associations of this account to other users (duplicate prevention)
        const { data: existingAssociations } = await supabase
          .from('user_unipile_accounts')
          .select('user_id')
          .eq('unipile_account_id', linkedInAccount.id)

        if (existingAssociations && existingAssociations.length > 0) {
          const existingUserId = existingAssociations[0].user_id
          if (existingUserId !== user.id) {
            console.log(`⚠️ Account ${linkedInAccount.id} already associated with user ${existingUserId}, updating to current user ${user.id}`)
          }
        }
        
        // Store the association (will update if already exists due to UPSERT)
        const associationStored = await storeUserAccountAssociation(supabase, user.id, linkedInAccount)
        if (associationStored) {
          userAccountIds.add(linkedInAccount.id)
          await upsertWorkspaceAccount(supabase, workspaceId, user.id, linkedInAccount)
          console.log(`✅ Successfully auto-associated LinkedIn account for user ${user.email}`)
        } else {
          console.log(`❌ Failed to store association for ${linkedInAccount.id}`)
        }
      } else if (accountDomainMatches && userDomain && possibleEmails.length > 0) {
        console.log(`🔍 Domain match found but no exact email match - manual association may be needed`)
        console.log(`🔍 Consider: Account emails ${possibleEmails.join(', ')} vs user ${userEmailLower}`)
      }
    }

    // Filter to only show accounts that belong to this user's workspace
    const userLinkedInAccounts = allAccounts.filter((account: any) =>
      account.type === 'LINKEDIN' && userAccountIds.has(account.id)
    )

    // Enhanced logging for workspace-specific accounts only
    console.log(`LinkedIn accounts for user ${user.email} in workspace ${workspaceId}:`, {
      user_linkedin_count: userLinkedInAccounts.length,
      user_accounts: userLinkedInAccounts.map(acc => ({
        id: acc.id,
        name: acc.name,
        username: acc.connection_params?.im?.username || acc.connection_params?.email,
        status: acc.sources?.map(s => s.status) || [],
        created: acc.created_at
      }))
    })

    // Check if this user has LinkedIn accounts that are running
    const hasLinkedIn = userLinkedInAccounts.some((account: any) => 
      account.sources?.some((source: any) => 
        source.status === 'OK' || source.status === 'CREDENTIALS'
      )
    )

    // 🔒 SECURITY: Only return connection status for user's own accounts
    console.log(`📊 Final result for ${user.email}:`, {
      has_linkedin: hasLinkedIn,
      user_linkedin_accounts: userLinkedInAccounts.length,
      connection_status: hasLinkedIn ? 'connected' : 'not_connected'
    })

    return NextResponse.json({
      success: true,
      has_linkedin: hasLinkedIn,
      connection_status: hasLinkedIn ? 'connected' : 'not_connected',
      message: hasLinkedIn ? 'LinkedIn integration is available' : 'LinkedIn connection required',
      user_account_count: userLinkedInAccounts.length,
      // Add the actual account data for the LinkedInLimitsInfobox component
      accounts: userLinkedInAccounts,
      debug_info: {
        total_accounts_in_unipile: allAccounts.length,
        linkedin_accounts_in_unipile: allLinkedInAccounts.length,
        user_associations_count: userAccountIds.size,
        auto_association_attempted: true,
        current_workspace_id: workspaceId
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Unipile connection status check error:', error)
    
    // Enhanced error response for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isCredentialsError = errorMessage.includes('credentials not configured') || 
                               errorMessage.includes('401') || 
                               errorMessage.includes('403')
    
    return NextResponse.json({
      success: false,
      has_linkedin: false,
      connection_status: 'error',
      error: isCredentialsError ? 
        'Unipile integration not configured. Please check environment variables.' : 
        errorMessage,
      debug_info: {
        error_message: errorMessage,
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        has_dsn: !!process.env.UNIPILE_DSN,
        has_api_key: !!process.env.UNIPILE_API_KEY,
        environment: process.env.NODE_ENV || 'unknown'
      },
      timestamp: new Date().toISOString()
    }, { status: isCredentialsError ? 503 : 500 })
  }
}

// POST method for account reconnection
export async function POST(request: NextRequest) {
  try {
    // Authenticate user first
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          }
        }
      }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required to connect LinkedIn account',
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }

    console.log(`👤 User ${user.email} (${user.id}) attempting LinkedIn connection`)

    const body = await request.json()
    const { action, account_id, linkedin_credentials, captcha_response } = body
    
    if (action === 'manual_associate') {
      // Manual association for existing Unipile LinkedIn account to SAM AI user
      console.log(`🔗 Manual association requested for user ${user.email}`)
      
      const { unipile_account_id } = body
      
      if (!unipile_account_id) {
        return NextResponse.json({
          success: false,
          error: 'unipile_account_id is required for manual association',
          timestamp: new Date().toISOString()
        }, { status: 400 })
      }
      
      // Get the account details from Unipile
      const allAccountsData = await callUnipileAPI('accounts')
      const allAccounts = Array.isArray(allAccountsData) ? allAccountsData : (allAccountsData.items || allAccountsData.accounts || [])
      const targetAccount = allAccounts.find(acc => acc.id === unipile_account_id)
      
      if (!targetAccount) {
        return NextResponse.json({
          success: false,
          error: 'LinkedIn account not found in Unipile',
          timestamp: new Date().toISOString()
        }, { status: 404 })
      }
      
      // Check if association already exists
      const { data: existingAssociation, error: checkError } = await supabase
        .from('user_unipile_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('unipile_account_id', unipile_account_id)
        .single()

      if (existingAssociation) {
        return NextResponse.json({
          success: true,
          message: 'LinkedIn account already associated',
          association: existingAssociation,
          timestamp: new Date().toISOString()
        })
      }

      // Store the association using the helper function
      const associationStored = await storeUserAccountAssociation(supabase, user.id, targetAccount)
      
      if (!associationStored) {
        return NextResponse.json({
          success: false,
          error: 'Failed to create association',
          timestamp: new Date().toISOString()
        }, { status: 500 })
      }

      await upsertWorkspaceAccount(supabase, workspaceId, user.id, targetAccount)

      console.log(`✅ Successfully associated LinkedIn account ${targetAccount.name} with user ${user.email}`)

      return NextResponse.json({
        success: true,
        message: 'LinkedIn account successfully associated',
        has_linkedin: true,
        account_details: {
          account_id: unipile_account_id,
          account_name: targetAccount.name,
          platform: 'LINKEDIN',
          status: 'active'
        },
        timestamp: new Date().toISOString()
      })
    }
    
    // Removed hardcoded SQL association method - use generic manual_associate instead
    
    if (action === 'complete_captcha' && account_id && captcha_response) {
      // Complete CAPTCHA challenge for existing account
      console.log('Completing CAPTCHA challenge for account:', { account_id, has_response: !!captcha_response })
      
      const result = await callUnipileAPI(`accounts/${account_id}/challenges/captcha`, 'POST', {
        captcha_response: captcha_response
      })
      
      return NextResponse.json({
        success: true,
        action: 'captcha_completed',
        account: result,
        message: 'CAPTCHA challenge completed successfully',
        timestamp: new Date().toISOString()
      })
    }
    
    if (action === 'reconnect' && account_id) {
      // Use Unipile's reconnect functionality for existing accounts
      const result = await callUnipileAPI(`accounts/${account_id}/reconnect`, 'POST', {
        credentials: linkedin_credentials
      })
      
      return NextResponse.json({
        success: true,
        action: 'reconnected',
        account: result,
        timestamp: new Date().toISOString()
      })
    }
    
    if (action === 'create') {
      // First, check for existing LinkedIn accounts to prevent duplicates
      console.log(`🔍 Checking for existing LinkedIn accounts before creating new one for ${linkedin_credentials.username}`)
      const existingData = await callUnipileAPI('accounts')
      const existingAccounts = Array.isArray(existingData) ? existingData : (existingData.items || existingData.accounts || [])
      const existingLinkedIn = existingAccounts.filter(account => account.type === 'LINKEDIN')
      
      console.log(`📊 Found ${existingLinkedIn.length} existing LinkedIn accounts in Unipile`)
      
      // Check for exact duplicate accounts by username/email
      const duplicateAccount = existingLinkedIn.find(acc => {
        const accUsername = acc.connection_params?.im?.username?.toLowerCase()
        const accEmail = acc.connection_params?.email?.toLowerCase()
        const targetUsername = linkedin_credentials.username?.toLowerCase()
        
        return accUsername === targetUsername || accEmail === targetUsername
      })
      
      if (duplicateAccount) {
        console.log(`🔄 Found existing account ${duplicateAccount.id} for ${linkedin_credentials.username} - using reconnect instead of create`)
        
        // Store user association if not already associated
        const { data: existingAssociation } = await supabase
          .from('user_unipile_accounts')
          .select('unipile_account_id')
          .eq('user_id', user.id)
          .eq('unipile_account_id', duplicateAccount.id)
          .single()
        
        if (!existingAssociation) {
          console.log(`🔗 Storing association for existing account ${duplicateAccount.id}`)
          await storeUserAccountAssociation(supabase, user.id, duplicateAccount)
          await upsertWorkspaceAccount(supabase, workspaceId, user.id, duplicateAccount)
        }
        
        try {
          // Use Unipile's reconnect functionality for existing accounts
          const reconnectResult = await callUnipileAPI(`accounts/${duplicateAccount.id}/reconnect`, 'POST', {
            credentials: linkedin_credentials
          })
          
          return NextResponse.json({
            success: true,
            action: 'reconnected',
            account: reconnectResult,
            message: 'LinkedIn account reconnected successfully (prevented duplicate)',
            account_id: duplicateAccount.id,
            timestamp: new Date().toISOString()
          })
        } catch (reconnectError) {
          console.log(`⚠️ Reconnect failed for ${duplicateAccount.id}, trying fresh connection`)
          // If reconnect fails, we might need to delete the old account and create fresh
          try {
            await callUnipileAPI(`accounts/${duplicateAccount.id}`, 'DELETE')
            console.log(`🗑️ Deleted problematic duplicate account ${duplicateAccount.id}`)
          } catch (deleteError) {
            console.error(`Failed to delete problematic account:`, deleteError)
          }
          // Continue to create new account below
        }
      }
      
      // Find and clean up any additional duplicates by same username
      const additionalDuplicates = existingLinkedIn.filter(acc => {
        const accUsername = acc.connection_params?.im?.username?.toLowerCase()
        const targetUsername = linkedin_credentials.username?.toLowerCase()
        return accUsername === targetUsername && acc.id !== duplicateAccount?.id
      })
      
      if (additionalDuplicates.length > 0) {
        console.log(`🧹 Found ${additionalDuplicates.length} additional duplicates to clean up`)
        for (const duplicate of additionalDuplicates) {
          try {
            await callUnipileAPI(`accounts/${duplicate.id}`, 'DELETE')
            console.log(`🗑️ Deleted additional duplicate: ${duplicate.id}`)
          } catch (error) {
            console.error(`Failed to delete duplicate ${duplicate.id}:`, error)
          }
        }
      }
      
      // Create new account if none exists
      console.log('Creating new LinkedIn account with credentials:', {
        username: linkedin_credentials.username,
        hasPassword: !!linkedin_credentials.password,
        has2FA: !!linkedin_credentials.twoFaCode
      })
      
      const result = await callUnipileAPI('accounts', 'POST', {
        provider: 'LINKEDIN',
        username: linkedin_credentials.username,
        password: linkedin_credentials.password,
        // Include 2FA code if provided
        ...(linkedin_credentials.twoFaCode && { twoFaCode: linkedin_credentials.twoFaCode }),
        // Include CAPTCHA response if provided
        ...(linkedin_credentials.captchaResponse && { captcha_response: linkedin_credentials.captchaResponse })
      })
      
      // Enhanced logging to debug 2FA response
      console.log('Unipile account creation response:', {
        hasAccount: !!result,
        resultKeys: result ? Object.keys(result) : [],
        status: result?.status,
        requires2FA: result?.requires_2fa || result?.requires2fa,
        account_id: result?.id,
        full_result: result
      })

      // Check for checkpoint requirements (CAPTCHA, 2FA, etc.)
      if (result?.object === 'Checkpoint') {
        const checkpointType = result.checkpoint?.type
        console.log('LinkedIn checkpoint detected:', {
          type: checkpointType,
          account_id: result.account_id
        })

        if (checkpointType === 'CAPTCHA') {
          return NextResponse.json({
            success: false,
            error: 'LinkedIn requires CAPTCHA verification. Please complete the verification.',
            requires_captcha: true,
            checkpoint_type: checkpointType,
            account_id: result.account_id,
            captcha_data: {
              public_key: result.checkpoint.public_key,
              data: result.checkpoint.data
            },
            timestamp: new Date().toISOString()
          }, { status: 422 })
        } else if (checkpointType === '2FA' || checkpointType === 'two_factor' || checkpointType === 'IN_APP_VALIDATION') {
          return NextResponse.json({
            success: false,
            error: 'LinkedIn requires 2-factor authentication. Please complete the verification.',
            requires_2fa: true,
            checkpoint_type: checkpointType,
            account_id: result.account_id,
            timestamp: new Date().toISOString()
          }, { status: 422 })
        } else {
          return NextResponse.json({
            success: false,
            error: `LinkedIn requires additional verification: ${checkpointType}. Please contact support.`,
            requires_verification: true,
            checkpoint_type: checkpointType,
            account_id: result.account_id,
            timestamp: new Date().toISOString()
          }, { status: 422 })
        }
      }
      
      // Immediate auto-cleanup: Check for duplicates after creation
      setTimeout(async () => {
        try {
          const updatedData = await callUnipileAPI('accounts')
          const updatedAccounts = Array.isArray(updatedData) ? updatedData : (updatedData.items || updatedData.accounts || [])
          const duplicates = findDuplicateLinkedInAccounts(updatedAccounts)
          
          if (duplicates.length > 0) {
            console.log(`Auto-cleanup: Found ${duplicates.length} duplicates after account creation - cleaning immediately`)
            for (const duplicate of duplicates) {
              try {
                await callUnipileAPI(`accounts/${duplicate.id}`, 'DELETE')
                console.log(`Auto-deleted duplicate: ${duplicate.id}`)
              } catch (error) {
                console.error(`Auto-cleanup failed for ${duplicate.id}:`, error)
              }
            }
          }
        } catch (error) {
          console.error('Auto-cleanup error:', error)
        }
      }, 1000) // 1 second delay for immediate auto-cleanup
      
      // Store user account association
      console.log(`🔗 Storing association for user ${user.email} and account ${result.id}`)
      const associationStored = await storeUserAccountAssociation(supabase, user.id, result)
      
      if (!associationStored) {
        console.error(`❌ Failed to store association for user ${user.email} and account ${result.id}`)
        // Still return success for the account creation, but note the association failure
      } else {
        console.log(`✅ Successfully stored association for user ${user.email} and account ${result.id}`)
        await upsertWorkspaceAccount(supabase, workspaceId, user.id, result)
      }
      
      return NextResponse.json({
        success: true,
        action: 'created',
        account: result,
        auto_cleanup_scheduled: true,
        user_association_stored: associationStored,
        association_warning: !associationStored ? 'Account created but association failed - may need manual setup' : null,
        timestamp: new Date().toISOString()
      })
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid action. Use "reconnect", "create", or "complete_captcha"',
      timestamp: new Date().toISOString()
    }, { status: 400 })
    
  } catch (error) {
    console.error('Unipile account operation error:', error)
    
    // Check if error indicates 2FA is required
    const errorMessage = error instanceof Error ? error.message : 'Account operation failed'
    let statusCode = 500
    let requires2FA = false
    let requiresCaptcha = false
    
    // Detect specific error types
    if (errorMessage.includes('2FA') || 
        errorMessage.includes('two-factor') || 
        errorMessage.includes('verification') ||
        errorMessage.includes('challenge') ||
        errorMessage.includes('authenticate')) {
      statusCode = 422 // Unprocessable Entity - indicates 2FA needed
      requires2FA = true
    } else if (errorMessage.includes('captcha') || errorMessage.includes('CAPTCHA')) {
      statusCode = 422
      requiresCaptcha = true
    } else if (errorMessage.includes('credentials not configured') || 
               errorMessage.includes('401') || 
               errorMessage.includes('403')) {
      statusCode = 503 // Service Unavailable - configuration issue
    }
    
    return NextResponse.json({
      success: false,
      error: statusCode === 503 ? 
        'Unipile integration not configured. Please check environment variables.' : 
        errorMessage,
      requires_2fa: requires2FA,
      requires_captcha: requiresCaptcha,
      debug_info: {
        error_message: errorMessage,
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        has_dsn: !!process.env.UNIPILE_DSN,
        has_api_key: !!process.env.UNIPILE_API_KEY,
        environment: process.env.NODE_ENV || 'unknown'
      },
      timestamp: new Date().toISOString()
    }, { status: statusCode })
  }
}

// DELETE method for removing specific accounts
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { account_id } = body
    
    if (!account_id) {
      return NextResponse.json({
        success: false,
        error: 'account_id is required',
        timestamp: new Date().toISOString()
      }, { status: 400 })
    }
    
    // Delete the account using Unipile API
    await callUnipileAPI(`accounts/${account_id}`, 'DELETE')
    
    return NextResponse.json({
      success: true,
      action: 'deleted',
      account_id: account_id,
      note: 'Account deleted - this action is invoiced if deleted directly',
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Unipile account deletion error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Account deletion failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
