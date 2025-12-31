import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool } from '@/lib/auth'

/**
 * DEBUG ENDPOINT: Get user's workspaces and current context
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await verifyAuth(request);
    const { userId, userEmail } = authContext;

    // Get all workspaces user has access to
    const result = await pool.query(
      `SELECT 
         wm.workspace_id,
         wm.role,
         w.id,
         w.name,
         w.client_code
       FROM workspace_members wm
       JOIN workspaces w ON wm.workspace_id = w.id
       WHERE wm.user_id = $1`,
      [userId]
    );

    return NextResponse.json({
      user: {
        id: userId,
        email: userEmail
      },
      workspaces: result.rows.map(row => ({
        workspace_id: row.workspace_id,
        role: row.role,
        name: row.name,
        client_code: row.client_code
      }))
    })

  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
