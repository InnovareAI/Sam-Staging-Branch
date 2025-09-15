import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// New LinkedIn connection API with reconnect vs create logic (prevents double logins)
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }

    console.log(`🔗 LinkedIn connection request from user: ${user.email}`)

    // CRITICAL: Check for existing LinkedIn connections first (prevents double login)
    const { data: existingConnections } = await supabase
      .from('user_unipile_accounts')
      .select('unipile_account_id, connection_status, account_name')
      .eq('user_id', user.id)
      .eq('platform', 'LINKEDIN')

    // Determine action: 'reconnect' for existing, 'create' for new
    const hasExistingConnection = existingConnections && existingConnections.length > 0
    const authAction = hasExistingConnection ? 'reconnect' : 'create'
    
    // Get Unipile configuration
    const unipileDsn = process.env.UNIPILE_DSN
    const unipileApiKey = process.env.UNIPILE_API_KEY

    if (!unipileDsn || !unipileApiKey) {
      return NextResponse.json({
        success: false,
        error: 'Unipile configuration missing',
        timestamp: new Date().toISOString()
      }, { status: 503 })
    }

    // Generate Unipile hosted auth URL with correct action
    const baseUrl = `https://${unipileDsn}/api/v1`
    const authUrl = `${baseUrl}/users/${user.id}/accounts/${authAction}`
    
    const params = new URLSearchParams({
      providers: 'LINKEDIN',
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/linkedin/callback`,
      user_id: user.id
    })

    console.log(`🔗 LinkedIn ${authAction} initiated for user ${user.email}`)
    console.log(`📋 Found ${existingConnections?.length || 0} existing connections`)

    return NextResponse.json({
      success: true,
      auth_url: `${authUrl}?${params.toString()}`,
      action: authAction,
      existing_connections: existingConnections?.length || 0,
      existing_accounts: existingConnections?.map(conn => ({
        id: conn.unipile_account_id,
        name: conn.account_name,
        status: conn.connection_status
      })) || [],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error initiating LinkedIn connection:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// GET method to check connection status and capabilities
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }

    // Get user's LinkedIn associations
    const { data: associations } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'LINKEDIN')

    // Get Unipile configuration status
    const unipileDsn = process.env.UNIPILE_DSN
    const unipileApiKey = process.env.UNIPILE_API_KEY
    const configurationReady = !!(unipileDsn && unipileApiKey)

    return NextResponse.json({
      success: true,
      configuration_ready: configurationReady,
      has_linkedin: (associations && associations.length > 0),
      associations: associations || [],
      count: associations?.length || 0,
      capabilities: {
        can_connect: configurationReady,
        can_reconnect: configurationReady && associations && associations.length > 0,
        hosted_auth_available: configurationReady
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error checking LinkedIn connection status:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}