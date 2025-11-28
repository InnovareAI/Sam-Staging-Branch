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
    console.log(`🔐 [SESSIONS/LIST] Auth user: ${user.email}, id: ${user.id}`);

    const { data: userProfile, error: userProfileError } = await adminClient
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    console.log(`📋 [SESSIONS/LIST] User profile query result:`, { userProfile, error: userProfileError?.message });

    let workspaceId = userProfile?.current_workspace_id;

    // Fallback: get first workspace from memberships
    // CRITICAL FIX: Use adminClient to bypass RLS (Nov 28)
    if (!workspaceId) {
      const { data: membership } = await adminClient
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
    const userEmail = user.email?.toLowerCase() || '';
    const isSuperAdmin = ['tl@innovareai.com', 'cl@innovareai.com'].includes(userEmail);
    console.log(`🔍 Fetching sessions for workspace: ${workspaceId}, user: ${user.email}, isSuperAdmin: ${isSuperAdmin}`);

    // Fetch sessions - Super admins see ALL sessions, regular users see only their own
    // CRITICAL: Show ALL sessions (not just active) to preserve approved prospects
    // CRITICAL FIX: Use adminClient to bypass RLS (Nov 28) - RLS was blocking queries
    let sessionsQuery = adminClient
      .from('prospect_approval_sessions')
      .select('*')
      .eq('workspace_id', workspaceId);

    // Super admins can see all sessions in any workspace
    if (!isSuperAdmin) {
      sessionsQuery = sessionsQuery.eq('user_id', user.id);
    }

    const { data: sessions, error: sessionsError } = await sessionsQuery
      .order('created_at', { ascending: false });

    console.log(`📊 [SESSIONS/LIST] Sessions query for workspace ${workspaceId}: found ${sessions?.length || 0} sessions, error: ${sessionsError?.message || 'none'}`);

    // Enrich with user info (use admin client to bypass RLS on auth.users)
    if (sessions && sessions.length > 0) {
      const userIds = [...new Set(sessions.map(s => s.user_id))]
      const { data: users } = await adminClient.auth.admin.listUsers()
      const userMap = new Map(users.users.map(u => [u.id, u.email]))

      sessions.forEach(session => {
        session.user_email = userMap.get(session.user_id) || 'Unknown'
      })
    }

    console.log(`📊 Query result: ${sessions?.length || 0} sessions found`);
    console.log('Sessions:', sessions?.map(s => ({ id: s.id.substring(0, 8), campaign: s.campaign_name, prospects: s.total_prospects })));

    if (sessionsError) {
      console.error('❌ Error fetching sessions:', sessionsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch sessions'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sessions: sessions || [],
      count: sessions?.length || 0
    });

  } catch (error) {
    console.error('Sessions list error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
