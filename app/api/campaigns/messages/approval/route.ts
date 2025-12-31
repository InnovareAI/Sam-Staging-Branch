import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    // Authenticate user with Firebase
    const authContext = await verifyAuth(req);
    const userId = authContext.userId;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all'; // 'pending', 'approved', 'rejected', 'all'
    const campaignId = searchParams.get('campaign_id');
    const workspaceId = searchParams.get('workspace_id') || authContext.workspaceId;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    // Verify user has access to this workspace
    const memberResult = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
    }

    // Build query for messages requiring approval
    let query = `
      SELECT cm.*, c.id as campaign_id, c.name as campaign_name, c.workspace_id
      FROM campaign_messages cm
      INNER JOIN campaigns c ON cm.campaign_id = c.id
      WHERE c.workspace_id = $1
    `;
    const params: any[] = [workspaceId];
    let paramIndex = 2;

    // Filter by campaign if specified
    if (campaignId) {
      query += ` AND cm.campaign_id = $${paramIndex}`;
      params.push(campaignId);
      paramIndex++;
    }

    // Filter by status
    if (status !== 'all') {
      query += ` AND cm.approval_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Order by creation date (newest first)
    query += ' ORDER BY cm.created_at DESC';

    const result = await pool.query(query, params);
    const messages = result.rows;

    // Group messages by status
    const groupedMessages = {
      pending: messages.filter(m => m.approval_status === 'pending') || [],
      approved: messages.filter(m => m.approval_status === 'approved') || [],
      rejected: messages.filter(m => m.approval_status === 'rejected') || []
    };

    return NextResponse.json({
      messages: messages || [],
      grouped: groupedMessages,
      counts: {
        pending: groupedMessages.pending.length,
        approved: groupedMessages.approved.length,
        rejected: groupedMessages.rejected.length,
        total: messages?.length || 0
      }
    });

  } catch (error: any) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authErr = error as AuthError;
      return NextResponse.json({ error: authErr.message }, { status: authErr.statusCode });
    }
    console.error('Message approval fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages for approval', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate user with Firebase
    const authContext = await verifyAuth(req);
    const userId = authContext.userId;

    const {
      action,
      message_id,
      message_ids,
      approval_status,
      rejection_reason,
      workspace_id
    } = await req.json();

    const workspaceId = workspace_id || authContext.workspaceId;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    // Verify user has access to this workspace
    const memberResult = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
    }

    if (!['approve', 'reject', 'bulk_approve', 'bulk_reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Handle bulk actions
    if (action === 'bulk_approve' || action === 'bulk_reject') {
      if (!message_ids || !Array.isArray(message_ids) || message_ids.length === 0) {
        return NextResponse.json({ error: 'Message IDs array is required for bulk actions' }, { status: 400 });
      }

      const newStatus = action === 'bulk_approve' ? 'approved' : 'rejected';

      // Update messages and verify workspace ownership
      const result = await pool.query(
        `UPDATE campaign_messages cm
         SET approval_status = $1,
             approved_by = $2,
             approved_at = $3,
             rejection_reason = $4,
             updated_at = $5
         FROM campaigns c
         WHERE cm.campaign_id = c.id
           AND c.workspace_id = $6
           AND cm.id = ANY($7)
         RETURNING cm.*, c.id as campaign_id, c.name as campaign_name, c.workspace_id`,
        [
          newStatus,
          userId,
          now,
          action === 'bulk_reject' ? rejection_reason || 'Bulk rejection' : null,
          now,
          workspaceId,
          message_ids
        ]
      );

      return NextResponse.json({
        message: `Successfully ${newStatus} ${result.rows.length || 0} messages`,
        action: action,
        updated_messages: result.rows,
        count: result.rows.length || 0
      });
    }

    // Handle single message actions
    if (!message_id) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const result = await pool.query(
      `UPDATE campaign_messages cm
       SET approval_status = $1,
           approved_by = $2,
           approved_at = $3,
           rejection_reason = $4,
           updated_at = $5
       FROM campaigns c
       WHERE cm.campaign_id = c.id
         AND c.workspace_id = $6
         AND cm.id = $7
       RETURNING cm.*, c.id as campaign_id, c.name as campaign_name, c.workspace_id`,
      [
        newStatus,
        userId,
        now,
        action === 'reject' ? rejection_reason || 'Message rejected' : null,
        now,
        workspaceId,
        message_id
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Message not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({
      message: `Message ${newStatus} successfully`,
      action: action,
      updated_message: result.rows[0]
    });

  } catch (error: any) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authErr = error as AuthError;
      return NextResponse.json({ error: authErr.message }, { status: authErr.statusCode });
    }
    console.error('Message approval action error:', error);
    return NextResponse.json(
      { error: 'Failed to process approval action', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    // Authenticate user with Firebase
    await verifyAuth(req);

    return NextResponse.json({
      message: 'Message Approval API',
      endpoints: {
        get_messages: 'GET /api/campaigns/messages/approval',
        approve_message: 'POST /api/campaigns/messages/approval',
        bulk_actions: 'POST /api/campaigns/messages/approval'
      },
      query_parameters: {
        status: 'pending | approved | rejected | all (default: all)',
        campaign_id: 'Filter by specific campaign ID'
      },
      actions: {
        approve: 'Approve single message',
        reject: 'Reject single message',
        bulk_approve: 'Approve multiple messages',
        bulk_reject: 'Reject multiple messages'
      },
      required_fields: {
        single_action: ['action', 'message_id'],
        bulk_action: ['action', 'message_ids'],
        reject_action: ['rejection_reason (optional)']
      }
    });

  } catch (error: any) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authErr = error as AuthError;
      return NextResponse.json({ error: authErr.message }, { status: authErr.statusCode });
    }
    console.error('Message approval API info error:', error);
    return NextResponse.json(
      { error: 'Request failed', details: error.message },
      { status: 500 }
    );
  }
}
