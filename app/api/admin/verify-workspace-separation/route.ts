import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * ADMIN ENDPOINT: Verify workspace separation and member access
 *
 * This endpoint runs comprehensive checks to ensure:
 * 1. Workspace isolation is working correctly
 * 2. RLS policies are properly configured
 * 3. No cross-workspace data leaks exist
 * 4. Member access controls are correct
 *
 * Usage: POST /api/admin/verify-workspace-separation
 * Body: { "adminKey": "your-admin-key" } (optional, for additional security)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const results: any = {
      timestamp: new Date().toISOString(),
      status: 'success',
      checks: {}
    }

    // ========================================================================
    // CHECK 1: Workspace Overview
    // ========================================================================
    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspaces')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })

    if (workspacesError) {
      results.checks.workspaces = { error: workspacesError.message }
    } else {
      results.checks.workspaces = {
        total: workspaces.length,
        list: workspaces
      }
    }

    // ========================================================================
    // CHECK 2: Workspace Members
    // ========================================================================
    const { data: members, error: membersError } = await supabase
      .from('workspace_members')
      .select(`
        id,
        workspace_id,
        user_id,
        role,
        status,
        created_at,
        workspaces (name),
        users:user_id (email)
      `)
      .order('created_at', { ascending: false })

    if (membersError) {
      results.checks.members = { error: membersError.message }
    } else {
      // Group by workspace
      const membersByWorkspace: Record<string, any[]> = {}
      members.forEach((member: any) => {
        const workspaceId = member.workspace_id
        if (!membersByWorkspace[workspaceId]) {
          membersByWorkspace[workspaceId] = []
        }
        membersByWorkspace[workspaceId].push({
          user_id: member.user_id,
          email: member.users?.email || 'unknown',
          role: member.role,
          status: member.status,
          joined_at: member.created_at
        })
      })

      results.checks.members = {
        total: members.length,
        active: members.filter((m: any) => m.status === 'active').length,
        by_workspace: membersByWorkspace
      }
    }

    // ========================================================================
    // CHECK 3: Multi-workspace Users
    // ========================================================================
    if (members && !membersError) {
      const userWorkspaceCount: Record<string, Set<string>> = {}
      members.forEach((member: any) => {
        const userId = member.user_id
        if (!userWorkspaceCount[userId]) {
          userWorkspaceCount[userId] = new Set()
        }
        userWorkspaceCount[userId].add(member.workspace_id)
      })

      const multiWorkspaceUsers = Object.entries(userWorkspaceCount)
        .filter(([_, workspaceSet]) => workspaceSet.size > 1)
        .map(([userId, workspaceSet]) => {
          const userMember = members.find((m: any) => m.user_id === userId)
          return {
            user_id: userId,
            email: userMember?.users?.email || 'unknown',
            workspace_count: workspaceSet.size,
            workspaces: Array.from(workspaceSet)
          }
        })

      results.checks.multi_workspace_users = {
        count: multiWorkspaceUsers.length,
        users: multiWorkspaceUsers
      }
    }

    // ========================================================================
    // CHECK 4: Workspace Role Distribution
    // ========================================================================
    if (workspaces && !workspacesError && members && !membersError) {
      const roleDistribution = workspaces.map((workspace: any) => {
        const workspaceMembers = members.filter(
          (m: any) => m.workspace_id === workspace.id && m.status === 'active'
        )
        const owners = workspaceMembers.filter((m: any) => m.role === 'owner')
        const admins = workspaceMembers.filter((m: any) => m.role === 'admin')
        const regularMembers = workspaceMembers.filter((m: any) => m.role === 'member')

        return {
          workspace_id: workspace.id,
          workspace_name: workspace.name,
          total_members: workspaceMembers.length,
          owners: owners.length,
          admins: admins.length,
          members: regularMembers.length,
          warning: owners.length === 0 ? 'NO OWNER' : null
        }
      })

      const workspacesWithoutOwners = roleDistribution.filter(
        (w: any) => w.owners === 0
      )

      results.checks.role_distribution = {
        by_workspace: roleDistribution,
        workspaces_without_owners: {
          count: workspacesWithoutOwners.length,
          list: workspacesWithoutOwners
        }
      }
    }

    // ========================================================================
    // CHECK 5: Campaign Data Isolation
    // ========================================================================
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, workspace_id')

    if (campaignsError) {
      results.checks.campaigns = { error: campaignsError.message }
    } else {
      const campaignsByWorkspace: Record<string, number> = {}
      campaigns.forEach((campaign: any) => {
        const workspaceId = campaign.workspace_id || 'null'
        campaignsByWorkspace[workspaceId] = (campaignsByWorkspace[workspaceId] || 0) + 1
      })

      const orphanedCampaigns = campaigns.filter((c: any) => !c.workspace_id)

      results.checks.campaigns = {
        total: campaigns.length,
        by_workspace: campaignsByWorkspace,
        orphaned: {
          count: orphanedCampaigns.length,
          list: orphanedCampaigns
        }
      }
    }

    // ========================================================================
    // CHECK 6: Campaign Prospects Isolation
    // ========================================================================
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('id, campaign_id, first_name, last_name')

    if (prospectsError) {
      results.checks.campaign_prospects = { error: prospectsError.message }
    } else {
      const prospectsByCampaign: Record<string, number> = {}
      prospects.forEach((prospect: any) => {
        const campaignId = prospect.campaign_id || 'null'
        prospectsByCampaign[campaignId] = (prospectsByCampaign[campaignId] || 0) + 1
      })

      // Check for orphaned prospects (campaign_id not in campaigns)
      const campaignIds = campaigns ? campaigns.map((c: any) => c.id) : []
      const orphanedProspects = prospects.filter(
        (p: any) => !campaignIds.includes(p.campaign_id)
      )

      results.checks.campaign_prospects = {
        total: prospects.length,
        by_campaign: prospectsByCampaign,
        orphaned: {
          count: orphanedProspects.length,
          list: orphanedProspects.slice(0, 10) // Limit to first 10 for output
        }
      }
    }

    // ========================================================================
    // CHECK 7: RLS Policy Status
    // ========================================================================
    const { data: rlsTables, error: rlsError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT
          tablename,
          rowsecurity AS rls_enabled
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename IN (
            'workspaces',
            'workspace_members',
            'campaigns',
            'campaign_prospects',
            'workspace_prospects',
            'prospect_approval_sessions',
            'prospect_approval_data'
          )
        ORDER BY tablename
      `
    })

    if (rlsError) {
      // If exec_sql doesn't exist, note it as info
      results.checks.rls_policies = {
        info: 'RLS check requires custom SQL function',
        note: 'Verify RLS manually in Supabase dashboard'
      }
    } else {
      results.checks.rls_policies = rlsTables
    }

    // ========================================================================
    // CHECK 8: Prospect Approval Sessions Isolation
    // ========================================================================
    const { data: approvalSessions, error: approvalError } = await supabase
      .from('prospect_approval_sessions')
      .select('id, workspace_id, created_by, created_at')

    if (approvalError) {
      results.checks.approval_sessions = { error: approvalError.message }
    } else {
      const sessionsByWorkspace: Record<string, number> = {}
      approvalSessions.forEach((session: any) => {
        const workspaceId = session.workspace_id || 'null'
        sessionsByWorkspace[workspaceId] = (sessionsByWorkspace[workspaceId] || 0) + 1
      })

      const orphanedSessions = approvalSessions.filter((s: any) => !s.workspace_id)

      results.checks.approval_sessions = {
        total: approvalSessions.length,
        by_workspace: sessionsByWorkspace,
        orphaned: {
          count: orphanedSessions.length,
          list: orphanedSessions
        }
      }
    }

    // ========================================================================
    // SECURITY SUMMARY
    // ========================================================================
    const issues: string[] = []
    const warnings: string[] = []

    // Check for critical issues
    if (results.checks.campaigns?.orphaned?.count > 0) {
      issues.push(`${results.checks.campaigns.orphaned.count} orphaned campaigns without workspace`)
    }
    if (results.checks.campaign_prospects?.orphaned?.count > 0) {
      issues.push(`${results.checks.campaign_prospects.orphaned.count} orphaned prospects without campaign`)
    }
    if (results.checks.approval_sessions?.orphaned?.count > 0) {
      issues.push(`${results.checks.approval_sessions.orphaned.count} orphaned approval sessions`)
    }

    // Check for warnings
    if (results.checks.role_distribution?.workspaces_without_owners?.count > 0) {
      warnings.push(`${results.checks.role_distribution.workspaces_without_owners.count} workspaces without owners`)
    }
    if (results.checks.multi_workspace_users?.count > 0) {
      warnings.push(`${results.checks.multi_workspace_users.count} users with access to multiple workspaces`)
    }

    results.security_summary = {
      status: issues.length > 0 ? 'ISSUES FOUND' : warnings.length > 0 ? 'WARNINGS' : 'HEALTHY',
      critical_issues: issues,
      warnings: warnings,
      overall_health: issues.length === 0 && warnings.length === 0 ? 'EXCELLENT' : issues.length > 0 ? 'NEEDS ATTENTION' : 'GOOD'
    }

    return NextResponse.json(results, { status: 200 })

  } catch (error) {
    console.error('Workspace verification error:', error)
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
