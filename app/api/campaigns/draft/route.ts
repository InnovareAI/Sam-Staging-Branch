import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/campaigns/draft
 * Save or update a campaign draft
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
      draftId, // If updating existing draft
      workspaceId,
      name,
      campaignType,
      currentStep,
      connectionMessage,
      alternativeMessage,
      followUpMessages,
      csvData, // Prospect data
    } = body;

    if (!workspaceId || !name) {
      return NextResponse.json(
        { error: 'workspaceId and name are required' },
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

    const draftData = {
      csvData: csvData || [],
    };

    if (draftId) {
      // Update existing draft
      const { data: campaign, error: updateError } = await supabase
        .from('campaigns')
        .update({
          name,
          type: campaignType,
          current_step: currentStep,
          connection_message: connectionMessage,
          alternative_message: alternativeMessage,
          follow_up_messages: followUpMessages || [],
          draft_data: draftData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', draftId)
        .eq('workspace_id', workspaceId)
        .eq('status', 'draft') // Only update drafts
        .select()
        .single();

      if (updateError) {
        console.error('Error updating draft:', updateError);
        return NextResponse.json(
          { error: 'Failed to update draft' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        draftId: campaign.id,
        message: 'Draft updated successfully',
      });
    } else {
      // Create new draft
      const { data: campaign, error: createError } = await supabase
        .from('campaigns')
        .insert({
          workspace_id: workspaceId,
          name,
          type: campaignType,
          status: 'draft',
          current_step: currentStep || 1,
          connection_message: connectionMessage,
          alternative_message: alternativeMessage,
          follow_up_messages: followUpMessages || [],
          draft_data: draftData,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating draft:', createError);
        return NextResponse.json(
          { error: 'Failed to create draft' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        draftId: campaign.id,
        message: 'Draft created successfully',
      });
    }
  } catch (error: any) {
    console.error('Draft save error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/campaigns/draft?workspaceId=xxx
 * Get all draft campaigns for a workspace
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
    const draftId = searchParams.get('draftId');

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

    if (draftId) {
      // Get specific draft
      const { data: draft, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', draftId)
        .eq('workspace_id', workspaceId)
        .eq('status', 'draft')
        .single();

      if (error) {
        console.error('Error fetching draft:', error);
        return NextResponse.json({ drafts: [] });
      }

      return NextResponse.json({ draft });
    } else {
      // Get all drafts for workspace
      const { data: drafts, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'draft')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching drafts:', error);
        return NextResponse.json({ drafts: [] });
      }

      return NextResponse.json({ drafts });
    }
  } catch (error: any) {
    console.error('Draft fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/campaigns/draft?draftId=xxx&workspaceId=xxx
 * Delete a draft campaign
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get('draftId');
    const workspaceId = searchParams.get('workspaceId');

    if (!draftId || !workspaceId) {
      return NextResponse.json(
        { error: 'draftId and workspaceId are required' },
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

    // Delete draft
    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', draftId)
      .eq('workspace_id', workspaceId)
      .eq('status', 'draft'); // Only delete drafts

    if (deleteError) {
      console.error('Error deleting draft:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete draft' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Draft deleted successfully',
    });
  } catch (error: any) {
    console.error('Draft delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
