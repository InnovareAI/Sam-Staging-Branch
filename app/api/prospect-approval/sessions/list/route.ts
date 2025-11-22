import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/app/lib/supabase';

/**
 * GET /api/prospect-approval/sessions/list
 * Returns all active approval sessions for the authenticated user's workspace
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // Use @supabase/ssr createServerClient (matches browser client)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          }
        }
      }
    );

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // CRITICAL FIX: Use admin client to bypass RLS when querying users table
    const adminClient = supabaseAdmin();
    const { data: userProfile } = await adminClient
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    let workspaceId = userProfile?.current_workspace_id;

    // Fallback: get first workspace from memberships
    if (!workspaceId) {
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      workspaceId = membership?.workspace_id;
    }

    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'No workspace found'
      }, { status: 404 });
    }

    // Get user's sessions (permanent sessions, visible across browsers/devices)
    console.log(`🔍 Fetching sessions for workspace: ${workspaceId}, user: ${user.email}`);

    // Fetch sessions - Show ONLY user's own sessions
    // CRITICAL: Show ALL sessions (not just active) to preserve approved prospects
    // But we'll filter out sessions where ALL prospects are already in campaigns
    const { data: sessions, error: sessionsError } = await supabase
      .from('prospect_approval_sessions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id) // CRITICAL: Only show user's own sessions
      .order('created_at', { ascending: false });

    // Enrich with user info (use admin client to bypass RLS on auth.users)
    if (sessions && sessions.length > 0) {
      const userIds = [...new Set(sessions.map(s => s.user_id))]
      const { data: users } = await adminClient.auth.admin.listUsers()
      const userMap = new Map(users.users.map(u => [u.id, u.email]))

      sessions.forEach(session => {
        session.user_email = userMap.get(session.user_id) || 'Unknown'
      })
    }

    // CRITICAL: Filter out sessions where ALL prospects are already in campaigns
    // User requirement: "if they are in a campaign they need to disappear from my view"
    const filteredSessions = [];
    if (sessions && sessions.length > 0) {
      for (const session of sessions) {
        // Get approved prospects from this session
        const { data: approvedProspects } = await supabase
          .from('prospect_approval_data')
          .select('id')
          .eq('session_id', session.id);

        if (!approvedProspects || approvedProspects.length === 0) {
          // No approved prospects in this session, skip it
          continue;
        }

        // Check how many of these prospects are already in campaigns
        // Prospects in campaigns have personalization_data.approval_data_id matching the prospect ID
        const { data: campaignProspects } = await supabase
          .from('campaign_prospects')
          .select('id, personalization_data')
          .eq('workspace_id', workspaceId);

        // Extract approval_data_ids from campaign prospects
        const campaignProspectIds = new Set(
          campaignProspects
            ?.filter(cp => cp.personalization_data?.approval_data_id)
            .map(cp => cp.personalization_data.approval_data_id) || []
        );

        // Count how many approved prospects are NOT yet in campaigns
        const prospectsNotInCampaigns = approvedProspects.filter(
          p => !campaignProspectIds.has(p.id)
        ).length;

        // Only show session if it has prospects NOT yet in campaigns
        if (prospectsNotInCampaigns > 0) {
          // Update the session's approved_count to show only prospects not in campaigns
          session.approved_count = prospectsNotInCampaigns;
          filteredSessions.push(session);
        }
      }
    }

    console.log(`📊 Query result: ${sessions?.length || 0} total sessions, ${filteredSessions.length} with prospects not in campaigns`);
    console.log('Filtered Sessions:', filteredSessions.map(s => ({ id: s.id.substring(0, 8), campaign: s.campaign_name, prospects: s.approved_count })));

    if (sessionsError) {
      console.error('❌ Error fetching sessions:', sessionsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch sessions'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sessions: filteredSessions,
      count: filteredSessions.length
    });

  } catch (error) {
    console.error('Sessions list error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
