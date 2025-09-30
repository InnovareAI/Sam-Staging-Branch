import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

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

  console.log(`🌐 Calling Unipile API: ${method} ${url}`)
  if (body) {
    console.log(`📤 Request body:`, JSON.stringify(body, null, 2))
  }

  const response = await fetch(url, options)
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error(`❌ Unipile API error: ${response.status} ${response.statusText}`, {
      url,
      method,
      body: body ? JSON.stringify(body, null, 2) : undefined,
      errorResponse: errorText
    })
    throw new Error(`Unipile API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const result = await response.json()
  console.log(`✅ Unipile API response:`, result)
  return result
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user first
    const cookieStore = await cookies()
    
    // Get auth token from cookies
    const accessToken = cookieStore.get('sb-access-token')?.value
    const refreshToken = cookieStore.get('sb-refresh-token')?.value
    
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required to generate LinkedIn auth link',
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      }
    )
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required to generate LinkedIn auth link',
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }
    console.log(`🔗 Generating hosted auth link for user ${user.email} (${user.id})`)

    // Get workspace - try users table first, fall back to workspace_members
    let workspaceId: string | null = null
    
    try {
      const { data: userProfile } = await supabase
        .from('users')
        .select('current_workspace_id')
        .eq('id', user.id)
        .maybeSingle()
      
      if (userProfile?.current_workspace_id) {
        workspaceId = userProfile.current_workspace_id
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
        console.log('⚠️ Workspace_members table error, using user ID')
      }
    }
    
    if (!workspaceId) {
      // Last resort: use user ID as workspace ID
      workspaceId = user.id
      console.log('⚠️ Using user ID as workspace ID:', workspaceId)
    }

    // Check for existing LinkedIn connections in this workspace
    const { data: existingConnections } = await supabase
      .from('integrations')
      .select('id, credentials, status')
      .eq('user_id', user.id)
      .eq('provider', 'linkedin')

    // ENHANCED: Also check Unipile for existing LinkedIn accounts to prevent duplicates
    let unipileLinkedInAccounts: any[] = []
    let hasUnipileAccounts = false
    try {
      const unipileAccountsResponse = await callUnipileAPI('accounts')
      const allUnipileAccounts = Array.isArray(unipileAccountsResponse) ? 
        unipileAccountsResponse : 
        (unipileAccountsResponse.items || unipileAccountsResponse.accounts || [])
      
      unipileLinkedInAccounts = allUnipileAccounts.filter((account: any) => account.type === 'LINKEDIN')
      hasUnipileAccounts = unipileLinkedInAccounts.length > 0
      
      console.log(`🔍 Found ${unipileLinkedInAccounts.length} LinkedIn accounts in Unipile for duplicate prevention`)
    } catch (error) {
      console.warn('⚠️ Could not check Unipile for existing accounts:', error instanceof Error ? error.message : 'Unknown error')
      // Continue with local database check only
    }

    // Force 'create' for now to avoid reconnection issues - let users create fresh accounts
    // TODO: Fix reconnection logic later for production
    let authAction = 'create'
    
    // For reconnect, we need to specify which account to reconnect
    let reconnectAccountId = null
    if (authAction === 'reconnect') {
      // Prefer local database associations first, then Unipile accounts
      if (existingConnections && existingConnections.length > 0) {
        reconnectAccountId = existingConnections[0].credentials?.unipile_account_id
      } else if (unipileLinkedInAccounts.length > 0) {
        reconnectAccountId = unipileLinkedInAccounts[0].id
      }
      
      // If no account ID found for reconnect, fall back to create
      if (!reconnectAccountId) {
        console.warn('⚠️ No account ID found for reconnect, falling back to create')
        authAction = 'create'
      } else {
        console.log(`🔗 Using reconnect_account: ${reconnectAccountId}`)
      }
    }
    
    console.log(`🔗 LinkedIn ${authAction} initiated - existing connections: ${existingConnections?.length || 0}`)

    // Generate workspace-specific user ID to prevent cross-workspace account leakage
    const workspaceUserId = `${workspaceId}:${user.id}`
    
    // Get the base URL for callbacks
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'
    const callbackUrl = `${siteUrl}/api/linkedin/callback`
    
    // Create hosted auth link via Unipile API following official documentation
    const expirationTime = new Date()
    expirationTime.setHours(expirationTime.getHours() + 1) // 1 hour from now
    
    // Base request properties
    const baseRequest = {
      type: authAction, // "create" or "reconnect"
      api_url: `https://${process.env.UNIPILE_DSN}`, // Your Unipile API endpoint
      expiresOn: expirationTime.toISOString(), // ISO 8601 timestamp
      success_redirect_url: `${siteUrl}/integrations/linkedin?status=success`,
      failure_redirect_url: `${siteUrl}/integrations/linkedin?status=failed`,
      notify_url: callbackUrl, // Webhook endpoint
      name: workspaceUserId // Internal user ID for account matching
    }
    
    // Add type-specific properties
    const hostedAuthRequest = authAction === 'reconnect' ? {
      ...baseRequest,
      reconnect_account: reconnectAccountId // Required for reconnect
    } : {
      ...baseRequest,
      providers: ['LINKEDIN'] // Required for create
    }

    console.log(`📋 Creating hosted auth link with request:`, hostedAuthRequest)

    const hostedAuthResponse = await callUnipileAPI('hosted/accounts/link', 'POST', hostedAuthRequest)
    
    // The response should contain the hosted auth link according to documentation
    const authUrl = hostedAuthResponse.link || hostedAuthResponse.url || hostedAuthResponse.auth_url
    
    if (!authUrl) {
      console.error('❌ No auth URL in response:', hostedAuthResponse)
      throw new Error('Hosted auth link not received from Unipile')
    }

    console.log(`✅ Generated hosted auth link for user ${user.email}`)
    console.log(`🔗 Auth URL: ${authUrl}`)

    return NextResponse.json({
      success: true,
      action: authAction,
      auth_url: authUrl,
      expires_in: 3600,
      existing_connections: existingConnections?.length || 0,
      existing_accounts: existingConnections?.map(conn => ({
        id: conn.id,
        unipile_account_id: conn.credentials?.unipile_account_id,
        account_identifier: conn.credentials?.account_email || conn.credentials?.linkedin_public_identifier,
        name: conn.credentials?.account_name,
        status: conn.status
      })) || [],
      workspace_id: workspaceId,
      callback_url: callbackUrl,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error generating hosted auth link:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate auth link'
    const isCredentialsError = errorMessage.includes('credentials not configured') || 
                               errorMessage.includes('401') || 
                               errorMessage.includes('403')
    
    return NextResponse.json({
      success: false,
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