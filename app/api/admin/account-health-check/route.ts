import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Account Health Check API
 * Detects table drift between user_unipile_accounts and workspace_accounts
 *
 * GET /api/admin/account-health-check
 *
 * Query params:
 * - workspace_id: Check specific workspace (optional)
 * - user_id: Check specific user (optional)
 * - fix: Set to 'true' to auto-fix issues (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspace_id')
    const userId = searchParams.get('user_id')
    const autoFix = searchParams.get('fix') === 'true'

    console.log('🔍 Running account health check...', { workspaceId, userId, autoFix })

    const issues: any[] = []
    const warnings: any[] = []
    const stats = {
      total_user_accounts: 0,
      total_workspace_accounts: 0,
      orphaned_user_accounts: 0,
      orphaned_workspace_accounts: 0,
      healthy_accounts: 0
    }

    // Get all user_unipile_accounts
    let userAccountsQuery = supabase
      .from('user_unipile_accounts')
      .select('*, users!inner(current_workspace_id)')

    if (userId) {
      userAccountsQuery = userAccountsQuery.eq('user_id', userId)
    }

    const { data: userAccounts, error: userAccountsError } = await userAccountsQuery

    if (userAccountsError) {
      throw new Error(`Failed to fetch user accounts: ${userAccountsError.message}`)
    }

    stats.total_user_accounts = userAccounts?.length || 0

    // Get all workspace_accounts
    let workspaceAccountsQuery = supabase
      .from('workspace_accounts')
      .select('*')

    if (workspaceId) {
      workspaceAccountsQuery = workspaceAccountsQuery.eq('workspace_id', workspaceId)
    }

    if (userId) {
      workspaceAccountsQuery = workspaceAccountsQuery.eq('user_id', userId)
    }

    const { data: workspaceAccounts, error: workspaceAccountsError } = await workspaceAccountsQuery

    if (workspaceAccountsError) {
      throw new Error(`Failed to fetch workspace accounts: ${workspaceAccountsError.message}`)
    }

    stats.total_workspace_accounts = workspaceAccounts?.length || 0

    // Create lookup maps
    const workspaceAccountMap = new Map(
      workspaceAccounts?.map(wa => [wa.unipile_account_id, wa]) || []
    )

    const userAccountMap = new Map(
      userAccounts?.map(ua => [ua.unipile_account_id, ua]) || []
    )

    // Check for orphaned user accounts (in user_unipile_accounts but NOT in workspace_accounts)
    for (const userAccount of userAccounts || []) {
      const workspaceAccount = workspaceAccountMap.get(userAccount.unipile_account_id)
      const expectedWorkspaceId = (userAccount.users as any)?.current_workspace_id

      if (!workspaceAccount && expectedWorkspaceId) {
        stats.orphaned_user_accounts++

        const issue = {
          type: 'orphaned_user_account',
          severity: 'high',
          unipile_account_id: userAccount.unipile_account_id,
          user_id: userAccount.user_id,
          expected_workspace_id: expectedWorkspaceId,
          account_name: userAccount.account_name,
          platform: userAccount.platform,
          message: `Account "${userAccount.account_name}" exists in user_unipile_accounts but NOT in workspace_accounts`,
          impact: 'Campaigns cannot use this account',
          fix: autoFix ? 'attempting_fix' : 'manual_fix_required'
        }

        issues.push(issue)

        // Auto-fix if requested
        if (autoFix && expectedWorkspaceId) {
          try {
            const { error: fixError } = await supabase.rpc('associate_linkedin_account_atomic', {
              p_user_id: userAccount.user_id,
              p_workspace_id: expectedWorkspaceId,
              p_unipile_account_id: userAccount.unipile_account_id,
              p_account_data: userAccount.account_metadata || {}
            })

            if (fixError) {
              issue.fix = 'fix_failed'
              issue.fix_error = fixError.message
            } else {
              issue.fix = 'fixed'
              stats.orphaned_user_accounts--
              stats.healthy_accounts++
            }
          } catch (fixError) {
            issue.fix = 'fix_exception'
            issue.fix_error = fixError instanceof Error ? fixError.message : 'Unknown error'
          }
        }
      } else if (workspaceAccount) {
        stats.healthy_accounts++
      }
    }

    // Check for orphaned workspace accounts (in workspace_accounts but NOT in user_unipile_accounts)
    for (const workspaceAccount of workspaceAccounts || []) {
      const userAccount = userAccountMap.get(workspaceAccount.unipile_account_id)

      if (!userAccount) {
        stats.orphaned_workspace_accounts++

        warnings.push({
          type: 'orphaned_workspace_account',
          severity: 'medium',
          unipile_account_id: workspaceAccount.unipile_account_id,
          workspace_id: workspaceAccount.workspace_id,
          user_id: workspaceAccount.user_id,
          account_name: workspaceAccount.account_name,
          account_type: workspaceAccount.account_type,
          message: `Account "${workspaceAccount.account_name}" exists in workspace_accounts but NOT in user_unipile_accounts`,
          impact: 'Account may be disconnected or deleted from Unipile',
          recommendation: 'User should reconnect this account or remove it from workspace'
        })
      }
    }

    // Generate health report
    const healthStatus = issues.length === 0 && warnings.length === 0 ? 'healthy' :
                        issues.length > 0 ? 'unhealthy' : 'warning'

    const report = {
      status: healthStatus,
      timestamp: new Date().toISOString(),
      scope: {
        workspace_id: workspaceId || 'all',
        user_id: userId || 'all',
        auto_fix_enabled: autoFix
      },
      stats,
      issues,
      warnings,
      recommendations: []
    }

    // Add recommendations
    if (stats.orphaned_user_accounts > 0) {
      report.recommendations.push({
        issue: 'Orphaned user accounts detected',
        action: 'Run this endpoint with ?fix=true to auto-repair using atomic RPC function',
        impact: 'Campaigns cannot use orphaned accounts until fixed'
      })
    }

    if (stats.orphaned_workspace_accounts > 0) {
      report.recommendations.push({
        issue: 'Orphaned workspace accounts detected',
        action: 'Users should reconnect accounts or admins should clean up stale entries',
        impact: 'These accounts are visible but not functional'
      })
    }

    if (stats.healthy_accounts === stats.total_user_accounts && issues.length === 0 && warnings.length === 0) {
      report.recommendations.push({
        message: '✅ All accounts are healthy! No action required.'
      })
    }

    return NextResponse.json(report)

  } catch (error) {
    console.error('Account health check error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Health check failed',
        status: 'error'
      },
      { status: 500 }
    )
  }
}
