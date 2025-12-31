import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAdminAuth } from '@/lib/firebase-admin'
import { pool } from '@/lib/auth'

const SESSION_COOKIE_NAME = 'session'

export async function POST(request: NextRequest) {
  try {
    // Verify Firebase session
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    let decodedClaims
    try {
      const auth = getAdminAuth()
      decodedClaims = await auth.verifySessionCookie(sessionCookie, true)
    } catch (error) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    if (!decodedClaims?.email) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Get user from database by email
    const { rows: userRows } = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [decodedClaims.email]
    )

    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const userId = userRows[0].id

    const { workspace_id } = await request.json()

    if (!workspace_id) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Verify user has access to this workspace
    const { rows: membershipRows } = await pool.query(
      'SELECT workspace_id FROM workspace_members WHERE user_id = $1 AND workspace_id = $2',
      [userId, workspace_id]
    )

    if (membershipRows.length === 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Update current workspace
    const { rowCount } = await pool.query(
      'UPDATE users SET current_workspace_id = $1 WHERE id = $2',
      [workspace_id, userId]
    )

    if (rowCount === 0) {
      return NextResponse.json({ error: 'Failed to switch workspace' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Switch workspace error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
