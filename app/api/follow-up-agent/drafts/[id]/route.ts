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
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // Auth check
    const cookieStore = cookies();
    const authClient = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch draft with related data
    const { data: draft, error } = await supabase
      .from('follow_up_drafts')
      .select(`
        *,
        campaign_prospects!prospect_id (
          id,
          first_name,
          last_name,
          company_name,
          title,
          linkedin_url,
          email,
          status,
          connection_accepted_at,
          last_follow_up_at
        ),
        campaigns!campaign_id (
          id,
          campaign_name,
          workspace_id
        )
      `)
      .eq('id', draftId)
      .single();

    if (error || !draft) {
      console.error('Error fetching draft:', error);
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', draft.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
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

    // Auth check
    const cookieStore = cookies();
    const authClient = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch current draft
    const { data: draft, error: fetchError } = await supabase
      .from('follow_up_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Verify user has access
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', draft.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
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

    let updateData: Record<string, any> = {};

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

        updateData = {
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          scheduled_for: scheduleTime.toISOString()
        };

        // If message was edited, include it
        if (message) {
          updateData.message = message;
        }
        if (subject) {
          updateData.subject = subject;
        }

        console.log('✅ Approving draft:', {
          draftId,
          approvedBy: user.id,
          scheduledFor: scheduleTime.toISOString()
        });
        break;

      case 'reject':
        if (!rejected_reason) {
          return NextResponse.json({
            error: 'rejected_reason is required when rejecting'
          }, { status: 400 });
        }

        updateData = {
          status: 'rejected',
          rejected_reason
        };

        console.log('❌ Rejecting draft:', {
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

        updateData = {
          message
        };

        if (subject !== undefined) {
          updateData.subject = subject;
        }

        console.log('✏️ Editing draft:', {
          draftId,
          messageLength: message.length
        });
        break;
    }

    // Update the draft
    const { data: updatedDraft, error: updateError } = await supabase
      .from('follow_up_drafts')
      .update(updateData)
      .eq('id', draftId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating draft:', updateError);
      return NextResponse.json({
        error: 'Failed to update draft',
        details: updateError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action,
      draft: updatedDraft
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

    // Auth check
    const cookieStore = cookies();
    const authClient = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch draft to verify ownership and status
    const { data: draft, error: fetchError } = await supabase
      .from('follow_up_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Verify user has access
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', draft.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
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
    const { error: deleteError } = await supabase
      .from('follow_up_drafts')
      .delete()
      .eq('id', draftId);

    if (deleteError) {
      console.error('Error deleting draft:', deleteError);
      return NextResponse.json({
        error: 'Failed to delete draft',
        details: deleteError.message
      }, { status: 500 });
    }

    console.log('🗑️ Deleted draft:', draftId);

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
