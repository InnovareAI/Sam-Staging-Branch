import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Debug LinkedIn connection issues, especially 2FA problems
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

    const body = await request.json()
    const { email, test_mode = false } = body

    console.log(`🔍 LinkedIn connection debug for user: ${user.email}, LinkedIn email: ${email}`)

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

    // Test Unipile API connectivity
    const baseUrl = `https://${unipileDsn}/api/v1`
    
    // 1. Check Unipile service status
    console.log(`🔧 Testing Unipile connectivity...`)
    let unipileStatus = 'unknown'
    try {
      const statusResponse = await fetch(`${baseUrl}/accounts`, {
        headers: { 'X-API-KEY': unipileApiKey }
      })
      unipileStatus = statusResponse.ok ? 'connected' : `error_${statusResponse.status}`
      console.log(`📡 Unipile API status: ${unipileStatus}`)
    } catch (error) {
      unipileStatus = 'network_error'
      console.error(`❌ Unipile connectivity error:`, error)
    }

    // 2. Check for existing LinkedIn accounts with this email
    const existingLinkedInAccounts = []
    try {
      const accountsResponse = await fetch(`${baseUrl}/accounts`, {
        headers: { 'X-API-KEY': unipileApiKey }
      })
      
      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json()
        const linkedinAccounts = accountsData.items?.filter((acc: any) => acc.type === 'LINKEDIN') || []
        
        for (const account of linkedinAccounts) {
          const accountEmail = account.connection_params?.im?.email || account.connection_params?.im?.username
          if (accountEmail && accountEmail.toLowerCase() === email.toLowerCase()) {
            existingLinkedInAccounts.push({
              unipile_id: account.id,
              name: account.name,
              email: accountEmail,
              status: account.sources?.[0]?.status,
              created_at: account.created_at,
              has_2fa: account.connection_params?.im?.two_factor_enabled || false,
              product_type: account.connection_params?.product_type
            })
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error checking existing accounts:`, error)
    }

    // 3. Get user's workspace info
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()

    let workspaceInfo = null
    if (userProfile?.current_workspace_id) {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id, name')
        .eq('id', userProfile.current_workspace_id)
        .single()
      
      workspaceInfo = workspace
    }

    // 4. Check SAM AI database associations
    const { data: samAssociations } = await supabase
      .from('workspace_accounts')
      .select('id, unipile_account_id, account_name, connection_status, workspace_id, created_at')
      .eq('user_id', user.id)
      .eq('account_type', 'linkedin')

    // 5. Generate diagnostic recommendations
    const diagnostics = {
      recommendations: [],
      severity: 'info'
    }

    if (unipileStatus !== 'connected') {
      diagnostics.recommendations.push('Unipile API connectivity issue - check network/credentials')
      diagnostics.severity = 'error'
    }

    if (existingLinkedInAccounts.length > 1) {
      diagnostics.recommendations.push(`Found ${existingLinkedInAccounts.length} LinkedIn accounts with same email - duplicates may cause 2FA issues`)
      diagnostics.severity = 'warning'
    }

    if (existingLinkedInAccounts.length > 0 && samAssociations?.length === 0) {
      diagnostics.recommendations.push('LinkedIn account exists in Unipile but not associated with SAM AI workspace - run auto-association')
      diagnostics.severity = 'warning'
    }

    if (existingLinkedInAccounts.some(acc => acc.has_2fa)) {
      diagnostics.recommendations.push('LinkedIn account has 2FA enabled - ensure mobile notifications are working')
    }

    if (existingLinkedInAccounts.some(acc => acc.status !== 'OK')) {
      diagnostics.recommendations.push('LinkedIn account status is not OK - may need re-authentication')
      diagnostics.severity = 'error'
    }

    if (existingLinkedInAccounts.length === 0) {
      diagnostics.recommendations.push('No existing LinkedIn account found - will create new connection')
    }

    // 6. Test connection flow (if test_mode enabled)
    let connectionTest = null
    if (test_mode && workspaceInfo) {
      try {
        const workspaceUserId = `${workspaceInfo.id}:${user.id}`
        const authAction = existingLinkedInAccounts.length > 0 ? 'reconnect' : 'create'
        const authUrl = `${baseUrl}/users/${workspaceUserId}/accounts/${authAction}`
        
        connectionTest = {
          auth_url: authUrl,
          auth_action: authAction,
          workspace_user_id: workspaceUserId,
          callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/linkedin/callback`
        }
        
        console.log(`🧪 Test mode: Generated auth URL for ${authAction}`)
      } catch (error) {
        console.error(`❌ Error generating test connection:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      debug_info: {
        user_email: user.email,
        linkedin_email: email,
        workspace: workspaceInfo,
        unipile_status: unipileStatus,
        existing_linkedin_accounts: existingLinkedInAccounts,
        sam_associations: samAssociations || [],
        diagnostics,
        connection_test: connectionTest,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error in LinkedIn connection debug:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// GET method for quick status check
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Quick connectivity test
    const unipileDsn = process.env.UNIPILE_DSN
    const unipileApiKey = process.env.UNIPILE_API_KEY
    
    let status = 'configuration_missing'
    if (unipileDsn && unipileApiKey) {
      try {
        const response = await fetch(`https://${unipileDsn}/api/v1/accounts`, {
          headers: { 'X-API-KEY': unipileApiKey }
        })
        status = response.ok ? 'connected' : `error_${response.status}`
      } catch {
        status = 'network_error'
      }
    }

    return NextResponse.json({
      success: true,
      unipile_status: status,
      dsn: unipileDsn ? 'configured' : 'missing',
      api_key: unipileApiKey ? 'configured' : 'missing',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}