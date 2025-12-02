import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { apiError, handleApiError, apiSuccess } from '@/lib/api-error-handler';
import { requireActiveSubscription } from '@/lib/subscription-guard';

// Campaign launch API - connects Campaign Hub to N8N orchestration
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      throw apiError.unauthorized();
    }

    // Get user's workspace
    const { data: workspaceMember } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(id, name)')
      .eq('user_id', session.user.id)
      .single();

    if (!workspaceMember) {
      throw apiError.notFound('Workspace');
    }

    const workspaceId = workspaceMember.workspace_id;

    // CRITICAL: Check subscription status before allowing campaign launch
    await requireActiveSubscription(supabase, workspaceId);

    // Parse campaign configuration from request
    const campaignConfig = await request.json();
    
    // Validate required fields
    const requiredFields = ['campaignName', 'campaignType', 'targetAudience'];
    for (const field of requiredFields) {
      if (!campaignConfig[field]) {
        throw apiError.validation(
          `Missing required field: ${field}`,
          'Campaign name, type, and target audience are required'
        );
      }
    }

    // Get workspace tier and integration settings
    const { data: workspaceTier } = await supabase
      .from('workspace_tiers')
      .select('tier_type, tier_status')
      .eq('workspace_id', workspaceId)
      .single();

    if (!workspaceTier || workspaceTier.tier_status !== 'active') {
      throw apiError.forbidden('Workspace tier not active');
    }

    // Get integration configurations based on tier
    let integrationConfig: any = {};
    
    if (workspaceTier.tier_type === 'startup') {
      // Startup tier: Unipile only
      const { data: unipileConfig } = await supabase
        .from('workspace_unipile_integrations')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('instance_status', 'active')
        .single();

      if (!unipileConfig) {
        throw apiError.validation('Unipile integration not configured');
      }

      integrationConfig = {
        tier: 'startup',
        unipile: {
          instance_url: unipileConfig.unipile_instance_url,
          linkedin_accounts: unipileConfig.linkedin_accounts,
          email_accounts: unipileConfig.email_accounts,
          rate_limits: {
            linkedin_daily: unipileConfig.linkedin_daily_limit,
            linkedin_hourly: unipileConfig.linkedin_hourly_limit,
            email_daily: unipileConfig.email_daily_limit,
            email_hourly: unipileConfig.email_hourly_limit
          }
        }
      };
    } else {
      // SME/Enterprise tier: ReachInbox + Unipile
      const [unipileResult, reachinboxResult] = await Promise.all([
        supabase
          .from('workspace_unipile_integrations')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('instance_status', 'active')
          .single(),
        supabase
          .from('workspace_reachinbox_integrations')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('integration_status', 'active')
          .single()
      ]);

      if (!unipileResult.data || !reachinboxResult.data) {
        throw apiError.validation('Integrations not fully configured');
      }

      integrationConfig = {
        tier: workspaceTier.tier_type,
        unipile: {
          instance_url: unipileResult.data.unipile_instance_url,
          linkedin_accounts: unipileResult.data.linkedin_accounts,
          rate_limits: {
            linkedin_daily: unipileResult.data.linkedin_daily_limit,
            linkedin_hourly: unipileResult.data.linkedin_hourly_limit
          }
        },
        reachinbox: {
          api_key: reachinboxResult.data.reachinbox_api_key,
          domains: [
            reachinboxResult.data.reachinbox_domain_1,
            reachinboxResult.data.reachinbox_domain_2
          ].filter(Boolean),
          email_accounts: reachinboxResult.data.email_accounts,
          reply_inbox: reachinboxResult.data.reply_inbox_email,
          rate_limits: {
            email_daily: reachinboxResult.data.daily_email_limit,
            email_hourly: reachinboxResult.data.hourly_email_limit
          }
        }
      };
    }

    // Get prospect data if targetAudience includes prospect IDs
    let prospectData = [];
    let filteredOutCount = 0;

    if (campaignConfig.targetAudience.prospectIds?.length > 0) {
      const { data: prospects } = await supabase
        .from('approved_prospects')
        .select(`
          id,
          company_name,
          contact_name,
          contact_email,
          contact_linkedin_url,
          contact_title,
          company_website,
          company_industry,
          company_size,
          enrichment_data,
          approved_at,
          icp_analysis,
          validation_status,
          validation_errors,
          has_previous_contact
        `)
        .eq('workspace_id', workspaceId)
        .in('id', campaignConfig.targetAudience.prospectIds);

      // CRITICAL: Filter out invalid prospects
      // Only include prospects that are:
      // 1. validation_status = 'valid' OR NULL (legacy data)
      // 2. has_previous_contact = false OR NULL
      // 3. Have at least email OR LinkedIn URL

      if (prospects) {
        const validProspects = prospects.filter(prospect => {
          // Check validation status
          const validationStatus = prospect.validation_status || 'valid';
          if (validationStatus === 'error' || validationStatus === 'blocked') {
            filteredOutCount++;
            console.warn(`Prospect ${prospect.id} filtered: validation_status = ${validationStatus}`);
            return false;
          }

          // Check previous contact
          if (prospect.has_previous_contact) {
            filteredOutCount++;
            console.warn(`Prospect ${prospect.id} filtered: previously contacted`);
            return false;
          }

          // Check required contact methods
          if (!prospect.contact_email && !prospect.contact_linkedin_url) {
            filteredOutCount++;
            console.warn(`Prospect ${prospect.id} filtered: no contact method`);
            return false;
          }

          return true;
        });

        prospectData = validProspects;

        if (filteredOutCount > 0) {
          console.log(`🚫 Filtered out ${filteredOutCount} invalid prospects from campaign`);
        }
      }
    }

    // Validate we have valid prospects
    if (prospectData.length === 0 && campaignConfig.targetAudience.prospectIds?.length > 0) {
      throw apiError.validation(
        'No valid prospects available',
        `All ${campaignConfig.targetAudience.prospectIds.length} prospects were filtered out due to data quality issues. Check prospect validation status.`
      );
    }

    // Get workspace knowledge base data for personalization
    const { data: knowledgeBase } = await supabase
      .from('knowledge_base_items')
      .select('content, item_type, tags')
      .eq('workspace_id', workspaceId)
      .eq('status', 'approved');

    // Prepare N8N payload
    const n8nPayload = {
      // Workspace identification
      workspace_id: workspaceId,
      workspace_name: (workspaceMember.workspaces as any)?.name,
      
      // Campaign configuration
      campaign: {
        name: campaignConfig.campaignName,
        type: campaignConfig.campaignType, // 'email_only', 'linkedin_only', 'multi_channel'
        description: campaignConfig.description,
        messaging_templates: campaignConfig.messagingTemplates,
        follow_up_sequence: campaignConfig.followUpSequence,
        personalization_level: campaignConfig.personalizationLevel || 'medium'
      },

      // Target audience and prospect data
      prospects: prospectData,
      target_criteria: campaignConfig.targetAudience.criteria,
      expected_volume: prospectData.length,

      // Integration configurations
      integrations: integrationConfig,

      // Knowledge base for personalization
      knowledge_base: knowledgeBase || [],

      // Campaign settings
      settings: {
        launch_immediately: campaignConfig.launchImmediately || false,
        require_message_approval: campaignConfig.requireMessageApproval !== false,
        daily_send_limit: campaignConfig.dailySendLimit,
        time_zone: campaignConfig.timeZone || 'UTC',
        sending_schedule: campaignConfig.sendingSchedule
      },

      // Callback URLs for status updates
      callbacks: {
        status_update: `${process.env.NEXT_PUBLIC_APP_URL}/api/campaign/status-update`,
        approval_required: `${process.env.NEXT_PUBLIC_APP_URL}/api/campaign/approval-required`,
        completion: `${process.env.NEXT_PUBLIC_APP_URL}/api/campaign/completion`
      }
    };

    // Create campaign execution record
    const { data: campaignExecution, error: insertError } = await supabase
      .from('n8n_campaign_executions')
      .insert({
        workspace_id: workspaceId,
        campaign_name: campaignConfig.campaignName,
        campaign_type: campaignConfig.campaignType,
        campaign_config: n8nPayload,
        target_audience_size: prospectData.length,
        execution_status: 'queued',
        created_by: session.user.id
      })
      .select()
      .single();

    if (insertError) {
      throw apiError.database('campaign execution creation', insertError);
    }

    // Add campaign execution ID to N8N payload
    (n8nPayload as any).campaign_execution_id = campaignExecution.id;

    // Send to N8N orchestration webhook
    const n8nWebhookUrl = process.env.N8N_CAMPAIGN_WEBHOOK_URL;
    if (!n8nWebhookUrl) {
      throw apiError.internal('N8N webhook URL not configured');
    }

    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.N8N_API_KEY}`
      },
      body: JSON.stringify(n8nPayload)
    });

    if (!n8nResponse.ok) {
      // Update campaign status to failed
      await supabase
        .from('n8n_campaign_executions')
        .update({
          execution_status: 'failed',
          error_message: `N8N webhook failed: ${n8nResponse.statusText}`
        })
        .eq('id', campaignExecution.id);

      throw apiError.internal(`Failed to trigger N8N campaign: ${n8nResponse.statusText}`);
    }

    const n8nResult = await n8nResponse.json();

    // Update campaign execution with N8N details
    await supabase
      .from('n8n_campaign_executions')
      .update({
        n8n_execution_id: n8nResult.execution_id,
        n8n_workflow_id: n8nResult.workflow_id,
        execution_status: 'running',
        started_at: new Date().toISOString()
      })
      .eq('id', campaignExecution.id);

    // Send campaign launch notification
    try {
      const { sendCampaignLaunchNotification } = await import('@/lib/notifications/sam-email');

      // Get user details
      const { data: userData } = await supabase
        .from('users')
        .select('email, first_name')
        .eq('id', session.user.id)
        .single();

      if (userData && userData.email) {
        await sendCampaignLaunchNotification({
          userEmail: userData.email,
          userName: userData.first_name || 'there',
          campaignName: campaignConfig.campaignName,
          campaignId: campaignExecution.id,
          prospectCount: prospectData.length
        });
        console.log(`✅ Campaign launch notification sent to ${userData.email}`);
      }
    } catch (emailError) {
      // Don't fail the request if email fails
      console.error('Failed to send campaign launch notification:', emailError);
    }

    // Return campaign execution details
    return apiSuccess({
      campaign_execution_id: campaignExecution.id,
      n8n_execution_id: n8nResult.execution_id,
      status: 'running',
      prospects_count: prospectData.length,
      estimated_completion: n8nResult.estimated_completion
    }, 'Campaign launched successfully');

  } catch (error) {
    return handleApiError(error, 'campaign_launch');
  }
}
