/**
 * GDPR Data Deletion Request API
 * Handles Right to be Forgotten and data subject deletion requests
 * Date: October 31, 2025
 */

import { createCleanRouteHandlerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/gdpr/deletion-request - Create deletion request
export async function POST(request: NextRequest) {
  try {
    const supabase = await createCleanRouteHandlerClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const {
      workspace_id,
      prospect_id,
      request_type = 'right_to_be_forgotten',
      notes,
    } = body;

    // Validate required fields
    if (!workspace_id || !prospect_id) {
      return NextResponse.json(
        { error: 'workspace_id and prospect_id are required' },
        { status: 400 }
      );
    }

    // Verify user is admin of workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Create deletion request using database function
    const { data: requestId, error: createError } = await supabase.rpc(
      'create_gdpr_deletion_request',
      {
        p_workspace_id: workspace_id,
        p_prospect_id: prospect_id,
        p_request_type: request_type,
        p_request_source: 'workspace_admin',
        p_notes: notes || null,
      }
    );

    if (createError) {
      console.error('Error creating deletion request:', createError);
      return NextResponse.json(
        { error: 'Failed to create deletion request', details: createError.message },
        { status: 500 }
      );
    }

    // Fetch the created request
    const { data: deletionRequest, error: fetchError } = await supabase
      .from('gdpr_deletion_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError) {
      console.error('Error fetching deletion request:', fetchError);
      return NextResponse.json(
        { error: 'Deletion request created but failed to fetch details' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deletion_request: deletionRequest,
      message: 'Deletion request created. Data will be deleted in 30 days unless cancelled.',
    });
  } catch (error) {
    console.error('GDPR deletion request error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET /api/gdpr/deletion-request?workspace_id=xxx - List deletion requests
export async function GET(request: NextRequest) {
  try {
    const supabase = await createCleanRouteHandlerClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace_id from query params
    const { searchParams } = new URL(request.url);
    const workspace_id = searchParams.get('workspace_id');
    const status = searchParams.get('status');

    if (!workspace_id) {
      return NextResponse.json(
        { error: 'workspace_id query parameter is required' },
        { status: 400 }
      );
    }

    // Verify user has access to workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'Forbidden: Not a member of this workspace' },
        { status: 403 }
      );
    }

    // Build query
    let query = supabase
      .from('gdpr_deletion_requests')
      .select('*')
      .eq('workspace_id', workspace_id)
      .order('requested_at', { ascending: false });

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }

    const { data: requests, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching deletion requests:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch deletion requests' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deletion_requests: requests || [],
      count: requests?.length || 0,
    });
  } catch (error) {
    console.error('GDPR deletion request list error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// PATCH /api/gdpr/deletion-request - Update deletion request status
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createCleanRouteHandlerClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { request_id, action, rejection_reason } = body;

    // Validate required fields
    if (!request_id || !action) {
      return NextResponse.json(
        { error: 'request_id and action are required' },
        { status: 400 }
      );
    }

    // Valid actions: approve, reject, cancel, execute
    if (!['approve', 'reject', 'cancel', 'execute'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be: approve, reject, cancel, or execute' },
        { status: 400 }
      );
    }

    // Get deletion request
    const { data: deletionRequest, error: fetchError } = await supabase
      .from('gdpr_deletion_requests')
      .select('*, workspace_id')
      .eq('id', request_id)
      .single();

    if (fetchError || !deletionRequest) {
      return NextResponse.json(
        { error: 'Deletion request not found' },
        { status: 404 }
      );
    }

    // Verify user is admin of workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', deletionRequest.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Handle action
    let updateData: any = {};

    switch (action) {
      case 'approve':
        updateData = {
          status: 'approved',
          verified_by: user.id,
          verification_completed_at: new Date().toISOString(),
        };
        break;

      case 'reject':
        if (!rejection_reason) {
          return NextResponse.json(
            { error: 'rejection_reason is required when rejecting' },
            { status: 400 }
          );
        }
        updateData = {
          status: 'rejected',
          rejection_reason,
          verified_by: user.id,
          verification_completed_at: new Date().toISOString(),
        };
        break;

      case 'cancel':
        updateData = {
          status: 'cancelled',
        };
        break;

      case 'execute':
        // Execute deletion using database function
        const { data: executionResult, error: executeError } = await supabase.rpc(
          'execute_gdpr_deletion',
          {
            p_request_id: request_id,
            p_executed_by: user.id,
          }
        );

        if (executeError) {
          console.error('Error executing deletion:', executeError);
          return NextResponse.json(
            {
              error: 'Failed to execute deletion',
              details: executeError.message,
            },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Deletion executed successfully',
          deletion_scope: executionResult.deletion_scope,
        });
    }

    // Update deletion request
    const { data: updatedRequest, error: updateError } = await supabase
      .from('gdpr_deletion_requests')
      .update(updateData)
      .eq('id', request_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating deletion request:', updateError);
      return NextResponse.json(
        { error: 'Failed to update deletion request' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deletion_request: updatedRequest,
      message: `Deletion request ${action}d successfully`,
    });
  } catch (error) {
    console.error('GDPR deletion request update error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
