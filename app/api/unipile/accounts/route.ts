import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool } from '@/lib/auth'

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
  userId: string,
  unipileAccount: any
) {
  try {
    console.log(`🔗 Starting association storage for user ${userId} and account ${unipileAccount.id}`)

    const connectionParams = unipileAccount.connection_params?.im || {}

    // Direct insert/upsert
    await pool.query(
      `INSERT INTO user_unipile_accounts
       (user_id, unipile_account_id, platform, account_name, account_email,
        linkedin_public_identifier, linkedin_profile_url, connection_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (unipile_account_id)
       DO UPDATE SET
         user_id = EXCLUDED.user_id,
         platform = EXCLUDED.platform,
         account_name = EXCLUDED.account_name,
         account_email = EXCLUDED.account_email,
         linkedin_public_identifier = EXCLUDED.linkedin_public_identifier,
         linkedin_profile_url = EXCLUDED.linkedin_profile_url,
         connection_status = EXCLUDED.connection_status,
         updated_at = NOW()`,
      [
        userId,
        unipileAccount.id,
        unipileAccount.type,
        unipileAccount.name,
        connectionParams.email || connectionParams.username,
        connectionParams.publicIdentifier,
        connectionParams.publicIdentifier ? `https://www.linkedin.com/in/${connectionParams.publicIdentifier}` : null,
        'active'
      ]
    )

    console.log(`✅ Stored user account association successfully:`, {
      userId,
      unipileAccountId: unipileAccount.id,
      accountName: unipileAccount.name,
      platform: unipileAccount.type
    })

    return true
  } catch (error) {
    console.error('💥 Exception in storing user account association:', error)
    return false
  }
}

async function upsertWorkspaceAccount(
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

  try {
    await pool.query(
      `INSERT INTO workspace_accounts
       (workspace_id, user_id, account_type, account_identifier, account_name,
        unipile_account_id, connection_status, is_active, account_metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (workspace_id, user_id, account_type, account_identifier)
       DO UPDATE SET
         unipile_account_id = EXCLUDED.unipile_account_id,
         connection_status = EXCLUDED.connection_status,
         is_active = EXCLUDED.is_active,
         account_metadata = EXCLUDED.account_metadata,
         updated_at = NOW()`,
      [
        workspaceId,
        userId,
        'linkedin',
        accountIdentifier,
        unipileAccount.name || connectionParams.publicIdentifier || accountIdentifier,
        unipileAccount.id,
        connectionStatus,
        true,
        JSON.stringify({
          unipile_instance: process.env.UNIPILE_DSN || null,
          product_type: unipileAccount.connection_params?.product_type || null
        })
      ]
    )
  } catch (error) {
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
      accounts.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      duplicates.push(...accounts.slice(1)) // All except the first (most recent)
    }
  }

  return duplicates
}

