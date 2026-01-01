import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db';

/**
 * Verify RLS Status Endpoint
 *
 * Checks that RLS is enabled/disabled on correct tables
 * Alerts if unexpected changes detected
 */
export async function POST(request: NextRequest) {
  try {
    // Expected RLS configuration
    const expectedEnabled = [
      'workspaces',
      'workspace_members',
      'campaigns',
      'campaign_prospects',
      'prospect_approval_sessions'
    ]

    const expectedDisabled = [
      'workspace_accounts',
      'linkedin_proxy_assignments',
      'user_unipile_accounts'
    ]

    const allTables = [...expectedEnabled, ...expectedDisabled]

    // Check actual RLS status
    const { data: rlsStatus, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT
          tablename,
          rowsecurity AS rls_enabled
        FROM pg_tables
        WHERE tablename IN (${allTables.map(t => `'${t}'`).join(',')})
        ORDER BY tablename
      `
    })

    if (error) {
      // If exec_sql doesn't work, use alternative method
      const results: any = {
        status: 'unknown',
        message: 'Cannot verify RLS status - exec_sql not available',
        expected_enabled: expectedEnabled,
        expected_disabled: expectedDisabled
      }
      return NextResponse.json(results)
    }

    // Check for unexpected changes
    const issues: string[] = []

    rlsStatus?.forEach((table: any) => {
      if (expectedEnabled.includes(table.tablename) && !table.rls_enabled) {
        issues.push(`❌ ${table.tablename} should have RLS ENABLED but it's DISABLED`)
      }
      if (expectedDisabled.includes(table.tablename) && table.rls_enabled) {
        issues.push(`❌ ${table.tablename} should have RLS DISABLED but it's ENABLED`)
      }
    })

    const status = issues.length === 0 ? 'as_expected' : 'unexpected_changes'

    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      tables_checked: allTables.length,
      issues_found: issues.length,
      issues,
      rls_status: rlsStatus
    })

  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
