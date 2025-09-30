import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Enhanced LinkedIn connection status with comprehensive diagnostics
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        has_linkedin: false,
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }

    // Get user's current workspace
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()

    if (!userProfile?.current_workspace_id) {
      return NextResponse.json({
        success: false,
        error: 'No active workspace',
        has_linkedin: false,
        timestamp: new Date().toISOString()
      }, { status: 400 })
    }

    const workspaceId = userProfile.current_workspace_id

    // Get Unipile configuration
    const unipileDsn = process.env.UNIPILE_DSN
    const unipileApiKey = process.env.UNIPILE_API_KEY
    const configurationReady = !!(unipileDsn && unipileApiKey)

    // Legacy integrations table (backwards compatibility)
    // Note: integrations table doesn't have workspace_id column, workspace is stored in settings.workspace_id
    const { data: legacyGlobalIntegrations } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'linkedin')
    
    // Filter integrations by workspace from settings
    const legacyWorkspaceIntegrations = legacyGlobalIntegrations?.filter(
      integration => integration.settings?.workspace_id === workspaceId
    ) || []

    // New workspace_accounts table (per-workspace associations)
    const { data: workspaceAccountRows } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('account_type', 'linkedin')

    const { data: globalAccountRows } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('account_type', 'linkedin')

    const workspaceAccounts = [
      ...(legacyWorkspaceIntegrations || []).map((row: any) => ({
        source: 'integrations',
        id: row.id,
        workspace_id: row.settings?.workspace_id || workspaceId,
        user_id: row.user_id,
        account_identifier: row.credentials?.account_email || row.credentials?.linkedin_public_identifier || row.account_identifier,
        account_name: row.credentials?.account_name || row.account_name,
        unipile_account_id: row.credentials?.unipile_account_id,
        connection_status: row.status || 'connected'
      })),
      ...(workspaceAccountRows || []).map((row: any) => ({
        source: 'workspace_accounts',
        id: row.id,
        workspace_id: row.workspace_id,
        user_id: row.user_id,
        account_identifier: row.account_identifier,
        account_name: row.account_name,
        unipile_account_id: row.unipile_account_id,
        connection_status: row.connection_status || 'connected'
      }))
    ]

    const globalAccounts = [
      ...(legacyGlobalIntegrations || []).map((row: any) => ({
        source: 'integrations',
        id: row.id,
        workspace_id: row.settings?.workspace_id,
        user_id: row.user_id,
        account_identifier: row.credentials?.account_email || row.credentials?.linkedin_public_identifier || row.account_identifier,
        account_name: row.credentials?.account_name || row.account_name,
        unipile_account_id: row.credentials?.unipile_account_id,
        connection_status: row.status || 'connected'
      })),
      ...(globalAccountRows || []).map((row: any) => ({
        source: 'workspace_accounts',
        id: row.id,
        workspace_id: row.workspace_id,
        user_id: row.user_id,
        account_identifier: row.account_identifier,
        account_name: row.account_name,
        unipile_account_id: row.unipile_account_id,
        connection_status: row.connection_status || 'connected'
      }))
    ]

    let unipileStatus = {
      connected: false,
      accounts: [],
      all_accounts: [],
      error: null as string | null
    }

    // Check Unipile accounts if configuration is ready
    if (configurationReady) {
      try {
        const unipileUrl = `https://${unipileDsn}/api/v1/accounts`
        const response = await fetch(unipileUrl, {
          headers: {
            'X-API-KEY': unipileApiKey,
            'Accept': 'application/json'
          }
        })

        if (response.ok) {
          const data = await response.json()
          const allLinkedinAccounts = data.items?.filter((acc: any) => acc.type === 'LINKEDIN') || []
          const activeLinkedinAccounts = allLinkedinAccounts.filter((acc: any) => acc.sources?.[0]?.status === 'OK')
          
          unipileStatus = {
            connected: true,
            accounts: activeLinkedinAccounts.map((acc: any) => ({
              id: acc.id,
              name: acc.name,
              status: acc.sources?.[0]?.status || 'unknown',
              email: acc.connection_params?.im?.email || acc.connection_params?.im?.username,
              created_at: acc.created_at,
              has_2fa: acc.connection_params?.im?.two_factor_enabled || false,
              product_type: acc.connection_params?.product_type,
              linkedin_id: acc.connection_params?.im?.id
            })),
            all_accounts: allLinkedinAccounts.map((acc: any) => ({
              id: acc.id,
              name: acc.name,
              status: acc.sources?.[0]?.status || 'unknown',
              email: acc.connection_params?.im?.email || acc.connection_params?.im?.username,
              created_at: acc.created_at,
              has_2fa: acc.connection_params?.im?.two_factor_enabled || false,
              product_type: acc.connection_params?.product_type,
              linkedin_id: acc.connection_params?.im?.id
            })),
            error: null
          }
        } else {
          unipileStatus.error = `Unipile API error: ${response.status}`
        }
      } catch (error) {
        unipileStatus.error = error instanceof Error ? error.message : 'Network error'
      }
    } else {
      unipileStatus.error = 'Unipile configuration missing'
    }

    // Determine overall connection status
    const hasWorkspaceConnections = workspaceAccounts && workspaceAccounts.length > 0
    const hasGlobalConnections = globalAccounts && globalAccounts.length > 0
    const hasActiveUnipileAccounts = unipileStatus.accounts.length > 0

