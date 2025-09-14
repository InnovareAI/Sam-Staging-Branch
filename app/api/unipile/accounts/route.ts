import { NextRequest, NextResponse } from 'next/server'

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
    // Fetch accounts using helper function
    const data = await callUnipileAPI('accounts')
    const accounts = Array.isArray(data) ? data : (data.items || data.accounts || [])
    
    // Enhanced logging to debug account visibility
    const linkedInAccounts = accounts.filter(account => account.type === 'LINKEDIN')
    console.log('All LinkedIn accounts found:', {
      total_accounts: accounts.length,
      linkedin_count: linkedInAccounts.length,
      linkedin_accounts: linkedInAccounts.map(acc => ({
        id: acc.id,
        name: acc.name,
        username: acc.connection_params?.im?.username || acc.connection_params?.email,
        status: acc.sources?.map(s => s.status) || [],
        created: acc.created_at
      }))
    })

    // Check if ANY LinkedIn accounts exist and are running (system-wide check)
    const hasLinkedIn = accounts.some((account: any) => 
      account.type === 'LINKEDIN' && 
      account.sources?.some((source: any) => 
        source.status === 'OK' || source.status === 'CREDENTIALS'
      )
    )

    // SECURITY: Never expose actual account details to frontend
    // This is just a general system check - user-specific verification happens during connection
    return NextResponse.json({
      success: true,
      has_linkedin: hasLinkedIn,
      connection_status: hasLinkedIn ? 'connected' : 'not_connected',
      message: hasLinkedIn ? 'LinkedIn integration is available' : 'LinkedIn connection required',
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
        'Unable to verify LinkedIn connection status',
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
    const body = await request.json()
    const { action, account_id, linkedin_credentials, captcha_response } = body
    
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
      // First, check for existing LinkedIn accounts
      const existingData = await callUnipileAPI('accounts')
      const existingAccounts = Array.isArray(existingData) ? existingData : (existingData.items || existingData.accounts || [])
      const existingLinkedIn = existingAccounts.filter(account => account.type === 'LINKEDIN')
      
      // Check if user's LinkedIn credentials match any existing account for reconnect
      const matchingAccount = existingLinkedIn.find(acc => 
        acc.connection_params?.im?.username === linkedin_credentials.username ||
        acc.connection_params?.email === linkedin_credentials.username
      )
      
      if (matchingAccount) {
        // User has an existing account - use reconnect instead of create
        const reconnectResult = await callUnipileAPI(`accounts/${matchingAccount.id}/reconnect`, 'POST', {
          credentials: linkedin_credentials
        })
        
        return NextResponse.json({
          success: true,
          action: 'reconnected',
          account: reconnectResult,
          message: 'LinkedIn account reconnected successfully',
          timestamp: new Date().toISOString()
        })
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
      
      return NextResponse.json({
        success: true,
        action: 'created',
        account: result,
        auto_cleanup_scheduled: true,
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