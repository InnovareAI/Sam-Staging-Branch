import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool } from '@/lib/auth'
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status'

// Helper function to check existing LinkedIn accounts for user
async function checkExistingLinkedInAccounts(userId: string) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM user_unipile_accounts
       WHERE user_id = $1 AND platform = 'LINKEDIN' AND connection_status = 'active'`,
      [userId]
    )
    return rows || []
  } catch (error) {
    console.error('Exception checking existing LinkedIn accounts:', error)
    return []
  }
}

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

// POST - Generate hosted auth link for LinkedIn
export async function POST(request: NextRequest) {
  try {
    console.log('🔑 POST /api/unipile/hosted-auth called')

    // Authenticate user using Firebase/Cloud SQL
    const { userId, userEmail, workspaceId } = await verifyAuth(request)

    console.log(`🔗 User ${userEmail} (${userId}) requesting hosted auth link`)

    // Verify workspace exists
    if (!workspaceId) {
      // CRITICAL: User has no workspace - must fail here
      console.error(`🚨 CRITICAL: User ${userId} (${userEmail}) has no workspace_id. Cannot connect account without workspace.`)
      return NextResponse.json({
        success: false,
        error: 'No workspace found for user. Please create or join a workspace first.',
        details: 'Account connections require a workspace context. Contact support if this error persists.',
        timestamp: new Date().toISOString()
      }, { status: 400 })
    }

    const body = await request.json()
    const { provider, type = 'API', redirect_url } = body

    console.log('📋 Request body:', { provider, type, redirect_url })

    // Get user's profile country for proxy assignment
    let userCountry: string | null = null
    try {
      const { rows } = await pool.query(
        'SELECT profile_country FROM users WHERE id = $1',
        [userId]
      )
      userCountry = rows[0]?.profile_country || null
      console.log('📍 User profile country:', userCountry)
    } catch (error) {
      console.log('⚠️ Could not fetch user profile country:', error)
    }

    // Check if user already has accounts to prevent duplicates
    // Per Unipile support: Use "reconnect" flow for existing accounts to prevent duplicates
    let existingAccounts: any[] = []
    let authType = 'create'
    let reconnectAccountId = null

    if (provider === 'LINKEDIN') {
      existingAccounts = await checkExistingLinkedInAccounts(userId)
      console.log(`📊 User has ${existingAccounts.length} existing LinkedIn accounts`)

      // If user has existing accounts, use reconnect flow instead of create
      authType = existingAccounts.length > 0 ? 'reconnect' : 'create'
      reconnectAccountId = existingAccounts.length > 0 ? existingAccounts[0].unipile_account_id : null
    } else if (provider === 'GOOGLE' || provider === 'OUTLOOK' || !provider) {
      // Check for existing email accounts
      try {
        const statusPlaceholders = VALID_CONNECTION_STATUSES.map((_, i) => `$${i + 3}`).join(', ')
        const { rows: emailAccounts } = await pool.query(
          `SELECT unipile_account_id FROM workspace_accounts
           WHERE workspace_id = $1 AND account_type = 'email' AND connection_status IN (${statusPlaceholders})`,
          [workspaceId, ...VALID_CONNECTION_STATUSES]
        )
        existingAccounts = emailAccounts || []
      } catch (emailQueryError) {
        console.error('❌ Error querying email accounts:', emailQueryError)
        existingAccounts = []
      }

      console.log(`📧 User has ${existingAccounts.length} existing email accounts`)

      // If user has existing email accounts, use reconnect flow
      authType = existingAccounts.length > 0 ? 'reconnect' : 'create'
      reconnectAccountId = existingAccounts.length > 0 ? existingAccounts[0].unipile_account_id : null
    } else {
      console.log(`⚠️ Unknown provider (${provider}) - using create flow`)
      authType = 'create'
    }

    // Get the current domain for callback URL
    // Always use correct production URL for LinkedIn authentication
    const origin = process.env.NODE_ENV === 'production'
      ? 'https://app.meet-sam.com'
      : (request.headers.get('origin') || 'http://localhost:3001')
    const callbackUrl = redirect_url || `${origin}/api/unipile/hosted-auth/callback`

    const userContextPayload = {
      user_id: userId,
      user_email: userEmail,
      workspace_id: workspaceId,
      close_popup: 'true' // Signal to close popup after processing
    }
    const encodedContext = encodeURIComponent(JSON.stringify(userContextPayload))
    const successRedirectUrl = `${callbackUrl}?status=success&user_context=${encodedContext}`
    const failureRedirectUrl = `${callbackUrl}?status=error&user_context=${encodedContext}`
    const notifyUrl = `${callbackUrl}?user_context=${encodedContext}`

    console.log('🔧 Generating hosted auth link:', {
      provider,
      callbackUrl,
      userId,
      userEmail,
      workspaceId
    })

    // Call Unipile's hosted auth API with create or reconnect flow
    // Generate proper expiration date (2 hours from now) in correct ISO format
    const expirationDate = new Date(Date.now() + 2 * 60 * 60 * 1000)
    const expiresOn = expirationDate.toISOString().replace(/\.\d{3}Z$/, '.000Z') // Ensure .000Z format

    // Map country names to Unipile's 2-letter country codes
    const countryCodeMap: { [key: string]: string } = {
      'argentina': 'ar', 'australia': 'au', 'austria': 'at', 'belgium': 'be',
      'brazil': 'br', 'bulgaria': 'bg', 'canada': 'ca', 'croatia': 'hr',
      'cyprus': 'cy', 'czechia': 'cz', 'czech republic': 'cz', 'denmark': 'dk',
      'france': 'fr', 'germany': 'de', 'hong kong': 'hk', 'india': 'in',
      'italy': 'it', 'japan': 'jp', 'mexico': 'mx', 'netherlands': 'nl',
      'norway': 'no', 'poland': 'pl', 'portugal': 'pt', 'romania': 'ro',
      'south africa': 'za', 'spain': 'es', 'sweden': 'se', 'switzerland': 'ch',
      'singapore': 'sg', 'turkey': 'tr', 'ukraine': 'ua', 'united arab emirates': 'ae',
      'uae': 'ae', 'united kingdom': 'gb', 'uk': 'gb', 'great britain': 'gb',
      'united states': 'us', 'usa': 'us', 'us': 'us', 'america': 'us'
    }

    // Determine proxy country code
    let proxyCountry: string | null = null
    if (userCountry) {
      const normalizedCountry = userCountry.toLowerCase().trim()
      proxyCountry = countryCodeMap[normalizedCountry] || null

      // If exact match not found, try partial match
      if (!proxyCountry) {
        for (const [key, value] of Object.entries(countryCodeMap)) {
          if (normalizedCountry.includes(key) || key.includes(normalizedCountry)) {
            proxyCountry = value
            break
          }
        }
      }

      console.log('🌍 Mapped country for proxy:', {
        userCountry,
        proxyCountry: proxyCountry || 'auto-detect from IP'
      })
    }

    let hostedAuthPayload: any = {
      type: authType,
      expiresOn: expiresOn,
      api_url: `https://${process.env.UNIPILE_DSN}`,
      success_redirect_url: successRedirectUrl,
      failure_redirect_url: failureRedirectUrl,
      notify_url: notifyUrl,
      name: JSON.stringify(userContextPayload),
      bypass_success_screen: true, // Skip success screen and redirect directly
      ...(proxyCountry && { proxy_country: proxyCountry }) // Add proxy country if available
    }

    if (authType === 'create') {
      // If provider is specified, use it. Otherwise, show Unipile's provider selection for email
      if (provider) {
        hostedAuthPayload.providers = [provider.toUpperCase()]
      } else {
        // Show provider selection screen with Google, Outlook, and MAIL (SMTP)
        // Per Unipile API: Use 'MAIL' not 'SMTP' for generic email/SMTP providers
        hostedAuthPayload.providers = ['GOOGLE', 'OUTLOOK', 'MAIL']
      }
    } else {
      hostedAuthPayload.reconnect_account = reconnectAccountId
    }

    console.log(`🔧 Using ${authType} flow for LinkedIn auth`, {
      authType,
      reconnectAccountId: authType === 'reconnect' ? reconnectAccountId : 'N/A'
    })

    const hostedAuthResponse = await callUnipileAPI('hosted/accounts/link', 'POST', hostedAuthPayload)

    console.log('✅ Hosted auth link generated:', {
      url: hostedAuthResponse.url?.substring(0, 100) + '...',
      object: hostedAuthResponse.object
    })

    // WHITE-LABEL: Custom domain for branded authentication experience
    // SSL certificate configured by Arnaud @ Unipile on 2025-10-01
    const whitelabeledAuthUrl = hostedAuthResponse.url?.replace(
      'https://account.unipile.com',
      'https://auth.meet-sam.com'
    ) || hostedAuthResponse.url

    return NextResponse.json({
      success: true,
      auth_url: whitelabeledAuthUrl, // Using custom branded domain auth.meet-sam.com
      session_id: null, // Unipile embeds session in URL, no separate session_id
      expires_at: null, // Not provided in response
      provider: provider,
      callback_url: callbackUrl,
      auth_type: authType, // Indicate if this is create or reconnect flow
      existing_accounts: existingAccounts.length,
      workspace_id: workspaceId,
      proxy_country: proxyCountry || 'auto-detect',
      user_country: userCountry,
      instructions: {
        step1: 'Click the auth_url to open LinkedIn authentication',
        step2: 'Complete LinkedIn login and authorization',
        step3: 'You will be redirected back to SAM AI automatically',
        step4: 'Your LinkedIn account will be connected and ready to use'
      },
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    // Handle auth errors
    if (error?.code === 'UNAUTHORIZED' || error?.code === 'FORBIDDEN' || error?.code === 'WORKSPACE_ACCESS_DENIED') {
      return NextResponse.json({
        success: false,
        error: error.message || 'Authentication required to generate hosted auth link',
        timestamp: new Date().toISOString()
      }, { status: error.statusCode || 401 })
    }

    console.error('Hosted auth link generation error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isCredentialsError = errorMessage.includes('credentials not configured') ||
                               errorMessage.includes('401') ||
                               errorMessage.includes('403')

    return NextResponse.json({
      success: false,
      error: isCredentialsError ?
        'LinkedIn integration not configured. Please check environment variables.' :
        'Failed to generate authentication link',
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