const hasAnyUnipileAccounts = unipileStatus.all_accounts.length > 0

// Auto-link Unipile accounts if webhook failed but we see accounts via API
if (!workspaceAccounts.length && hasAnyUnipileAccounts) {
  const primaryAccount: any = unipileStatus.accounts[0] || unipileStatus.all_accounts[0]
  if (primaryAccount) {
    try {
      const accountIdentifier = primaryAccount.email || primaryAccount.linkedin_id || primaryAccount.name || primaryAccount.id
      const accountName = primaryAccount.name || accountIdentifier
      const connectionStatus = primaryAccount.status === 'OK' ? 'connected' : (primaryAccount.status || 'error')

      const { data: upsertedAccount, error: linkError } = await supabase
        .from('workspace_accounts')
        .upsert({
          workspace_id: workspaceId,
          user_id: user.id,
          account_type: 'linkedin',
          account_identifier: accountIdentifier,
          account_name: accountName,
          unipile_account_id: primaryAccount.id,
          connection_status: connectionStatus,
          is_active: true,
          is_primary: true,
          connection_details: {
            unipile_instance: unipileDsn,
            product_type: primaryAccount.product_type || null
          }
        }, { onConflict: 'workspace_id,user_id,account_type,account_identifier', ignoreDuplicates: false })
        .select()
        .maybeSingle()

      if (!linkError) {
        const linkedAccount = {
          source: 'workspace_accounts',
          id: upsertedAccount?.id || primaryAccount.id,
          workspace_id: workspaceId,
          user_id: user.id,
          account_identifier: accountIdentifier,
          account_name: accountName,
          unipile_account_id: primaryAccount.id,
          connection_status: connectionStatus
        }
        workspaceAccounts.push(linkedAccount)
        globalAccounts.push(linkedAccount)
        console.log('✅ Auto-linked LinkedIn account from Unipile polling', {
          workspace_id: workspaceId,
          user_id: user.id,
          unipile_account_id: primaryAccount.id
        })
      } else {
        console.error('⚠️ Failed to auto-link LinkedIn account', linkError)
      }
    } catch (autoLinkError) {
      console.error('⚠️ Auto-link attempt failed', autoLinkError)
    }
  }
}

