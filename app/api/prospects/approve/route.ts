import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextRequest, NextResponse } from 'next/server';

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
    const supabase = await createSupabaseRouteClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      workspaceId,
      action,
      prospectIds,
      batch_id,
      rejection_reason
    } = body;

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    if (!action || !['approve', 'reject', 'approve_all', 'reject_all'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be one of: approve, reject, approve_all, reject_all' },
        { status: 400 }
      );
    }

    // Verify workspace membership
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

      const updateData: Record<string, unknown> = {
        approval_status: action === 'approve' ? 'approved' : 'rejected',
        approved_by: user.id,
        approved_at: now,
        updated_at: now,
      };

      if (action === 'reject' && rejection_reason) {
        updateData.rejection_reason = rejection_reason;
      }

      const { data: updated, error: updateError } = await supabase
        .from('workspace_prospects')
        .update(updateData)
        .eq('workspace_id', workspaceId)
        .in('id', prospectIds)
        .eq('approval_status', 'pending') // Only update pending prospects
        .select('id');

      if (updateError) {
        console.error('Error updating prospects:', updateError);
        return NextResponse.json(
          { error: 'Failed to update prospects' },
          { status: 500 }
        );
      }

      updatedCount = updated?.length || 0;

    } else if (action === 'approve_all' || action === 'reject_all') {
      // Bulk action on all pending prospects (optionally filtered by batch_id)
      let query = supabase
        .from('workspace_prospects')
        .update({
          approval_status: action === 'approve_all' ? 'approved' : 'rejected',
          approved_by: user.id,
          approved_at: now,
          updated_at: now,
          rejection_reason: action === 'reject_all' ? (rejection_reason || null) : null,
        })
        .eq('workspace_id', workspaceId)
        .eq('approval_status', 'pending');

      if (batch_id) {
        query = query.eq('batch_id', batch_id);
      }

      const { data: updated, error: updateError } = await query.select('id');

      if (updateError) {
        console.error('Error bulk updating prospects:', updateError);
        return NextResponse.json(
          { error: 'Failed to bulk update prospects' },
          { status: 500 }
        );
      }

      updatedCount = updated?.length || 0;
    }

    // Get updated counts for the workspace
    const { count: pendingCount } = await supabase
      .from('workspace_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('approval_status', 'pending');

    const { count: approvedCount } = await supabase
      .from('workspace_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('approval_status', 'approved')
      .is('active_campaign_id', null); // Not yet in a campaign

    const { count: rejectedCount } = await supabase
      .from('workspace_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('approval_status', 'rejected');

    return NextResponse.json({
      success: true,
      action,
      updated_count: updatedCount,
      counts: {
        pending: pendingCount || 0,
        approved_available: approvedCount || 0, // Approved but not in campaign
        rejected: rejectedCount || 0,
      },
      message: `Successfully ${action === 'approve' || action === 'approve_all' ? 'approved' : 'rejected'} ${updatedCount} prospect(s).`,
    });

  } catch (error: unknown) {
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
    const supabase = await createSupabaseRouteClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
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

    // Verify workspace membership
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build query
    let query = supabase
      .from('workspace_prospects')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status
    if (status === 'approved_available') {
      // Approved but not in a campaign
      query = query.eq('approval_status', 'approved').is('active_campaign_id', null);
    } else if (['pending', 'approved', 'rejected'].includes(status)) {
      query = query.eq('approval_status', status);
    }

    // Filter by batch_id
    if (batchId) {
      query = query.eq('batch_id', batchId);
    }

    const { data: prospects, count, error } = await query;

    if (error) {
      console.error('Error fetching prospects:', error);
      return NextResponse.json(
        { error: 'Failed to fetch prospects' },
        { status: 500 }
      );
    }

    // Get counts for all statuses
    const [pendingResult, approvedAvailableResult, approvedInCampaignResult, rejectedResult] = await Promise.all([
      supabase.from('workspace_prospects').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('approval_status', 'pending'),
      supabase.from('workspace_prospects').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('approval_status', 'approved').is('active_campaign_id', null),
      supabase.from('workspace_prospects').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('approval_status', 'approved').not('active_campaign_id', 'is', null),
      supabase.from('workspace_prospects').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('approval_status', 'rejected'),
    ]);

    return NextResponse.json({
      success: true,
      prospects,
      total: count || 0,
      counts: {
        pending: pendingResult.count || 0,
        approved_available: approvedAvailableResult.count || 0,
        approved_in_campaign: approvedInCampaignResult.count || 0,
        rejected: rejectedResult.count || 0,
      },
      pagination: {
        limit,
        offset,
        has_more: (count || 0) > offset + limit,
      },
    });

  } catch (error: unknown) {
    console.error('Prospect fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