export async function GET(request: NextRequest) {
  try {
    // 🚨 SECURITY: Get user authentication for workspace filtering
    const { userId, userEmail, workspaceId } = await verifyAuth(request)

    // Get user's current workspace - use user ID as fallback if no workspace table
    const userEmailLower = userEmail?.toLowerCase() || ''
    const isInnovareAIManager = ['tl@innovareai.com', 'cl@innovareai.com', 'cs@innovareai.com', 'thorsten@innovareai.com', 'thorsten.linz@gmail.com'].includes(userEmailLower)
    const requestedWorkspaceId = request.nextUrl.searchParams.get('workspace_id')

    // Use workspaceId from auth, with fallback to requested workspace for managers
    let effectiveWorkspaceId = workspaceId
    if (!effectiveWorkspaceId && isInnovareAIManager && requestedWorkspaceId) {
      effectiveWorkspaceId = requestedWorkspaceId
    }

    console.log(`🔍 Debug: User ${userEmail} workspace:`, {
      user_id: userId,
      workspace_id: effectiveWorkspaceId
    })

    console.log(`🔍 User authentication check:`, {
      user_id: userId,
      user_email: userEmailLower,
      is_innovareai_manager: isInnovareAIManager,
      workspace_id: effectiveWorkspaceId
    })

    console.log(`✅ User ${userEmail} access granted for workspace ${effectiveWorkspaceId}`)

    // Fetch ALL accounts from Unipile (we'll filter by user associations)
    const data = await callUnipileAPI('accounts')
    const allAccounts = Array.isArray(data) ? data : (data.items || data.accounts || [])

    // No hardcoded user-specific logic - auto-association now handles all users generically

    // 🛡️ SECURITY: Get user's associated accounts from BOTH sources:
    // 1. user_unipile_accounts table (legacy)
    // 2. workspace_members.linkedin_unipile_account_id (new, preferred)
    const { rows: userAccounts } = await pool.query(
      `SELECT unipile_account_id, platform, account_name, account_email, linkedin_profile_url
       FROM user_unipile_accounts
       WHERE user_id = $1`,
      [userId]
    )

    // Also check workspace_members for linkedin_unipile_account_id
    const { rows: workspaceMembership } = await pool.query(
      `SELECT linkedin_unipile_account_id
       FROM workspace_members
       WHERE user_id = $1 AND linkedin_unipile_account_id IS NOT NULL`,
      [userId]
    )

    const userAccountIds = new Set(userAccounts?.map(acc => acc.unipile_account_id) || [])

    // Add workspace_members linkedin IDs to the set
    workspaceMembership?.forEach(m => {
      if (m.linkedin_unipile_account_id) {
        userAccountIds.add(m.linkedin_unipile_account_id)
        console.log(`🔗 Added linkedin_unipile_account_id from workspace_members: ${m.linkedin_unipile_account_id}`)
      }
    })

    // 🔄 AUTO-ASSOCIATE: Check for LinkedIn accounts that belong to this user but aren't associated yet
    const allLinkedInAccounts = allAccounts.filter((account: any) => account.type === 'LINKEDIN')

    console.log(`🔍 Auto-association check for ${userEmail}:`, {
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
        console.log(`🔗 Auto-associating LinkedIn account ${linkedInAccount.id} with user ${userEmail} (${associationType})`)

        // Check for existing associations of this account to other users (duplicate prevention)
        const { rows: existingAssociations } = await pool.query(
          `SELECT user_id FROM user_unipile_accounts WHERE unipile_account_id = $1`,
          [linkedInAccount.id]
        )

        if (existingAssociations && existingAssociations.length > 0) {
          const existingUserId = existingAssociations[0].user_id
          if (existingUserId !== userId) {
            console.log(`⚠️ Account ${linkedInAccount.id} already associated with user ${existingUserId}, updating to current user ${userId}`)
          }
        }

        // Store the association (will update if already exists due to UPSERT)
        const associationStored = await storeUserAccountAssociation(userId, linkedInAccount)
        if (associationStored) {
          userAccountIds.add(linkedInAccount.id)
          if (effectiveWorkspaceId) {
            await upsertWorkspaceAccount(effectiveWorkspaceId, userId, linkedInAccount)
          }
          console.log(`✅ Successfully auto-associated LinkedIn account for user ${userEmail}`)
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
    console.log(`LinkedIn accounts for user ${userEmail} in workspace ${effectiveWorkspaceId}:`, {
      user_linkedin_count: userLinkedInAccounts.length,
      user_accounts: userLinkedInAccounts.map((acc: any) => ({
        id: acc.id,
        name: acc.name,
        username: acc.connection_params?.im?.username || acc.connection_params?.email,
        status: acc.sources?.map((s: any) => s.status) || [],
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
    console.log(`📊 Final result for ${userEmail}:`, {
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
        current_workspace_id: effectiveWorkspaceId
      },
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    // Handle auth errors
    if (error?.code === 'UNAUTHORIZED' || error?.code === 'FORBIDDEN' || error?.code === 'WORKSPACE_ACCESS_DENIED') {
      console.log('🔐 Authentication check failed:', {
        errorCode: error.code,
        errorMessage: error.message,
        timestamp: new Date().toISOString()
      })
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        debug_info: {
          auth_error: error.message,
          needs_signin: true
        }
      }, { status: error.statusCode || 401 })
    }

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
    // Authenticate user using Firebase/Cloud SQL
    const { userId, userEmail, workspaceId } = await verifyAuth(request)

    console.log(`👤 User ${userEmail} (${userId}) attempting LinkedIn connection`)

    const body = await request.json()
    const {
      action,
      account_id,
      linkedin_credentials,
      captcha_response,
      provider,
      username,
      password,
      host,
      port,
      use_tls,
      use_ssl
    } = body

    // IMAP/SMTP account creation (email provider)
    if (provider === 'SMTP' || provider === 'IMAP' || provider === 'MAIL') {
      console.log('📧 Creating email account in Unipile via IMAP...')
      console.log('   Credentials check:', {
        hasUsername: !!username,
        hasPassword: !!password,
        hasHost: !!host,
        hasPort: !!port,
        use_tls,
        use_ssl
      })
      console.log('   Environment check:', {
        hasDsn: !!process.env.UNIPILE_DSN,
        hasApiKey: !!process.env.UNIPILE_API_KEY
      })

      if (!username || !password || !host || !port) {
        return NextResponse.json({
          success: false,
          error: 'Missing required email fields: username, password, host, port',
          timestamp: new Date().toISOString()
        }, { status: 400 })
      }

      try {
        // Unipile uses IMAP provider for custom email accounts (IMAP for receiving, SMTP for sending)
        // Note: Unipile requires BOTH imap and smtp configuration
        const payload = {
          provider: 'MAIL',
          imap_user: username,
          imap_password: password,
          imap_host: host,
          imap_port: parseInt(port),
          imap_encryption: use_ssl ? 'ssl' : (use_tls ? 'tls' : 'none'),
          smtp_user: username,
          smtp_password: password,
          smtp_host: host,
          smtp_port: parseInt(port),
          sync_limit: 'NO_HISTORY_SYNC'
        }

        console.log('📨 Sending MAIL account payload to Unipile:', {
          provider: payload.provider,
          imap_host: payload.imap_host,
          imap_port: payload.imap_port,
          imap_encryption: payload.imap_encryption,
          smtp_port: payload.smtp_port,
          hasPasswords: !!payload.imap_password && !!payload.smtp_password
        })

        const emailResult = await callUnipileAPI('accounts', 'POST', payload)

        console.log('✅ Email account created in Unipile:', emailResult.id)

        return NextResponse.json({
          success: true,
          action: 'created_email',
          account_id: emailResult.id,
          account: emailResult,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        console.error('❌ Failed to create email account:', {
          error: error instanceof Error ? error.message : String(error),
          errorType: error instanceof Error ? error.constructor.name : typeof error
        })
        throw error
      }
    }

    if (action === 'manual_associate') {
      // Manual association for existing Unipile LinkedIn account to SAM AI user
      console.log(`🔗 Manual association requested for user ${userEmail}`)

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
      const targetAccount = allAccounts.find((acc: any) => acc.id === unipile_account_id)

      if (!targetAccount) {
        return NextResponse.json({
          success: false,
          error: 'LinkedIn account not found in Unipile',
          timestamp: new Date().toISOString()
        }, { status: 404 })
      }

      // Check if association already exists
      const { rows: existingAssociations } = await pool.query(
        `SELECT * FROM user_unipile_accounts
         WHERE user_id = $1 AND unipile_account_id = $2`,
        [userId, unipile_account_id]
      )

      if (existingAssociations && existingAssociations.length > 0) {
        return NextResponse.json({
          success: true,
          message: 'LinkedIn account already associated',
          association: existingAssociations[0],
          timestamp: new Date().toISOString()
        })
      }

      // Store the association using the helper function
      const associationStored = await storeUserAccountAssociation(userId, targetAccount)

      if (!associationStored) {
        return NextResponse.json({
          success: false,
          error: 'Failed to create association',
          timestamp: new Date().toISOString()
        }, { status: 500 })
      }

      if (workspaceId) {
        await upsertWorkspaceAccount(workspaceId, userId, targetAccount)
      }

      console.log(`✅ Successfully associated LinkedIn account ${targetAccount.name} with user ${userEmail}`)

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
      const existingLinkedIn = existingAccounts.filter((account: any) => account.type === 'LINKEDIN')

      console.log(`📊 Found ${existingLinkedIn.length} existing LinkedIn accounts in Unipile`)

      // Check for exact duplicate accounts by username/email
      const duplicateAccount = existingLinkedIn.find((acc: any) => {
        const accUsername = acc.connection_params?.im?.username?.toLowerCase()
        const accEmail = acc.connection_params?.email?.toLowerCase()
        const targetUsername = linkedin_credentials.username?.toLowerCase()

        return accUsername === targetUsername || accEmail === targetUsername
      })

      if (duplicateAccount) {
        console.log(`🔄 Found existing account ${duplicateAccount.id} for ${linkedin_credentials.username} - using reconnect instead of create`)

        // Store user association if not already associated
        const { rows: existingAssociation } = await pool.query(
          `SELECT unipile_account_id FROM user_unipile_accounts
           WHERE user_id = $1 AND unipile_account_id = $2`,
          [userId, duplicateAccount.id]
        )

        if (!existingAssociation || existingAssociation.length === 0) {
          console.log(`🔗 Storing association for existing account ${duplicateAccount.id}`)
          await storeUserAccountAssociation(userId, duplicateAccount)
          if (workspaceId) {
            await upsertWorkspaceAccount(workspaceId, userId, duplicateAccount)
          }
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
      const additionalDuplicates = existingLinkedIn.filter((acc: any) => {
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
      console.log(`🔗 Storing association for user ${userEmail} and account ${result.id}`)
      const associationStored = await storeUserAccountAssociation(userId, result)

      if (!associationStored) {
        console.error(`❌ Failed to store association for user ${userEmail} and account ${result.id}`)
        // Still return success for the account creation, but note the association failure
      } else {
        console.log(`✅ Successfully stored association for user ${userEmail} and account ${result.id}`)
        if (workspaceId) {
          await upsertWorkspaceAccount(workspaceId, userId, result)
        }
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

  } catch (error: any) {
    // Handle auth errors
    if (error?.code === 'UNAUTHORIZED' || error?.code === 'FORBIDDEN' || error?.code === 'WORKSPACE_ACCESS_DENIED') {
      return NextResponse.json({
        success: false,
        error: 'Authentication required to connect LinkedIn account',
        timestamp: new Date().toISOString()
      }, { status: error.statusCode || 401 })
    }

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
        `Unipile API error: ${errorMessage}` :
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
