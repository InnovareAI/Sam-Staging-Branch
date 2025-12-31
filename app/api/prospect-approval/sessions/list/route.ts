import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { getAdminAuth } from '@/lib/firebase-admin';

/**
 * GET /api/prospect-approval/sessions/list
 * Returns all active approval sessions for the authenticated user's workspace
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId, userEmail } = await verifyAuth(request);

    console.log(`🔐 [SESSIONS/LIST] Auth user: ${userEmail}, id: ${userId}`);

    const isSuperAdmin = ['tl@innovareai.com', 'cl@innovareai.com'].includes(userEmail.toLowerCase());
    console.log(`🔍 Fetching sessions for workspace: ${workspaceId}, user: ${userEmail}, isSuperAdmin: ${isSuperAdmin}`);

    // Fetch sessions - Super admins see ALL sessions, regular users see only their own
    let query = 'SELECT * FROM prospect_approval_sessions WHERE workspace_id = $1';
    const params: any[] = [workspaceId];

    // Super admins can see all sessions in any workspace
    if (!isSuperAdmin) {
      query += ' AND user_id = $2';
      params.push(userId);
    }

    query += ' ORDER BY created_at DESC';

    const sessionsResult = await pool.query(query, params);
    const sessions = sessionsResult.rows;

    console.log(`📊 [SESSIONS/LIST] Sessions query for workspace ${workspaceId}: found ${sessions?.length || 0} sessions`);

    // Enrich with user info - get all unique user IDs
    if (sessions && sessions.length > 0) {
      const userIds = [...new Set(sessions.map(s => s.user_id))];

      // Get emails from users table
      const usersResult = await pool.query(
        'SELECT id, email FROM users WHERE id = ANY($1)',
        [userIds]
      );

      const userMap = new Map(usersResult.rows.map(u => [u.id, u.email]));

      sessions.forEach(session => {
        session.user_email = userMap.get(session.user_id) || 'Unknown';
      });
    }

    console.log(`📊 Query result: ${sessions?.length || 0} sessions found`);
    console.log('Sessions:', sessions?.map(s => ({ id: s.id.substring(0, 8), campaign: s.campaign_name, prospects: s.total_prospects })));

    return NextResponse.json({
      success: true,
      sessions: sessions || [],
      count: sessions?.length || 0
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Sessions list error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
