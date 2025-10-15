import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaignId = params.id;

    // Get campaign details with performance metrics
    const { data: campaign, error } = await supabase
      .from('campaign_performance_summary')
      .select('*')
      .eq('campaign_id', campaignId)
      .single();

    if (error) {
      console.error('Failed to fetch campaign:', error);
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Get campaign messages and replies
    const { data: messages, error: messagesError } = await supabase
      .from('campaign_messages')
      .select(`
        *,
        campaign_replies (*)
      `)
      .eq('campaign_id', campaignId)
      .order('sent_at', { ascending: false });

    if (messagesError) {
      console.error('Failed to fetch campaign messages:', messagesError);
    }

    return NextResponse.json({ 
      campaign: {
        ...campaign,
        messages: messages || []
      }
    });

  } catch (error: any) {
    console.error('Campaign fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaignId = params.id;
    const updates = await req.json();

    // Remove fields that shouldn't be updated directly
    const { id, created_at, created_by, workspace_id, ...updateData } = updates;

    // Update campaign
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update campaign:', error);
      return NextResponse.json({
        error: 'Failed to update campaign',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Campaign updated successfully',
      campaign
    });

  } catch (error: any) {
    console.error('Campaign update error:', error);
    return NextResponse.json(
      { error: 'Failed to update campaign', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // PATCH is the same as PUT for this endpoint
  return PUT(req, { params });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaignId = params.id;

    // Check if campaign has sent messages (prevent deletion of active campaigns)
    const { data: messages, error: messagesError } = await supabase
      .from('campaign_messages')
      .select('id')
      .eq('campaign_id', campaignId)
      .limit(1);

    if (messagesError) {
      console.error('Failed to check campaign messages:', messagesError);
      return NextResponse.json({ 
        error: 'Failed to verify campaign status' 
      }, { status: 500 });
    }

    if (messages && messages.length > 0) {
      // Archive instead of delete if messages exist
      const { error: archiveError } = await supabase
        .from('campaigns')
        .update({ 
          status: 'archived',
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      if (archiveError) {
        console.error('Failed to archive campaign:', archiveError);
        return NextResponse.json({ 
          error: 'Failed to archive campaign' 
        }, { status: 500 });
      }

      return NextResponse.json({ 
        message: 'Campaign archived (cannot delete campaigns with sent messages)' 
      });
    }

    // Delete campaign if no messages sent
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaignId);

    if (error) {
      console.error('Failed to delete campaign:', error);
      return NextResponse.json({ 
        error: 'Failed to delete campaign',
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Campaign deleted successfully' 
    });

  } catch (error: any) {
    console.error('Campaign deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete campaign', details: error.message },
      { status: 500 }
    );
  }
}