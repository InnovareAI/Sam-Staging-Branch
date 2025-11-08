import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * DEBUG ENDPOINT: Investigate Canada campaign issue
 */
export async function GET(request: NextRequest) {
  try {
    // Use service role to bypass RLS for debugging
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
      queries: {}
    }

    // 1. Find user ID for tl@innovareai.com
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, created_at')
      .eq('email', 'tl@innovareai.com')
      .single()

    results.queries.user = {
      data: user,
      error: userError?.message
    }

    if (!user) {
      return NextResponse.json({
        error: 'User not found',
        results
      })
    }

    const userId = user.id

    // 2. Find all workspaces for this user
    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspace_members')
      .select(`
        workspace_id,
        role,
        workspaces (
          id,
          name,
          client_code,
          created_at
        )
      `)
      .eq('user_id', userId)

    results.queries.workspaces = {
      data: workspaces,
      error: workspacesError?.message
    }

    // 3. Find ALL campaigns with "Canada" in the name
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        workspace_id,
        status,
        created_at,
        workspaces (
          name,
          client_code
        )
      `)
      .ilike('name', '%canada%')
      .order('created_at', { ascending: false })

    // Check which campaigns the user should have access to
    const campaignsWithAccess = campaigns?.map(c => {
      const hasAccess = workspaces?.some(w => w.workspace_id === c.workspace_id)
      return {
        ...c,
        user_has_access: hasAccess,
        workspace_name: c.workspaces?.name,
        client_code: c.workspaces?.client_code
      }
    })

    results.queries.campaigns = {
      data: campaignsWithAccess,
      error: campaignsError?.message
    }

    // 4. Find prospect_approval_sessions with "Canada" in campaign_name
    const { data: sessions, error: sessionsError } = await supabase
      .from('prospect_approval_sessions')
      .select(`
        id,
        campaign_name,
        campaign_tag,
        workspace_id,
        created_at,
        workspaces (
          name,
          client_code
        )
      `)
      .ilike('campaign_name', '%canada%')
      .order('created_at', { ascending: false })

    // Check approved prospects count for each session
    const sessionsWithData = await Promise.all(
      (sessions || []).map(async (session) => {
        const { count } = await supabase
          .from('prospect_approval_data')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', session.id)
          .eq('approval_status', 'approved')

        const hasAccess = workspaces?.some(w => w.workspace_id === session.workspace_id)

        return {
          ...session,
          approved_count: count,
          user_has_access: hasAccess,
          workspace_name: session.workspaces?.name,
          client_code: session.workspaces?.client_code
        }
      })
    )

    results.queries.approval_sessions = {
      data: sessionsWithData,
      error: sessionsError?.message
    }

    // 5. Summary analysis
    const unauthorizedCampaigns = campaignsWithAccess?.filter(c => !c.user_has_access) || []
    const unauthorizedSessions = sessionsWithData?.filter(s => !s.user_has_access) || []

    results.analysis = {
      total_workspaces: workspaces?.length || 0,
      total_canada_campaigns: campaigns?.length || 0,
      total_canada_sessions: sessions?.length || 0,
      unauthorized_campaigns: unauthorizedCampaigns.length,
      unauthorized_sessions: unauthorizedSessions.length,
      potential_data_leak: unauthorizedCampaigns.length > 0 || unauthorizedSessions.length > 0,
      unauthorized_campaign_details: unauthorizedCampaigns,
      unauthorized_session_details: unauthorizedSessions
    }

    return NextResponse.json(results, { status: 200 })

  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
