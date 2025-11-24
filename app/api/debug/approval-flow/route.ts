import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

/**
 * DEBUG ENDPOINT: Test entire approval data flow
 * GET /api/debug/approval-flow
 */
export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    steps: []
  };

  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Step 1: Auth Check
    results.steps.push({ step: 1, name: 'Auth Check', status: 'running' });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      results.steps[0].status = 'failed';
      results.steps[0].error = authError?.message || 'No user';
      return NextResponse.json(results);
    }

    results.steps[0].status = 'success';
    results.steps[0].data = { userId: user.id, email: user.email };

    // Step 2: Get Workspace
    results.steps.push({ step: 2, name: 'Get Workspace', status: 'running' });
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    let workspaceId = userProfile?.current_workspace_id;

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
      results.steps[1].status = 'failed';
      results.steps[1].error = 'No workspace found';
      return NextResponse.json(results);
    }

    results.steps[1].status = 'success';
    results.steps[1].data = { workspaceId };

    // Step 3: Get Approval Sessions
    results.steps.push({ step: 3, name: 'Get Approval Sessions', status: 'running' });
    const { data: sessions, error: sessionsError } = await supabase
      .from('prospect_approval_sessions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (sessionsError) {
      results.steps[2].status = 'failed';
      results.steps[2].error = sessionsError.message;
      return NextResponse.json(results);
    }

    results.steps[2].status = 'success';
    results.steps[2].data = {
      total: sessions?.length || 0,
      sessions: sessions?.map(s => ({
        id: s.id.slice(0, 20) + '...',
        status: s.status,
        total_prospects: s.total_prospects,
        pending_count: s.pending_count,
        batch_number: s.batch_number
      }))
    };

    // Step 4: Get Prospects for Active Sessions
    if (sessions && sessions.length > 0) {
      results.steps.push({ step: 4, name: 'Get Prospects for Active Sessions', status: 'running' });

      const activeSessions = sessions.filter(s => s.status === 'active');
      const allProspects: any[] = [];

      for (const session of activeSessions) {
        const { data: prospects, error: prospectsError } = await supabase
          .from('prospect_approval_data')
          .select('*')
          .eq('session_id', session.id);

        if (!prospectsError && prospects) {
          allProspects.push({
            sessionId: session.id.slice(0, 20) + '...',
            count: prospects.length,
            sample: prospects.slice(0, 3).map(p => ({
              name: p.name,
              title: p.title,
              company: p.company,
              contact: p.contact
            }))
          });
        }
      }

      results.steps[3].status = 'success';
      results.steps[3].data = {
        activeSessions: activeSessions.length,
        totalProspects: allProspects.reduce((sum, s) => sum + s.count, 0),
        prospects: allProspects
      };
    }

    results.overallStatus = 'success';
    results.summary = `Found ${sessions?.length || 0} sessions with ${results.steps[3]?.data?.totalProspects || 0} prospects`;

    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    results.overallStatus = 'error';
    results.error = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(results, { status: 500 });
  }
}
