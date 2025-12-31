import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

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
    // Step 1: Auth Check
    results.steps.push({ step: 1, name: 'Auth Check', status: 'running' });

    const authContext = await verifyAuth(request);

    results.steps[0].status = 'success';
    results.steps[0].data = { userId: authContext.userId, email: authContext.userEmail };

    // Step 2: Get Workspace
    results.steps.push({ step: 2, name: 'Get Workspace', status: 'running' });

    const userResult = await pool.query(
      'SELECT current_workspace_id FROM users WHERE id = $1',
      [authContext.userId]
    );

    let workspaceId = userResult.rows[0]?.current_workspace_id || authContext.workspaceId;

    if (!workspaceId) {
      const membershipResult = await pool.query(
        'SELECT workspace_id FROM workspace_members WHERE user_id = $1 LIMIT 1',
        [authContext.userId]
      );
      workspaceId = membershipResult.rows[0]?.workspace_id;
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

    const sessionsResult = await pool.query(
      `SELECT * FROM prospect_approval_sessions
       WHERE workspace_id = $1
       ORDER BY created_at DESC`,
      [workspaceId]
    );

    const sessions = sessionsResult.rows;

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
        const prospectsResult = await pool.query(
          'SELECT * FROM prospect_approval_data WHERE session_id = $1',
          [session.id]
        );

        if (prospectsResult.rows) {
          allProspects.push({
            sessionId: session.id.slice(0, 20) + '...',
            count: prospectsResult.rows.length,
            sample: prospectsResult.rows.slice(0, 3).map(p => ({
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
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authErr = error as AuthError;
      results.steps[0].status = 'failed';
      results.steps[0].error = authErr.message;
      return NextResponse.json(results);
    }

    results.overallStatus = 'error';
    results.error = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(results, { status: 500 });
  }
}
