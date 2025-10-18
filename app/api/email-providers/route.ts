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
    console.error(`Unipile API error: ${response.status} ${response.statusText}`, errorText)
    throw new Error(`Unipile API error: ${response.status} - ${errorText}`)
  }

  return await response.json()
}

export async function GET(request: NextRequest) {
  try {
    console.log('📧 GET /api/email-providers called')

    // Get current user with cleaned cookies
    const cookieStore = await cookies()
    
    // Clean corrupted cookies before passing to Supabase
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

    console.log('🔐 Auth check:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      authError: authError?.message
    })

    if (authError || !session || !session.user) {
      console.log('❌ Auth failed - returning 401')
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const user = session.user

    console.log('📧 Fetching email providers for user:', user.id)

    // Get user's current workspace - try users table first, then workspace_members
    let workspaceId: string | null = null

    const { data: userData } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()

    if (userData?.current_workspace_id) {
      workspaceId = userData.current_workspace_id
    } else {
      // Fallback: get workspace from workspace_members
      const { data: memberData } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      workspaceId = memberData?.workspace_id || null
    }

    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'No workspace found for user'
      }, { status: 400 })
    }

    console.log('🏢 Workspace ID:', workspaceId)

    // Get workspace email accounts directly from workspace_accounts
    const { data: workspaceAccounts, error: wsError } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('account_type', 'email')

    if (wsError) {
      console.error('❌ Workspace accounts error:', wsError)
    }

    console.log('💾 Found', workspaceAccounts?.length || 0, 'email accounts in workspace')

    const workspaceAccountIds = new Set(workspaceAccounts?.map(a => a.unipile_account_id) || [])
    console.log('🔑 Workspace account IDs:', Array.from(workspaceAccountIds))

    // Get all Unipile accounts
    const unipileResponse = await callUnipileAPI('accounts')
    const allAccounts = unipileResponse.items || []
    console.log('📊 Unipile returned', allAccounts.length, 'total accounts')

    // Filter to only show workspace email accounts
    const emailAccounts = allAccounts
      .filter((account: any) => {
        // Check if this account belongs to the workspace
        const belongsToWorkspace = workspaceAccountIds.has(account.id)
        console.log(`🔍 Account ${account.id} (${account.type}):`, belongsToWorkspace ? '✅ belongs to workspace' : '❌ not in workspace')

        if (!belongsToWorkspace) return false

        // Include GOOGLE, GOOGLE_OAUTH, OUTLOOK, OUTLOOK_OAUTH, and MESSAGING types
        const accountType = account.type?.toUpperCase() || ''
        const isEmailType = accountType.includes('GOOGLE') || accountType.includes('OUTLOOK') || accountType === 'MESSAGING'
        console.log(`  Type check: ${accountType} →`, isEmailType ? '✅ email type' : '❌ not email')

        return isEmailType
      })
      .map((account: any) => {
        const connectionParams = account.connection_params || {}
        const isConnected = account.sources?.some((source: any) => source.status === 'OK')

        // Determine provider type based on Unipile account type
        let providerType = 'email'
        const accountType = account.type?.toUpperCase() || ''
        if (accountType.includes('GOOGLE')) providerType = 'google'
        else if (accountType.includes('OUTLOOK')) providerType = 'microsoft'

        // Extract email from different OAuth formats
        const email = connectionParams.mail?.username ||
                     connectionParams.im?.email ||
                     connectionParams.email ||
                     account.name ||
                     ''

        return {
          id: account.id,
          user_id: user.id,
          provider_type: providerType,
          provider_name: account.name || email || 'Email Account',
          email_address: email,
          status: isConnected ? 'connected' : 'disconnected',
          config: account.connection_params,
          last_sync: account.updated_at,
          created_at: account.created_at,
          updated_at: account.updated_at
        }
      })

    console.log('✅ Returning', emailAccounts.length, 'email accounts')

    return NextResponse.json({
      success: true,
      providers: emailAccounts,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Failed to get email providers:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load email providers'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { provider_type, provider_name, email_address, config } = body

    if (!provider_type || !provider_name || !email_address) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: provider_type, provider_name, email_address'
      }, { status: 400 })
    }

    // Get current user - use the same pattern as GET route with cleaned cookies
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

    if (authError || !session || !session.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const user = session.user

    // Insert new email provider
    const { data: provider, error: insertError } = await supabase
      .from('email_providers')
      .insert({
        user_id: user.id,
        provider_type,
        provider_name,
        email_address,
        status: 'disconnected',
        config: config || {}
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Failed to create email provider:', insertError)
      return NextResponse.json({
        success: false,
        error: 'Failed to create provider'
      }, { status: 500 })
    }

    console.log(`✅ Created email provider: ${provider_type} (${email_address})`)

    return NextResponse.json({
      success: true,
      provider,
      message: 'Email provider created successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Failed to create email provider:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}