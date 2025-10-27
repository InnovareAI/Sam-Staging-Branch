import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all'; // 'pending', 'approved', 'rejected', 'all'
    const campaignId = searchParams.get('campaign_id');
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    // Verify user has access to this workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
    }

    // Base query for messages requiring approval
    let query = supabase
      .from('campaign_messages')
      .select(`
        *,
        campaign_prospects!inner(
          *,
          workspace_prospects!inner(*)
        ),
        campaigns!inner(workspace_id)
      `)
      .eq('campaigns.workspace_id', workspaceId);

    // Filter by campaign if specified
    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    // Filter by status
    if (status !== 'all') {
      query = query.eq('approval_status', status);
    }

    // Order by creation date (newest first)
    query = query.order('created_at', { ascending: false });

    const { data: messages, error } = await query;

    if (error) {
      console.error('Failed to fetch messages for approval:', error);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    // Group messages by status
    const groupedMessages = {
      pending: messages?.filter(m => m.approval_status === 'pending') || [],
      approved: messages?.filter(m => m.approval_status === 'approved') || [],
      rejected: messages?.filter(m => m.approval_status === 'rejected') || []
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
    console.error('Message approval fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages for approval', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      action,
      message_id,
      message_ids,
      approval_status,
      rejection_reason,
      workspace_id
    } = await req.json();

    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    // Verify user has access to this workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
    }

    if (!['approve', 'reject', 'bulk_approve', 'bulk_reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Handle bulk actions
    if (action === 'bulk_approve' || action === 'bulk_reject') {
      if (!message_ids || !Array.isArray(message_ids) || message_ids.length === 0) {
        return NextResponse.json({ error: 'Message IDs array is required for bulk actions' }, { status: 400 });
      }

      const newStatus = action === 'bulk_approve' ? 'approved' : 'rejected';
      
      const { data: updatedMessages, error } = await supabase
        .from('campaign_messages')
        .update({
          approval_status: newStatus,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejection_reason: action === 'bulk_reject' ? rejection_reason || 'Bulk rejection' : null,
          updated_at: new Date().toISOString()
        })
        .in('id', message_ids)
        .select(`
          *,
          campaign_prospects!inner(
            *,
            workspace_prospects!inner(*)
          ),
          campaigns!inner(workspace_id)
        `)
        .eq('campaigns.workspace_id', workspace_id);

      if (error) {
        console.error('Failed to update messages:', error);
        return NextResponse.json({ 
          error: 'Failed to update messages',
          details: error.message 
        }, { status: 500 });
      }

      return NextResponse.json({
        message: `Successfully ${newStatus} ${updatedMessages?.length || 0} messages`,
        action: action,
        updated_messages: updatedMessages,
        count: updatedMessages?.length || 0
      });
    }

    // Handle single message actions
    if (!message_id) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const { data: updatedMessage, error } = await supabase
      .from('campaign_messages')
      .update({
        approval_status: newStatus,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        rejection_reason: action === 'reject' ? rejection_reason || 'Message rejected' : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', message_id)
      .select(`
        *,
        campaign_prospects!inner(
          *,
          workspace_prospects!inner(*)
        ),
        campaigns!inner(workspace_id)
      `)
      .eq('campaigns.workspace_id', workspace_id)
      .single();

    if (error) {
      console.error('Failed to update message:', error);
      return NextResponse.json({ 
        error: 'Failed to update message',
        details: error.message 
      }, { status: 500 });
    }

    if (!updatedMessage) {
      return NextResponse.json({ error: 'Message not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({
      message: `Message ${newStatus} successfully`,
      action: action,
      updated_message: updatedMessage
    });

  } catch (error: any) {
    console.error('Message approval action error:', error);
    return NextResponse.json(
      { error: 'Failed to process approval action', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    console.error('Message approval API info error:', error);
    return NextResponse.json(
      { error: 'Request failed', details: error.message },
      { status: 500 }
    );
  }
}