// Diagnose potential issues
    const diagnostics = {
      association_gap: hasAnyUnipileAccounts && !hasWorkspaceConnections,
      duplicate_accounts: unipileStatus.all_accounts.length > 1,
      inactive_accounts: unipileStatus.all_accounts.filter((acc: any) => acc.status !== 'OK').length,
      needs_2fa: unipileStatus.all_accounts.some((acc: any) => acc.has_2fa),
      workspace_mismatch: hasGlobalConnections && !hasWorkspaceConnections,
      configuration_issues: !configurationReady,
      total_unipile_accounts: unipileStatus.all_accounts.length,
      active_unipile_accounts: unipileStatus.accounts.length
    }

    // Generate client-friendly recommendations
    const recommendations = []
    
    if (diagnostics.association_gap) {
      recommendations.push({
        type: 'action',
        priority: 'high',
        message: 'LinkedIn account found but not linked to your workspace',
        action: 'run_auto_association',
        description: 'Click to automatically link your existing LinkedIn account'
      })
    }

    if (diagnostics.inactive_accounts > 0) {
      recommendations.push({
        type: 'error',
        priority: 'high',
        message: `${diagnostics.inactive_accounts} LinkedIn account(s) need re-authentication`,
        action: 'reconnect_accounts',
        description: 'These accounts may be blocked or require 2FA verification'
      })
    }

    if (diagnostics.duplicate_accounts) {
      recommendations.push({
        type: 'warning',
        priority: 'medium',
        message: `${unipileStatus.all_accounts.length} LinkedIn accounts detected`,
        action: 'review_accounts',
        description: 'Multiple accounts may cause 2FA conflicts'
      })
    }

    if (diagnostics.workspace_mismatch) {
      recommendations.push({
        type: 'info',
        priority: 'medium',
        message: 'LinkedIn connected in other workspace but not this one',
        action: 'link_to_workspace',
        description: 'Your LinkedIn account is available but not linked to this workspace'
      })
    }

    if (diagnostics.configuration_issues) {
      recommendations.push({
        type: 'error',
        priority: 'critical',
        message: 'LinkedIn integration not configured',
        action: 'contact_support',
        description: 'Please contact support to enable LinkedIn integration'
      })
    }

    // Calculate connection health score (0-100)
    let healthScore = 0
    if (hasWorkspaceConnections) healthScore += 50
    if (hasActiveUnipileAccounts) healthScore += 30
    if (!diagnostics.association_gap) healthScore += 10
    if (diagnostics.inactive_accounts === 0) healthScore += 10

    // FIXED: Prioritize database integration over Unipile API check
    // If we have a database integration, trust it regardless of Unipile API status
    const overallStatus = hasWorkspaceConnections ? 'connected' 
                        : hasAnyUnipileAccounts ? 'connected'
                        : 'disconnected'

    console.log(`📊 LinkedIn status for ${user.email}:`, {
      overall: overallStatus,
      workspace_accounts: workspaceAccounts?.length || 0,
      unipile_accounts: unipileStatus.accounts.length,
      health_score: healthScore
    })

    console.log(`📊 LinkedIn status response for ${user.email}:`, {
      overall: overallStatus,
      workspace_accounts: workspaceAccounts?.length || 0,
      associations_count: workspaceAccounts?.length || 0,
      health_score: healthScore
    })

    return NextResponse.json({
      success: true,
      has_linkedin: overallStatus === 'connected',
      connection_status: {
        overall: overallStatus,
        health_score: healthScore,
        workspace_accounts: workspaceAccounts?.length || 0,
        global_accounts: globalAccounts?.length || 0,
        active_unipile_accounts: unipileStatus.accounts.length,
        total_unipile_accounts: unipileStatus.all_accounts.length
      },
      accounts: {
        workspace: workspaceAccounts || [],
        unipile_active: unipileStatus.accounts,
        unipile_all: unipileStatus.all_accounts
      },
      associations: workspaceAccounts || [],
      diagnostics,
      recommendations,
      configuration: {
        ready: configurationReady,
        unipile_status: unipileStatus.connected ? 'connected' : 'error',
        unipile_error: unipileStatus.error
      },
      workspace_id: workspaceId,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('LinkedIn status check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      has_linkedin: false,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// POST method for status-based actions
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const body = await request.json()
    const { action, account_id } = body

    switch (action) {
      case 'refresh_status':
        // Trigger a fresh status check by redirecting to GET
        const url = new URL('/api/linkedin/status', request.url)
        return NextResponse.redirect(url)

      case 'run_auto_association':
        // Trigger auto-association for this user
        const autoResponse = await fetch(`${request.nextUrl.origin}/api/linkedin/auto-associate`, {
          method: 'POST',
          headers: {
            'Cookie': request.headers.get('Cookie') || '',
            'Content-Type': 'application/json'
          }
        })
        const autoData = await autoResponse.json()
        
        return NextResponse.json({
          success: autoData.success,
          message: autoData.success 
            ? `Successfully linked ${autoData.associations_created} account(s)`
            : 'No accounts were linked',
          data: autoData,
          timestamp: new Date().toISOString()
        })

      case 'force_reconnect':
        // Force reconnection flow
        const connectResponse = await fetch(`${request.nextUrl.origin}/api/linkedin/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('Cookie') || ''
          }
        })
        const connectData = await connectResponse.json()
        
        return NextResponse.json({
          success: connectData.success,
          auth_url: connectData.auth_url,
          message: 'Reconnection initiated',
          timestamp: new Date().toISOString()
        })

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('LinkedIn status action error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}