import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/prospects/approve
 *
 * Batch approve or reject prospects in workspace_prospects table.
 * This is the database-driven approval system (no sessions required).
 *
 * Body:
 * {
 *   workspaceId: string,
 *   action: 'approve' | 'reject' | 'approve_all' | 'reject_all',
 *   prospectIds?: string[],    // Required for 'approve' | 'reject'
 *   batch_id?: string,         // Optional: filter by batch
 *   rejection_reason?: string  // Optional: reason for rejection
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId: authWorkspaceId } = await verifyAuth(request);

    const body = await request.json();
    const {
      workspaceId,
      action,
      prospectIds,
      batch_id,
      rejection_reason
    } = body;

    // Use workspaceId from body if provided, otherwise use from auth
    const effectiveWorkspaceId = workspaceId || authWorkspaceId;

    if (!effectiveWorkspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    // If body workspaceId differs from auth, verify access
    if (workspaceId && workspaceId !== authWorkspaceId) {
      const memberCheck = await pool.query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
      );
      if (memberCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (!action || !['approve', 'reject', 'approve_all', 'reject_all'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be one of: approve, reject, approve_all, reject_all' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    let updatedCount = 0;

    if (action === 'approve' || action === 'reject') {
      // Specific prospect IDs required
      if (!prospectIds || !Array.isArray(prospectIds) || prospectIds.length === 0) {
        return NextResponse.json(
          { error: 'prospectIds array is required for approve/reject actions' },
          { status: 400 }
        );
      }

      const approvalStatus = action === 'approve' ? 'approved' : 'rejected';

      let query = `
        UPDATE workspace_prospects
        SET approval_status = $1, approved_by = $2, approved_at = $3, updated_at = $4
      `;
      const params: any[] = [approvalStatus, userId, now, now];
      let paramIndex = 5;

      if (action === 'reject' && rejection_reason) {
        query += `, rejection_reason = $${paramIndex++}`;
        params.push(rejection_reason);
      }

      query += ` WHERE workspace_id = $${paramIndex++} AND id = ANY($${paramIndex++}) AND approval_status = 'pending' RETURNING id`;
      params.push(effectiveWorkspaceId, prospectIds);

      const updateResult = await pool.query(query, params);
      updatedCount = updateResult.rows.length;

    } else if (action === 'approve_all' || action === 'reject_all') {
      // Bulk action on all pending prospects (optionally filtered by batch_id)
      const approvalStatus = action === 'approve_all' ? 'approved' : 'rejected';

      let query = `
        UPDATE workspace_prospects
        SET approval_status = $1, approved_by = $2, approved_at = $3, updated_at = $4
      `;
      const params: any[] = [approvalStatus, userId, now, now];
      let paramIndex = 5;

      if (action === 'reject_all' && rejection_reason) {
        query += `, rejection_reason = $${paramIndex++}`;
        params.push(rejection_reason);
      } else if (action === 'reject_all') {
        query += `, rejection_reason = NULL`;
      }

      query += ` WHERE workspace_id = $${paramIndex++} AND approval_status = 'pending'`;
      params.push(effectiveWorkspaceId);

      if (batch_id) {
        query += ` AND batch_id = $${paramIndex++}`;
        params.push(batch_id);
      }

      query += ' RETURNING id';

      const updateResult = await pool.query(query, params);
      updatedCount = updateResult.rows.length;
    }

    // Get updated counts for the workspace
    const pendingResult = await pool.query(
      "SELECT COUNT(*) as count FROM workspace_prospects WHERE workspace_id = $1 AND approval_status = 'pending'",
      [effectiveWorkspaceId]
    );

    const approvedResult = await pool.query(
      "SELECT COUNT(*) as count FROM workspace_prospects WHERE workspace_id = $1 AND approval_status = 'approved' AND active_campaign_id IS NULL",
      [effectiveWorkspaceId]
    );

    const rejectedResult = await pool.query(
      "SELECT COUNT(*) as count FROM workspace_prospects WHERE workspace_id = $1 AND approval_status = 'rejected'",
      [effectiveWorkspaceId]
    );

    return NextResponse.json({
      success: true,
      action,
      updated_count: updatedCount,
      counts: {
        pending: parseInt(pendingResult.rows[0].count, 10) || 0,
        approved_available: parseInt(approvedResult.rows[0].count, 10) || 0, // Approved but not in campaign
        rejected: parseInt(rejectedResult.rows[0].count, 10) || 0,
      },
      message: `Successfully ${action === 'approve' || action === 'approve_all' ? 'approved' : 'rejected'} ${updatedCount} prospect(s).`,
    });

  } catch (error: unknown) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Prospect approval error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/prospects/approve?workspaceId=xxx&status=pending&batch_id=xxx
 *
 * Get prospects by approval status for the workspace.
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId: authWorkspaceId } = await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || authWorkspaceId;
    const status = searchParams.get('status') || 'pending';
    const batchId = searchParams.get('batch_id');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    // If query workspaceId differs from auth, verify access
    if (workspaceId !== authWorkspaceId) {
      const memberCheck = await pool.query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
      );
      if (memberCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Build query
    let query = 'SELECT * FROM workspace_prospects WHERE workspace_id = $1';
    const params: any[] = [workspaceId];
    let paramIndex = 2;

    // Filter by status
    if (status === 'approved_available') {
      // Approved but not in a campaign
      query += ` AND approval_status = 'approved' AND active_campaign_id IS NULL`;
    } else if (['pending', 'approved', 'rejected'].includes(status)) {
      query += ` AND approval_status = $${paramIndex++}`;
      params.push(status);
    }

    // Filter by batch_id
    if (batchId) {
      query += ` AND batch_id = $${paramIndex++}`;
      params.push(batchId);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const prospectsResult = await pool.query(query, params);
    const prospects = prospectsResult.rows;

    // Get total count for the query
    let countQuery = 'SELECT COUNT(*) as count FROM workspace_prospects WHERE workspace_id = $1';
    const countParams: any[] = [workspaceId];
    let countParamIndex = 2;

    if (status === 'approved_available') {
      countQuery += ` AND approval_status = 'approved' AND active_campaign_id IS NULL`;
    } else if (['pending', 'approved', 'rejected'].includes(status)) {
      countQuery += ` AND approval_status = $${countParamIndex++}`;
      countParams.push(status);
    }

    if (batchId) {
      countQuery += ` AND batch_id = $${countParamIndex++}`;
      countParams.push(batchId);
    }

    const totalResult = await pool.query(countQuery, countParams);
    const total = parseInt(totalResult.rows[0].count, 10);

    // Get counts for all statuses
    const [pendingResult, approvedAvailableResult, approvedInCampaignResult, rejectedResult] = await Promise.all([
      pool.query("SELECT COUNT(*) as count FROM workspace_prospects WHERE workspace_id = $1 AND approval_status = 'pending'", [workspaceId]),
      pool.query("SELECT COUNT(*) as count FROM workspace_prospects WHERE workspace_id = $1 AND approval_status = 'approved' AND active_campaign_id IS NULL", [workspaceId]),
      pool.query("SELECT COUNT(*) as count FROM workspace_prospects WHERE workspace_id = $1 AND approval_status = 'approved' AND active_campaign_id IS NOT NULL", [workspaceId]),
      pool.query("SELECT COUNT(*) as count FROM workspace_prospects WHERE workspace_id = $1 AND approval_status = 'rejected'", [workspaceId]),
    ]);

    return NextResponse.json({
      success: true,
      prospects,
      total,
      counts: {
        pending: parseInt(pendingResult.rows[0].count, 10) || 0,
        approved_available: parseInt(approvedAvailableResult.rows[0].count, 10) || 0,
        approved_in_campaign: parseInt(approvedInCampaignResult.rows[0].count, 10) || 0,
        rejected: parseInt(rejectedResult.rows[0].count, 10) || 0,
      },
      pagination: {
        limit,
        offset,
        has_more: total > offset + limit,
      },
    });

  } catch (error: unknown) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Prospect fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
