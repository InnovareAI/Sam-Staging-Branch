import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { apiError, handleApiError, apiSuccess } from '@/lib/api-error-handler';
import { requireActiveSubscription } from '@/lib/subscription-guard';

// Campaign launch API - connects Campaign Hub to N8N orchestration
export async function POST(request: NextRequest) {
  try {
    // Firebase authentication
    const { userId, workspaceId } = await verifyAuth(request);

    // Get user's workspace details
    const workspaceMemberResult = await pool.query(
      `SELECT wm.workspace_id, w.id as ws_id, w.name as ws_name
       FROM workspace_members wm
       JOIN workspaces w ON wm.workspace_id = w.id
       WHERE wm.user_id = $1`,
      [userId]
    );

    if (workspaceMemberResult.rows.length === 0) {
      throw apiError.notFound('Workspace');
    }

    const workspaceMember = workspaceMemberResult.rows[0];
    const targetWorkspaceId = workspaceMember.workspace_id;

    // CRITICAL: Check subscription status before allowing campaign launch
    // Note: requireActiveSubscription may need to be adapted for pool queries
    // For now, we'll do a direct query
    const subscriptionResult = await pool.query(
      `SELECT tier_status FROM workspace_tiers WHERE workspace_id = $1`,
      [targetWorkspaceId]
    );

    if (subscriptionResult.rows.length === 0 || subscriptionResult.rows[0].tier_status !== 'active') {
      throw apiError.forbidden('Active subscription required to launch campaigns');
    }

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
    const tierResult = await pool.query(
      `SELECT tier_type, tier_status FROM workspace_tiers WHERE workspace_id = $1`,
      [targetWorkspaceId]
    );

    const workspaceTier = tierResult.rows[0];

    if (!workspaceTier || workspaceTier.tier_status !== 'active') {
      throw apiError.forbidden('Workspace tier not active');
    }

    // Get integration configurations based on tier
    let integrationConfig: any = {};

    if (workspaceTier.tier_type === 'startup') {
      // Startup tier: Unipile only
      const unipileResult = await pool.query(
        `SELECT * FROM workspace_unipile_integrations
         WHERE workspace_id = $1 AND instance_status = 'active'`,
        [targetWorkspaceId]
      );

      if (unipileResult.rows.length === 0) {
        throw apiError.validation('Unipile integration not configured');
      }

      const unipileConfig = unipileResult.rows[0];

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
        pool.query(
          `SELECT * FROM workspace_unipile_integrations
           WHERE workspace_id = $1 AND instance_status = 'active'`,
          [targetWorkspaceId]
        ),
        pool.query(
          `SELECT * FROM workspace_reachinbox_integrations
           WHERE workspace_id = $1 AND integration_status = 'active'`,
          [targetWorkspaceId]
        )
      ]);

      if (unipileResult.rows.length === 0 || reachinboxResult.rows.length === 0) {
        throw apiError.validation('Integrations not fully configured');
      }

      const unipileData = unipileResult.rows[0];
      const reachinboxData = reachinboxResult.rows[0];

      integrationConfig = {
        tier: workspaceTier.tier_type,
        unipile: {
          instance_url: unipileData.unipile_instance_url,
          linkedin_accounts: unipileData.linkedin_accounts,
          rate_limits: {
            linkedin_daily: unipileData.linkedin_daily_limit,
            linkedin_hourly: unipileData.linkedin_hourly_limit
          }
        },
        reachinbox: {
          api_key: reachinboxData.reachinbox_api_key,
          domains: [
            reachinboxData.reachinbox_domain_1,
            reachinboxData.reachinbox_domain_2
          ].filter(Boolean),
          email_accounts: reachinboxData.email_accounts,
          reply_inbox: reachinboxData.reply_inbox_email,
          rate_limits: {
            email_daily: reachinboxData.daily_email_limit,
            email_hourly: reachinboxData.hourly_email_limit
          }
        }
      };
    }

    // Get prospect data if targetAudience includes prospect IDs
    let prospectData: any[] = [];
    let filteredOutCount = 0;

    if (campaignConfig.targetAudience.prospectIds?.length > 0) {
      const prospectsResult = await pool.query(
        `SELECT
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
         FROM approved_prospects
         WHERE workspace_id = $1
           AND id = ANY($2)`,
        [targetWorkspaceId, campaignConfig.targetAudience.prospectIds]
      );

      const prospects = prospectsResult.rows;

      // CRITICAL: Filter out invalid prospects
      // Only include prospects that are:
      // 1. validation_status = 'valid' OR NULL (legacy data)
      // 2. has_previous_contact = false OR NULL
      // 3. Have at least email OR LinkedIn URL

      if (prospects) {
        const validProspects = prospects.filter((prospect: any) => {
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
          console.log(`Filtered out ${filteredOutCount} invalid prospects from campaign`);
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
    const knowledgeBaseResult = await pool.query(
      `SELECT content, item_type, tags
       FROM knowledge_base_items
       WHERE workspace_id = $1 AND status = 'approved'`,
      [targetWorkspaceId]
    );

    const knowledgeBase = knowledgeBaseResult.rows;

    // Prepare N8N payload
    const n8nPayload = {
      // Workspace identification
      workspace_id: targetWorkspaceId,
      workspace_name: workspaceMember.ws_name,

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
    const executionResult = await pool.query(
      `INSERT INTO n8n_campaign_executions
        (workspace_id, campaign_name, campaign_type, campaign_config, target_audience_size, execution_status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        targetWorkspaceId,
        campaignConfig.campaignName,
        campaignConfig.campaignType,
        JSON.stringify(n8nPayload),
        prospectData.length,
        'queued',
        userId
      ]
    );

    if (executionResult.rows.length === 0) {
      throw apiError.database('campaign execution creation', new Error('Insert failed'));
    }

    const campaignExecution = executionResult.rows[0];

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
      await pool.query(
        `UPDATE n8n_campaign_executions
         SET execution_status = 'failed', error_message = $1
         WHERE id = $2`,
        [`N8N webhook failed: ${n8nResponse.statusText}`, campaignExecution.id]
      );

      throw apiError.internal(`Failed to trigger N8N campaign: ${n8nResponse.statusText}`);
    }

    const n8nResult = await n8nResponse.json();

    // Update campaign execution with N8N details
    await pool.query(
      `UPDATE n8n_campaign_executions
       SET n8n_execution_id = $1, n8n_workflow_id = $2, execution_status = 'running', started_at = $3
       WHERE id = $4`,
      [n8nResult.execution_id, n8nResult.workflow_id, new Date().toISOString(), campaignExecution.id]
    );

    // Send campaign launch notification
    try {
      const { sendCampaignLaunchNotification } = await import('@/lib/notifications/sam-email');

      // Get user details
      const userResult = await pool.query(
        `SELECT email, first_name FROM users WHERE id = $1`,
        [userId]
      );

      const userData = userResult.rows[0];

      if (userData && userData.email) {
        await sendCampaignLaunchNotification({
          userEmail: userData.email,
          userName: userData.first_name || 'there',
          campaignName: campaignConfig.campaignName,
          campaignId: campaignExecution.id,
          prospectCount: prospectData.length
        });
        console.log(`Campaign launch notification sent to ${userData.email}`);
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
    // Handle AuthError from verifyAuth
    if (error && typeof error === 'object' && 'code' in error && 'statusCode' in error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    return handleApiError(error, 'campaign_launch');
  }
}
