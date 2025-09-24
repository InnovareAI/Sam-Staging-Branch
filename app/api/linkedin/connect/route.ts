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

    // Get current workspace context for proper isolation
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      return NextResponse.json({
        success: false,
        error: 'User context required',
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }

    // Get user's current workspace (workspace isolation)
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()

    if (!userProfile?.current_workspace_id) {
      return NextResponse.json({
        success: false,
        error: 'No active workspace - please switch to a workspace first',
        timestamp: new Date().toISOString()
      }, { status: 400 })
    }

    const workspaceId = userProfile.current_workspace_id

    // CRITICAL: Check for existing LinkedIn connections in THIS WORKSPACE (prevents cross-workspace leakage)
    const { data: existingConnections } = await supabase
      .from('workspace_accounts')
      .select('id, account_identifier, connection_status, account_name, unipile_account_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('account_type', 'linkedin')

    // ENHANCED: Also check for global connections by this user (prevents duplicate LinkedIn accounts)
    const { data: globalConnections } = await supabase
      .from('workspace_accounts')
      .select('id, account_identifier, connection_status, account_name, unipile_account_id, workspace_id')
      .eq('user_id', user.id)
      .eq('account_type', 'linkedin')

    // Determine action: 'reconnect' for existing in current workspace, 'create' for completely new
    const hasExistingConnection = existingConnections && existingConnections.length > 0
    const hasGlobalConnection = globalConnections && globalConnections.length > 0
    
    let authAction = 'create'
    let existingUnipileAccountIds: string[] = []
    
    if (hasExistingConnection) {
      // User has LinkedIn in THIS workspace - use reconnect
      authAction = 'reconnect'
      existingUnipileAccountIds = existingConnections.map(conn => conn.unipile_account_id).filter(Boolean)
    } else if (hasGlobalConnection) {
      // User has LinkedIn in OTHER workspace - still use reconnect to prevent duplicates
      authAction = 'reconnect'
      existingUnipileAccountIds = globalConnections.map(conn => conn.unipile_account_id).filter(Boolean)
      console.log(`🔄 User has LinkedIn in other workspace(s), using reconnect to prevent duplicates`)
    }

    console.log(`🔗 LinkedIn ${authAction} initiated - existing IDs: [${existingUnipileAccountIds.join(', ')}]`)
    
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

    // Generate workspace-specific user ID to prevent cross-workspace account leakage
    const workspaceUserId = `${workspaceId}:${user.id}`
    
    // Use the existing hosted auth wizard endpoint
    console.log('🔗 LinkedIn connection will use hosted auth wizard')
    
    // Force production URL for callback
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'
    
    // Call the existing hosted auth endpoint to get wizard URL
    let authUrl = null;
    try {
      const hostedAuthResponse = await fetch(`${siteUrl}/api/linkedin/hosted-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': request.headers.get('cookie') || ''
        }
      });

      if (hostedAuthResponse.ok) {
        const hostedAuthData = await hostedAuthResponse.json();
        authUrl = hostedAuthData.auth_url;
        console.log('✅ Got hosted auth URL:', authUrl);
      } else {
        console.warn('⚠️ Hosted auth failed, falling back to credential form');
      }
    } catch (error) {
      console.warn('⚠️ Hosted auth error, falling back to credential form:', error);
    }
    
    console.log(`🔗 Using callback URL: ${siteUrl}/api/linkedin/callback`)

    console.log(`🔗 LinkedIn ${authAction} initiated for user ${user.email}`)
    console.log(`📋 Found ${existingConnections?.length || 0} existing connections`)

    return NextResponse.json({
      success: true,
      action: authAction,
      auth_url: authUrl, // Will be null if wizard failed, triggering credential form
      use_credential_form: !authUrl, // Use credential form only if wizard URL failed
      use_hosted_auth: !!authUrl, // Use hosted auth if wizard URL available
      existing_connections: existingConnections?.length || 0,
      existing_accounts: existingConnections?.map(conn => ({
        id: conn.id,
        unipile_account_id: conn.unipile_account_id,
        account_identifier: conn.account_identifier,
        name: conn.account_name,
        status: conn.connection_status
      })) || [],
      workspace_id: workspaceId,
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

    // Get user's current workspace for proper isolation
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()

    if (!userProfile?.current_workspace_id) {
      return NextResponse.json({
        success: false,
        error: 'No active workspace - please switch to a workspace first',
        timestamp: new Date().toISOString()
      }, { status: 400 })
    }

    const workspaceId = userProfile.current_workspace_id

    // Get user's LinkedIn associations from THIS WORKSPACE (workspace isolation)
    const { data: associations } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('account_type', 'linkedin')

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
      workspace_id: workspaceId,
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