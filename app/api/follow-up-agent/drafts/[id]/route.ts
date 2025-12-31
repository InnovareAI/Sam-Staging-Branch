/**
 * Follow-Up Agent Draft API - Individual Draft Operations
 *
 * GET /api/follow-up-agent/drafts/[id] - Get single draft
 * PATCH /api/follow-up-agent/drafts/[id] - Update draft (approve/reject/edit)
 * DELETE /api/follow-up-agent/drafts/[id] - Delete draft
 *
 * HITL Workflow States:
 * - pending_approval → approved (with optional edit)
 * - pending_approval → rejected (with reason)
 * - approved → sent (by cron job)
 *
 * Migrated Dec 31, 2025: Firebase auth + Cloud SQL
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/follow-up-agent/drafts/[id]
 * Get a single follow-up draft with full details
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: draftId } = await params;

    // Auth check via Firebase
    let userId: string;
    try {
      const auth = await verifyAuth(req);
      userId = auth.userId;
    } catch (authError) {
      const err = authError as AuthError;
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }

    // Fetch draft with related data
    const draftResult = await pool.query(
      `SELECT
        d.*,
        json_build_object(
          'id', p.id,
          'first_name', p.first_name,
          'last_name', p.last_name,
          'company_name', p.company_name,
          'title', p.title,
          'linkedin_url', p.linkedin_url,
          'email', p.email,
          'status', p.status,
          'connection_accepted_at', p.connection_accepted_at,
          'last_follow_up_at', p.last_follow_up_at
        ) as campaign_prospects,
        json_build_object(
          'id', c.id,
          'campaign_name', c.campaign_name,
          'workspace_id', c.workspace_id
        ) as campaigns
      FROM follow_up_drafts d
      LEFT JOIN campaign_prospects p ON d.prospect_id = p.id
      LEFT JOIN campaigns c ON d.campaign_id = c.id
      WHERE d.id = $1`,
      [draftId]
    );

    if (draftResult.rows.length === 0) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    const draft = draftResult.rows[0];

    // Verify user has access to workspace
    const memberResult = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [draft.workspace_id, userId]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      draft
    });

  } catch (error) {
    console.error('GET /api/follow-up-agent/drafts/[id] error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * PATCH /api/follow-up-agent/drafts/[id]
 * Update a draft - approve, reject, or edit
 *
 * Body:
 * - action: 'approve' | 'reject' | 'edit'
 * - message?: string (for edit)
 * - subject?: string (for edit, email only)
 * - scheduled_for?: string (ISO date for approve)
 * - rejected_reason?: string (for reject)
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: draftId } = await params;
    const body = await req.json();
    const { action, message, subject, scheduled_for, rejected_reason } = body;

    // Validate action
    if (!['approve', 'reject', 'edit'].includes(action)) {
      return NextResponse.json({
        error: 'Invalid action. Must be: approve, reject, or edit'
      }, { status: 400 });
    }

    // Auth check via Firebase
    let userId: string;
    try {
      const auth = await verifyAuth(req);
      userId = auth.userId;
    } catch (authError) {
      const err = authError as AuthError;
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }

    // Fetch current draft
    const draftResult = await pool.query(
      'SELECT * FROM follow_up_drafts WHERE id = $1',
      [draftId]
    );

    if (draftResult.rows.length === 0) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    const draft = draftResult.rows[0];

    // Verify user has access
    const memberResult = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [draft.workspace_id, userId]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
    }

    // Validate current status allows this action
    if (action === 'approve' || action === 'reject') {
      if (draft.status !== 'pending_approval') {
        return NextResponse.json({
          error: `Cannot ${action} draft with status: ${draft.status}`,
          current_status: draft.status
        }, { status: 400 });
      }
    }

    let updateFields: string[] = [];
    let updateValues: any[] = [];
    let paramIndex = 1;

    switch (action) {
      case 'approve':
        // Calculate scheduled time (default: 30 minutes from now during business hours)
        let scheduleTime = scheduled_for ? new Date(scheduled_for) : new Date();

        if (!scheduled_for) {
          // Default: schedule 30 minutes from now, but respect business hours
          scheduleTime = new Date(Date.now() + 30 * 60 * 1000);

          // If outside business hours (8 AM - 6 PM), schedule for next business day
          const hour = scheduleTime.getHours();
          const day = scheduleTime.getDay();

          if (hour >= 18) {
            // After 6 PM - schedule for 9 AM next day
            scheduleTime.setDate(scheduleTime.getDate() + 1);
            scheduleTime.setHours(9, 0, 0, 0);
          } else if (hour < 8) {
            // Before 8 AM - schedule for 9 AM same day
            scheduleTime.setHours(9, 0, 0, 0);
          }

          // Skip weekends
          if (day === 0) scheduleTime.setDate(scheduleTime.getDate() + 1); // Sunday -> Monday
          if (day === 6) scheduleTime.setDate(scheduleTime.getDate() + 2); // Saturday -> Monday
        }

        updateFields.push(`status = $${paramIndex++}`);
        updateValues.push('approved');
        updateFields.push(`approved_by = $${paramIndex++}`);
        updateValues.push(userId);
        updateFields.push(`approved_at = $${paramIndex++}`);
        updateValues.push(new Date().toISOString());
        updateFields.push(`scheduled_for = $${paramIndex++}`);
        updateValues.push(scheduleTime.toISOString());

        // If message was edited, include it
        if (message) {
          updateFields.push(`message = $${paramIndex++}`);
          updateValues.push(message);
        }
        if (subject) {
          updateFields.push(`subject = $${paramIndex++}`);
          updateValues.push(subject);
        }

        console.log('Approving draft:', {
          draftId,
          approvedBy: userId,
          scheduledFor: scheduleTime.toISOString()
        });
        break;

      case 'reject':
        if (!rejected_reason) {
          return NextResponse.json({
            error: 'rejected_reason is required when rejecting'
          }, { status: 400 });
        }

        updateFields.push(`status = $${paramIndex++}`);
        updateValues.push('rejected');
        updateFields.push(`rejected_reason = $${paramIndex++}`);
        updateValues.push(rejected_reason);

        console.log('Rejecting draft:', {
          draftId,
          reason: rejected_reason
        });
        break;

      case 'edit':
        if (!message) {
          return NextResponse.json({
            error: 'message is required when editing'
          }, { status: 400 });
        }

        updateFields.push(`message = $${paramIndex++}`);
        updateValues.push(message);

        if (subject !== undefined) {
          updateFields.push(`subject = $${paramIndex++}`);
          updateValues.push(subject);
        }

        console.log('Editing draft:', {
          draftId,
          messageLength: message.length
        });
        break;
    }

    // Update the draft
    updateValues.push(draftId);
    const updateResult = await pool.query(
      `UPDATE follow_up_drafts SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      updateValues
    );

    if (updateResult.rows.length === 0) {
      return NextResponse.json({
        error: 'Failed to update draft'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action,
      draft: updateResult.rows[0]
    });

  } catch (error) {
    console.error('PATCH /api/follow-up-agent/drafts/[id] error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/follow-up-agent/drafts/[id]
 * Delete a draft (only pending drafts can be deleted)
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: draftId } = await params;

    // Auth check via Firebase
    let userId: string;
    try {
      const auth = await verifyAuth(req);
      userId = auth.userId;
    } catch (authError) {
      const err = authError as AuthError;
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }

    // Fetch draft to verify ownership and status
    const draftResult = await pool.query(
      'SELECT * FROM follow_up_drafts WHERE id = $1',
      [draftId]
    );

    if (draftResult.rows.length === 0) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    const draft = draftResult.rows[0];

    // Verify user has access
    const memberResult = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [draft.workspace_id, userId]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
    }

    // Only allow deleting pending or rejected drafts
    if (!['pending_approval', 'pending_generation', 'rejected'].includes(draft.status)) {
      return NextResponse.json({
        error: `Cannot delete draft with status: ${draft.status}`,
        hint: 'Only pending or rejected drafts can be deleted'
      }, { status: 400 });
    }

    // Delete the draft
    const deleteResult = await pool.query(
      'DELETE FROM follow_up_drafts WHERE id = $1',
      [draftId]
    );

    if (deleteResult.rowCount === 0) {
      return NextResponse.json({
        error: 'Failed to delete draft'
      }, { status: 500 });
    }

    console.log('Deleted draft:', draftId);

    return NextResponse.json({
      success: true,
      deleted: draftId
    });

  } catch (error) {
    console.error('DELETE /api/follow-up-agent/drafts/[id] error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
