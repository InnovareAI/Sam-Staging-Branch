import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
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
    // Get current user
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    if (authError || !session || !session.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const user = session.user

    // Get all Unipile accounts for the user
    const unipileResponse = await callUnipileAPI('accounts')
    const allAccounts = unipileResponse.items || []

    // Filter for email accounts (MESSAGING type) and get user's accounts from database
    const { data: userAccounts } = await supabase
      .from('user_unipile_accounts')
      .select('unipile_account_id, platform, account_email')
      .eq('user_id', user.id)

    const userAccountIds = new Set(userAccounts?.map(a => a.unipile_account_id) || [])

    // Filter to only show user's email accounts
    const emailAccounts = allAccounts
      .filter((account: any) => {
        // Check if this account belongs to the user
        if (!userAccountIds.has(account.id)) return false

        // Include GOOGLE, OUTLOOK, and MESSAGING types
        const accountType = account.type?.toUpperCase()
        return accountType === 'GOOGLE' || accountType === 'OUTLOOK' || accountType === 'MESSAGING'
      })
      .map((account: any) => {
        const connectionParams = account.connection_params?.im || account.connection_params || {}
        const isConnected = account.sources?.some((source: any) => source.status === 'OK')

        // Determine provider type based on Unipile account type
        let providerType = 'email'
        if (account.type === 'GOOGLE') providerType = 'google'
        else if (account.type === 'OUTLOOK') providerType = 'microsoft'

        return {
          id: account.id,
          user_id: user.id,
          provider_type: providerType,
          provider_name: account.name || connectionParams.email || 'Email Account',
          email_address: connectionParams.email || connectionParams.username || '',
          status: isConnected ? 'connected' : 'disconnected',
          config: account.connection_params,
          last_sync: account.updated_at,
          created_at: account.created_at,
          updated_at: account.updated_at
        }
      })

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

    const supabase = supabaseAdmin()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

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