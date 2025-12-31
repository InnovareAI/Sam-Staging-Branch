import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

/**
 * GET /api/prospect-approval/decisions?session_id=xxx
 * Get all decisions for a session
 */
export async function GET(request: NextRequest) {
  try {
    await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session ID required'
      }, { status: 400 });
    }

    // Get decisions for this session
    const decisionsResult = await pool.query(
      'SELECT * FROM prospect_approval_decisions WHERE session_id = $1 ORDER BY decided_at DESC',
      [sessionId]
    );

    return NextResponse.json({
      success: true,
      decisions: decisionsResult.rows || []
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Decisions fetch error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/prospect-approval/decisions
 * Save approval/rejection decision for a prospect
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);

    const body = await request.json();
    const { session_id, prospect_id, decision, reason } = body;

    if (!session_id || !prospect_id || !decision) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: session_id, prospect_id, decision'
      }, { status: 400 });
    }

    if (!['approved', 'rejected', 'pending'].includes(decision)) {
      return NextResponse.json({
        success: false,
        error: 'Decision must be "approved", "rejected", or "pending"'
      }, { status: 400 });
    }

    // Insert or update decision (upsert to handle changing mind)
    const decisionResult = await pool.query(
      `INSERT INTO prospect_approval_decisions (session_id, prospect_id, decision, reason, decided_by, decided_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (session_id, prospect_id)
       DO UPDATE SET decision = $3, reason = $4, decided_by = $5, decided_at = $6
       RETURNING *`,
      [session_id, prospect_id, decision, reason || null, userId, new Date().toISOString()]
    );

    if (decisionResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Failed to save decision'
      }, { status: 500 });
    }

    // Update approval_status in prospect_approval_data table
    const updateResult = await pool.query(
      'UPDATE prospect_approval_data SET approval_status = $1 WHERE session_id = $2 AND prospect_id = $3 RETURNING *',
      [decision, session_id, prospect_id]
    );

    if (updateResult.rows.length === 0) {
      console.error('No rows updated in prospect_approval_data for:', { session_id, prospect_id });
      return NextResponse.json({
        success: false,
        error: 'Failed to update prospect approval status',
        details: 'No matching record found to update'
      }, { status: 404 });
    }

    console.log('Successfully updated approval_status:', updateResult.rows[0]);

    // Update session counts in background (non-blocking)
    updateSessionCounts(session_id).catch(console.error);

    return NextResponse.json({
      success: true,
      decision: decisionResult.rows[0]
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Decisions API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/prospect-approval/decisions
 * Delete a prospect decision (used when deleting rejected prospects)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);

    const body = await request.json();
    const { session_id, prospect_id } = body;

    if (!session_id || !prospect_id) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: session_id, prospect_id'
      }, { status: 400 });
    }

    // Delete the decision record
    await pool.query(
      'DELETE FROM prospect_approval_decisions WHERE session_id = $1 AND prospect_id = $2',
      [session_id, prospect_id]
    );

    // Delete from prospect_approval_data
    const deleteResult = await pool.query(
      'DELETE FROM prospect_approval_data WHERE session_id = $1 AND prospect_id = $2 RETURNING id',
      [session_id, prospect_id]
    );

    if (deleteResult.rowCount === 0) {
      console.error('Error deleting prospect data - no rows affected:', { session_id, prospect_id });
      return NextResponse.json({
        success: false,
        error: 'Failed to delete prospect'
      }, { status: 500 });
    }

    // Update session counts in background (non-blocking)
    updateSessionCounts(session_id).catch(console.error);

    return NextResponse.json({
      success: true,
      message: 'Prospect deleted successfully'
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Delete decision error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper function to update session counts
async function updateSessionCounts(sessionId: string) {
  // Count decisions by type
  const approvedCountResult = await pool.query(
    `SELECT COUNT(*) as count FROM prospect_approval_decisions WHERE session_id = $1 AND decision = 'approved'`,
    [sessionId]
  );

  const rejectedCountResult = await pool.query(
    `SELECT COUNT(*) as count FROM prospect_approval_decisions WHERE session_id = $1 AND decision = 'rejected'`,
    [sessionId]
  );

  const totalCountResult = await pool.query(
    'SELECT COUNT(*) as count FROM prospect_approval_data WHERE session_id = $1',
    [sessionId]
  );

  const approvedCount = parseInt(approvedCountResult.rows[0].count);
  const rejectedCount = parseInt(rejectedCountResult.rows[0].count);
  const totalCount = parseInt(totalCountResult.rows[0].count);

  // Pending count = total prospects that don't have an approved/rejected decision
  const pendingCount = totalCount - approvedCount - rejectedCount;

  // Update session
  await pool.query(
    'UPDATE prospect_approval_sessions SET approved_count = $1, rejected_count = $2, pending_count = $3 WHERE id = $4',
    [approvedCount, rejectedCount, pendingCount, sessionId]
  );
}
