import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { apiError, handleApiError, apiSuccess } from '@/lib/api-error-handler';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createSupabaseRouteClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw apiError.unauthorized();
    }

    const campaignId = params.id;

    // Get campaign details with performance metrics
    const { data: campaign, error } = await supabase
      .from('campaign_performance_summary')
      .select('*')
      .eq('campaign_id', campaignId)
      .single();

    if (error) {
      throw apiError.notFound('Campaign');
    }

    // Verify user has access to this campaign's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', campaign.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      throw apiError.forbidden('Access denied to this campaign');
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

    return apiSuccess({
      campaign: {
        ...campaign,
        messages: messages || []
      }
    });

  } catch (error) {
    return handleApiError(error, 'campaign_get');
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw apiError.unauthorized();
    }

    const campaignId = params.id;
    const updates = await req.json();

    console.log('Campaign update request:', { campaignId, updates, userId: user.id });

    // First, verify the campaign exists and user has access
    const { data: existingCampaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, workspace_id')
      .eq('id', campaignId)
      .single();

    if (fetchError || !existingCampaign) {
      throw apiError.notFound('Campaign');
    }

    // Verify user is a member of the campaign's workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', existingCampaign.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      throw apiError.forbidden('You do not have access to this campaign');
    }

    // Remove fields that shouldn't be updated directly
    const { id, created_at, created_by, workspace_id, ...updateData } = updates;

    // CRITICAL: For email campaigns, validate email body and subject exist when updating messages
    // Get the current campaign to check its type
    const { data: currentCampaign } = await supabase
      .from('campaigns')
      .select('campaign_type, message_templates')
      .eq('id', campaignId)
      .single();

    if (currentCampaign?.campaign_type === 'email') {
      // Check if message_templates is being updated
      if (updateData.message_templates) {
        const templates = updateData.message_templates;
        const emailBody = templates.email_body || templates.alternative_message;
        const emailSubject = templates.initial_subject || templates.email_subject;

        if (!emailBody || emailBody.trim() === '') {
          throw apiError.validation('Email campaigns require an email body', 'Please add email content');
        }

        if (!emailSubject || emailSubject.trim() === '') {
          throw apiError.validation('Email campaigns require a subject line', 'Please add an email subject');
        }

        console.log('✅ Email campaign update validation passed');
      }
    }

    console.log('Updating campaign with data:', updateData);

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
      throw apiError.database('update campaign', error);
    }

    if (!campaign) {
      throw apiError.internal('Campaign update failed', 'No data returned after update');
    }

    console.log('Campaign updated successfully:', campaign.id);

    return apiSuccess({ campaign }, 'Campaign updated successfully');

  } catch (error) {
    return handleApiError(error, 'campaign_put');
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
    const supabase = await createSupabaseRouteClient();

    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw apiError.unauthorized();
    }

    const campaignId = params.id;

    // Get campaign to verify workspace access
    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, workspace_id')
      .eq('id', campaignId)
      .single();

    if (fetchError || !campaign) {
      throw apiError.notFound('Campaign');
    }

    // Verify user has access to this campaign's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', campaign.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      throw apiError.forbidden('Access denied to this campaign');
    }

    // Check if campaign has sent messages (prevent deletion of active campaigns)
    const { data: messages, error: messagesError } = await supabase
      .from('campaign_messages')
      .select('id')
      .eq('campaign_id', campaignId)
      .limit(1);

    if (messagesError) {
      throw apiError.database('check campaign messages', messagesError);
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
        throw apiError.database('archive campaign', archiveError);
      }

      return apiSuccess({ archived: true }, 'Campaign archived (cannot delete campaigns with sent messages)');
    }

    // Delete campaign if no messages sent
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaignId);

    if (error) {
      throw apiError.database('delete campaign', error);
    }

    return apiSuccess({ deleted: true }, 'Campaign deleted successfully');

  } catch (error) {
    return handleApiError(error, 'campaign_delete');
  }
}