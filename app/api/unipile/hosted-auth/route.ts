import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Utility to clean corrupted cookie values
function cleanCookieValue(value: string): string {
  if (!value) return value;
  
  // If value starts with "base64-", it's corrupted - remove prefix
  if (value.startsWith('base64-')) {
    try {
      const base64Value = value.substring(7);
      const decoded = Buffer.from(base64Value, 'base64').toString('utf-8');
      console.log('🔧 Fixed corrupted server-side cookie (decoded base64)');
      return decoded;
    } catch (e) {
      console.log('🔧 Fixed corrupted server-side cookie (removed prefix)');
      return value.substring(7);
    }
  }
  
  return value;
}

// Helper function to check existing LinkedIn accounts for user
async function checkExistingLinkedInAccounts(userId: string) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    const { data, error } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'LINKEDIN')
      .eq('connection_status', 'active')
    
    if (error) {
      console.error('Error checking existing LinkedIn accounts:', error)
      return []
    }
    
    return data || []
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
    
    // Authenticate user first with cleaned cookies
    const cookieStore = await cookies()
    
    // Clean corrupted cookies
    const cleanedCookies = () => {
      const originalCookies = cookieStore.getAll()
      return {
        getAll: () => originalCookies.map(cookie => ({
          ...cookie,
          value: cleanCookieValue(cookie.value)
        })),
        get: (name: string) => {
          const cookie = cookieStore.get(name)
          if (!cookie) return undefined
          return {
            ...cookie,
            value: cleanCookieValue(cookie.value)
          }
        },
        set: cookieStore.set,
        delete: cookieStore.delete
      }
    }
    
    const supabase = createRouteHandlerClient({ cookies: cleanedCookies })
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    console.log('🔍 Auth check:', { 
      hasSession: !!session, 
      hasUser: !!session?.user,
      userId: session?.user?.id,
      authError: authError?.message 
    })
    
    if (authError || !session || !session.user) {
      console.error('❌ Authentication failed:', authError)
      return NextResponse.json({
        success: false,
        error: 'Authentication required to generate hosted auth link',
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }

    const user = session.user

    console.log(`🔗 User ${user.email} (${user.id}) requesting hosted auth link`)

    // Get workspace - try users table first, fall back to workspace_members
    let workspaceId: string | null = null
    
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('current_workspace_id')
        .eq('id', user.id)
        .maybeSingle()
      
      if (profile?.current_workspace_id) {
        workspaceId = profile.current_workspace_id
        console.log('✅ Workspace from users table:', workspaceId)
      }
    } catch (userTableError) {
      console.log('⚠️ Users table not available, using fallback')
    }
    
    if (!workspaceId) {
      try {
        // Fallback: get first workspace from memberships
        const { data: memberships } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle()

        if (memberships?.workspace_id) {
          workspaceId = memberships.workspace_id
          console.log('✅ Workspace from memberships:', workspaceId)
        }
      } catch (membershipError) {
        console.error('❌ Failed to get workspace from memberships:', membershipError)
      }
    }

    if (!workspaceId) {
      // CRITICAL: User has no workspace - must fail here
      console.error(`🚨 CRITICAL: User ${user.id} (${user.email}) has no workspace_id. Cannot connect account without workspace.`)
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
      const { data: userProfile } = await supabase
        .from('users')
        .select('profile_country')
        .eq('id', user.id)
        .maybeSingle()
      
      userCountry = userProfile?.profile_country || null
      console.log('📍 User profile country:', userCountry)
    } catch (error) {
      console.log('⚠️ Could not fetch user profile country:', error)
    }
    
    // Check if user already has LinkedIn accounts to prevent duplicates (LinkedIn only)
    let existingAccounts: any[] = []
    let authType = 'create'
    let reconnectAccountId = null
    
    if (provider === 'LINKEDIN') {
      existingAccounts = await checkExistingLinkedInAccounts(user.id)
      console.log(`📊 User has ${existingAccounts.length} existing LinkedIn accounts`)
      
      // If user has existing accounts, use reconnect flow instead of create
      authType = existingAccounts.length > 0 ? 'reconnect' : 'create'
      reconnectAccountId = existingAccounts.length > 0 ? existingAccounts[0].unipile_account_id : null
    } else if (provider === 'GOOGLE' || provider === 'OUTLOOK') {
      console.log(`📧 Email provider (${provider}) - using create flow for messaging`)
      authType = 'create'
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
      user_id: user.id,
      user_email: user.email,
      workspace_id: workspaceId
    }
    const encodedContext = encodeURIComponent(JSON.stringify(userContextPayload))
    const successRedirectUrl = `${callbackUrl}?status=success&user_context=${encodedContext}`
    const failureRedirectUrl = `${callbackUrl}?status=error&user_context=${encodedContext}`
    const notifyUrl = `${callbackUrl}?user_context=${encodedContext}`
    
    console.log('🔧 Generating hosted auth link:', {
      provider,
      callbackUrl,
      userId: user.id,
      userEmail: user.email,
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
        // Show provider selection screen with Google, Outlook, and SMTP options
        hostedAuthPayload.providers = ['GOOGLE', 'OUTLOOK', 'SMTP']
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

  } catch (error) {
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
