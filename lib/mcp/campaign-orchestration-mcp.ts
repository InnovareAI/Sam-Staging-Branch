/**
 * MCP Campaign Orchestration Tools for Sam-First System
 * Handles campaign creation, execution, and monitoring through conversational interface
 */

import { supabaseAdmin } from '@/app/lib/supabase';
import { mcp__template__get_by_criteria, mcp__template__get_by_id } from './template-mcp';
import { mcp__sonnet__personalize_for_prospect } from './sonnet-mcp';

export interface CampaignRequest {
  workspace_id: string;
  campaign_name: string;
  campaign_type: 'sam_signature' | 'event_invitation' | 'product_launch' | 'partnership' | 'custom';
  target_criteria: {
    industry?: string;
    role?: string;
    company_size?: string;
    location?: string;
  };
  template_preference?: {
    template_id?: string;
    template_name?: string;
    use_top_performer?: boolean;
  };
  execution_preferences: {
    start_date?: string;
    daily_limit?: number;
    personalization_level: 'basic' | 'advanced' | 'deep';
    channels: ('linkedin' | 'email')[];
  };
}

export interface CampaignExecutionPlan {
  campaign_id: string;
  template: {
    connection_message: string;
    alternative_message?: string;
    follow_up_messages: string[];
  };
  prospects: Array<{
    id: string;
    first_name: string;
    last_name: string;
    company_name: string;
    title: string;
    linkedin_url?: string;
    email?: string;
  }>;
  execution_schedule: {
    start_date: string;
    daily_batches: Array<{
      date: string;
      prospect_count: number;
      estimated_completion: string;
    }>;
  };
}

/**
 * Sam creates a campaign from conversational input
 */
export async function mcp__sam__create_campaign(request: CampaignRequest): Promise<{
  success: boolean;
  campaign_id?: string;
  execution_plan?: CampaignExecutionPlan;
  error?: string;
}> {
  try {
    const supabase = supabaseAdmin();

    // 1. Find suitable template
    const templateResult = await findBestTemplate(request);
    if (!templateResult.success) {
      return { success: false, error: 'Could not find suitable template' };
    }

    // 2. Find prospects based on criteria
    const prospectsResult = await findProspectsForCampaign(request);
    if (!prospectsResult.success) {
      return { success: false, error: 'Could not find prospects matching criteria' };
    }

    // 3. Create campaign record
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        workspace_id: request.workspace_id,
        name: request.campaign_name,
        type: request.campaign_type,
        status: 'draft',
        target_criteria: request.target_criteria,
        execution_preferences: request.execution_preferences,
        template_id: templateResult.template?.id,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (campaignError) {
      return { success: false, error: campaignError.message };
    }

    // 4. Associate prospects with campaign
    const prospectAssociations = prospectsResult.prospects?.map(prospect => ({
      campaign_id: campaign.id,
      prospect_id: prospect.id,
      status: 'pending'
    })) || [];

    if (prospectAssociations.length > 0) {
      const { error: associationError } = await supabase
        .from('campaign_prospects')
        .insert(prospectAssociations);

      if (associationError) {
        console.error('Warning: Could not associate all prospects:', associationError);
      }
    }

    // 5. Create execution plan
    const executionPlan: CampaignExecutionPlan = {
      campaign_id: campaign.id,
      template: {
        connection_message: templateResult.template?.connection_message || '',
        alternative_message: templateResult.template?.alternative_message,
        follow_up_messages: templateResult.template?.follow_up_messages || []
      },
      prospects: prospectsResult.prospects || [],
      execution_schedule: createExecutionSchedule(
        prospectsResult.prospects?.length || 0,
        request.execution_preferences
      )
    };

    return {
      success: true,
      campaign_id: campaign.id,
      execution_plan
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Campaign creation failed'
    };
  }
}

/**
 * Sam executes a campaign with dynamic personalization
 */
export async function mcp__sam__execute_campaign(params: {
  campaign_id: string;
  workspace_id: string;
  execution_mode: 'immediate' | 'scheduled' | 'test';
  batch_size?: number;
}): Promise<{
  success: boolean;
  execution_id?: string;
  status?: 'started' | 'scheduled' | 'test_complete';
  summary?: {
    total_prospects: number;
    messages_sent: number;
    estimated_completion: string;
  };
  error?: string;
}> {
  try {
    const supabase = supabaseAdmin();

    // 1. Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', params.campaign_id)
      .eq('workspace_id', params.workspace_id)
      .single();

    if (campaignError || !campaign) {
      return { success: false, error: 'Campaign not found' };
    }

    // 2. Get campaign prospects
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select(`
        *,
        workspace_prospects (
          first_name,
          last_name,
          company_name,
          job_title,
          linkedin_profile_url,
          email_address
        )
      `)
      .eq('campaign_id', params.campaign_id)
      .eq('status', 'pending')
      .limit(params.batch_size || 50);

    if (prospectsError) {
      return { success: false, error: prospectsError.message };
    }

    if (!prospects || prospects.length === 0) {
      return { success: false, error: 'No pending prospects found' };
    }

    // 3. Get template for personalization
    const templateResult = await mcp__template__get_by_id({
      template_id: campaign.template_id,
      workspace_id: params.workspace_id
    });

    if (!templateResult.success || !templateResult.template) {
      return { success: false, error: 'Campaign template not found' };
    }

    // 4. Execute based on mode
    if (params.execution_mode === 'test') {
      // Test mode: personalize first 3 prospects without sending
      const testResults = [];
      for (let i = 0; i < Math.min(3, prospects.length); i++) {
        const prospect = prospects[i];
        const personalized = await personalizeForProspect(
          templateResult.template,
          prospect.workspace_prospects,
          campaign.execution_preferences?.personalization_level || 'basic'
        );
        testResults.push({
          prospect: prospect.workspace_prospects,
          personalized_messages: personalized
        });
      }

      return {
        success: true,
        execution_id: `test_${Date.now()}`,
        status: 'test_complete',
        summary: {
          total_prospects: prospects.length,
          messages_sent: 0,
          estimated_completion: 'Test complete'
        }
      };
    }

    // 5. Real execution via N8N workflow or LinkedIn API
    let executionResult: any;
    
    // Check if workspace has N8N workflow configured
    if (campaign.execution_preferences?.use_n8n_workflow) {
      // Execute via N8N workflow
      const n8nResponse = await executeViaN8NWorkflow({
        campaign_id: params.campaign_id,
        workspace_id: params.workspace_id,
        prospects,
        template: templateResult.template,
        execution_preferences: campaign.execution_preferences
      });
      
      executionResult = n8nResponse;
    } else {
      // Execute via N8N LinkedIn execution endpoint
      const executionResponse = await fetch('/api/campaigns/linkedin/execute-via-n8n', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: params.campaign_id,
          executionType: campaign.execution_preferences?.execution_type || 'direct_linkedin'
        })
      });

      executionResult = await executionResponse.json();
    }

    if (!executionResult.success) {
      return { success: false, error: executionResult.error };
    }

    // 6. Update campaign status
    await supabase
      .from('campaigns')
      .update({ 
        status: 'active',
        started_at: new Date().toISOString()
      })
      .eq('id', params.campaign_id);

    return {
      success: true,
      execution_id: executionResult.execution_id,
      status: 'started',
      summary: {
        total_prospects: prospects.length,
        messages_sent: prospects.length,
        estimated_completion: executionResult.execution_details?.estimated_completion_time || 'Unknown'
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Campaign execution failed'
    };
  }
}

/**
 * Sam monitors campaign progress
 */
export async function mcp__sam__get_campaign_status(params: {
  campaign_id: string;
  workspace_id: string;
}): Promise<{
  success: boolean;
  status?: {
    campaign_name: string;
    current_status: string;
    prospects_total: number;
    prospects_processed: number;
    prospects_responded: number;
    response_rate: number;
    last_activity: string;
    next_action?: string;
  };
  error?: string;
}> {
  try {
    const supabase = supabaseAdmin();

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', params.campaign_id)
      .eq('workspace_id', params.workspace_id)
      .single();

    if (campaignError || !campaign) {
      return { success: false, error: 'Campaign not found' };
    }

    // Get prospect statistics
    const { data: prospectStats, error: statsError } = await supabase
      .from('campaign_prospects')
      .select('status')
      .eq('campaign_id', params.campaign_id);

    if (statsError) {
      return { success: false, error: statsError.message };
    }

    const stats = prospectStats?.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    const total = prospectStats?.length || 0;
    const processed = (stats.completed || 0) + (stats.responded || 0);
    const responded = stats.responded || 0;
    const responseRate = total > 0 ? (responded / total) * 100 : 0;

    return {
      success: true,
      status: {
        campaign_name: campaign.name,
        current_status: campaign.status,
        prospects_total: total,
        prospects_processed: processed,
        prospects_responded: responded,
        response_rate: Math.round(responseRate * 100) / 100,
        last_activity: campaign.updated_at || campaign.created_at,
        next_action: determineNextAction(campaign, stats)
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Status check failed'
    };
  }
}

// Helper functions

async function findBestTemplate(request: CampaignRequest) {
  if (request.template_preference?.template_id) {
    return await mcp__template__get_by_id({
      template_id: request.template_preference.template_id,
      workspace_id: request.workspace_id
    });
  }

  return await mcp__template__get_by_criteria({
    workspace_id: request.workspace_id,
    industry: request.target_criteria.industry,
    target_role: request.target_criteria.role,
    campaign_type: request.campaign_type,
    limit: 1
  }).then(result => ({
    success: result.success,
    template: result.templates?.[0],
    error: result.error
  }));
}

async function findProspectsForCampaign(request: CampaignRequest) {
  try {
    const supabase = supabaseAdmin();
    
    let query = supabase
      .from('workspace_prospects')
      .select('*')
      .eq('workspace_id', request.workspace_id);

    if (request.target_criteria.industry) {
      query = query.ilike('industry', `%${request.target_criteria.industry}%`);
    }
    if (request.target_criteria.role) {
      query = query.ilike('job_title', `%${request.target_criteria.role}%`);
    }

    const { data, error } = await query.limit(500);

    if (error) {
      return { success: false, error: error.message };
    }

    const prospects = data?.map(p => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      company_name: p.company_name,
      title: p.job_title,
      linkedin_url: p.linkedin_profile_url,
      email: p.email_address
    })) || [];

    return { success: true, prospects };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Prospect search failed' 
    };
  }
}

function createExecutionSchedule(prospectCount: number, preferences: any) {
  const dailyLimit = preferences.daily_limit || 50;
  const startDate = new Date(preferences.start_date || Date.now());
  
  const batches = [];
  let remainingProspects = prospectCount;
  let currentDate = new Date(startDate);

  while (remainingProspects > 0) {
    const batchSize = Math.min(dailyLimit, remainingProspects);
    batches.push({
      date: currentDate.toISOString().split('T')[0],
      prospect_count: batchSize,
      estimated_completion: new Date(currentDate.getTime() + 8 * 60 * 60 * 1000).toISOString() // +8 hours
    });
    
    remainingProspects -= batchSize;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return {
    start_date: startDate.toISOString().split('T')[0],
    daily_batches: batches
  };
}

async function personalizeForProspect(template: any, prospect: any, level: string) {
  if (level === 'basic') {
    return {
      connection_message: template.connection_message
        .replace(/{first_name}/g, prospect.first_name)
        .replace(/{company_name}/g, prospect.company_name),
      follow_up_messages: template.follow_up_messages?.map((msg: string) => 
        msg.replace(/{first_name}/g, prospect.first_name)
           .replace(/{company_name}/g, prospect.company_name)
      ) || []
    };
  }

  // For advanced/deep personalization, use Mistral
  const personalizationResult = await mcp__sonnet__personalize_for_prospect({
    template: {
      connection_message: template.connection_message,
      follow_up_messages: template.follow_up_messages || []
    },
    prospect_data: {
      first_name: prospect.first_name,
      last_name: prospect.last_name,
      company_name: prospect.company_name,
      title: prospect.job_title,
      industry: prospect.industry || 'Unknown'
    },
    personalization_level: level as 'advanced' | 'deep'
  });

  return personalizationResult.success 
    ? personalizationResult.personalized_template 
    : await personalizeForProspect(template, prospect, 'basic');
}

function determineNextAction(campaign: any, stats: Record<string, number>): string | undefined {
  if (campaign.status === 'draft') return 'Ready to execute';
  if (campaign.status === 'active') {
    const pending = stats.pending || 0;
    if (pending > 0) return `${pending} prospects awaiting outreach`;
    return 'Monitor responses and follow up';
  }
  if (campaign.status === 'completed') return 'Review results and optimize';
  return undefined;
}

/**
 * Execute campaign via N8N workflow
 */
async function executeViaN8NWorkflow(params: {
  campaign_id: string;
  workspace_id: string;
  prospects: any[];
  template: any;
  execution_preferences: any;
}): Promise<{ success: boolean; execution_id?: string; error?: string }> {
  try {
    // Get workspace N8N configuration
    const supabase = supabaseAdmin();
    const { data: workspaceConfig } = await supabase
      .from('workspace_n8n_workflows')
      .select('*')
      .eq('workspace_id', params.workspace_id)
      .eq('is_active', true)
      .single();

    if (!workspaceConfig) {
      console.log('⚠️  No N8N workflow configured, falling back to direct API');
      return { success: false, error: 'No N8N workflow configured for workspace' };
    }

    // Execute N8N workflow via webhook
    const n8nWebhookUrl = `https://workflows.innovareai.com/webhook/${workspaceConfig.webhook_id}`;
    
    const workflowPayload = {
      campaign_id: params.campaign_id,
      workspace_id: params.workspace_id,
      prospects: params.prospects.map(p => ({
        id: p.id,
        first_name: p.workspace_prospects?.first_name,
        last_name: p.workspace_prospects?.last_name,
        company_name: p.workspace_prospects?.company_name,
        job_title: p.workspace_prospects?.job_title,
        linkedin_profile_url: p.workspace_prospects?.linkedin_profile_url,
        email_address: p.workspace_prospects?.email_address
      })),
      template: {
        connection_message: params.template.connection_message,
        follow_up_messages: params.template.follow_up_messages
      },
      execution_preferences: params.execution_preferences,
      execution_timestamp: new Date().toISOString()
    };

    console.log('🔄 Executing N8N workflow:', n8nWebhookUrl);
    
    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sam-AI-Signature': generateSamSignature(workflowPayload)
      },
      body: JSON.stringify(workflowPayload),
      timeout: 30000 // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(`N8N workflow failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    // Log workflow execution
    await supabase
      .from('n8n_campaign_executions')
      .insert({
        campaign_id: params.campaign_id,
        workspace_id: params.workspace_id,
        workflow_id: workspaceConfig.workflow_id,
        execution_id: result.execution_id || `n8n_${Date.now()}`,
        status: 'started',
        prospect_count: params.prospects.length,
        execution_data: workflowPayload
      });

    return {
      success: true,
      execution_id: result.execution_id || `n8n_${Date.now()}`
    };

  } catch (error) {
    console.error('❌ N8N workflow execution failed:', error);
    return { 
      success: false, 
      error: `N8N execution failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Generate signature for N8N webhook security
 */
function generateSamSignature(payload: any): string {
  // Simple signature for webhook validation
  // In production, use proper HMAC with secret key
  const timestamp = Date.now();
  const data = JSON.stringify(payload);
  return `sam_${timestamp}_${Buffer.from(data).toString('base64').substring(0, 16)}`;
}

/**
 * Create a LinkedIn campaign with flexible flow settings
 * Enables SAM to create campaigns via conversational interface
 */
export async function mcp__sam__create_linkedin_campaign_with_flow(params: {
  workspace_id: string;
  name: string;
  connection_wait_hours?: number; // 12-96, default 36
  followup_wait_days?: number; // 1-30, default 5
  messages: {
    connection_request: string;
    follow_up_1?: string | null;
    follow_up_2?: string | null;
    follow_up_3?: string | null;
    follow_up_4?: string | null;
    follow_up_5?: string | null;
    follow_up_6?: string | null;
    goodbye?: string | null;
  };
  metadata?: any;
}): Promise<{
  success: boolean;
  campaign_id?: string;
  campaign_name?: string;
  flow_preview?: {
    total_steps: number;
    total_days: number;
    timeline: string[];
  };
  error?: string;
}> {
  try {
    const supabase = supabaseAdmin();

    const flow_settings = {
      connection_wait_hours: params.connection_wait_hours || 36,
      followup_wait_days: params.followup_wait_days || 5,
      messages: {
        connection_request: params.messages.connection_request,
        follow_up_1: params.messages.follow_up_1 || null,
        follow_up_2: params.messages.follow_up_2 || null,
        follow_up_3: params.messages.follow_up_3 || null,
        follow_up_4: params.messages.follow_up_4 || null,
        follow_up_5: params.messages.follow_up_5 || null,
        follow_up_6: params.messages.follow_up_6 || null,
        goodbye: params.messages.goodbye || null
      }
    };

    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        workspace_id: params.workspace_id,
        name: params.name,
        channel: 'linkedin',
        status: 'draft',
        flow_settings,
        metadata: params.metadata || {}
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Generate flow preview
    const flowPreview = generateFlowPreview(flow_settings);

    return {
      success: true,
      campaign_id: data.id,
      campaign_name: data.name,
      flow_preview: flowPreview
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Campaign creation failed'
    };
  }
}

/**
 * Create multiple campaigns at once for A/B testing
 * Enables SAM to create A/B tests via conversation
 */
export async function mcp__sam__create_ab_test_campaigns(params: {
  workspace_id: string;
  test_name: string;
  campaigns: Array<{
    variant_name: string; // "A", "B", "C"
    variant_label?: string; // "Aggressive", "Nurturing"
    connection_wait_hours?: number;
    followup_wait_days?: number;
    messages: {
      connection_request: string;
      follow_up_1?: string | null;
      follow_up_2?: string | null;
      follow_up_3?: string | null;
      follow_up_4?: string | null;
      follow_up_5?: string | null;
      follow_up_6?: string | null;
      goodbye?: string | null;
    };
  }>;
}): Promise<{
  success: boolean;
  test_name?: string;
  campaigns?: Array<{
    id: string;
    name: string;
    variant: string;
    variant_label?: string;
  }>;
  error?: string;
}> {
  try {
    const supabase = supabaseAdmin();
    const createdCampaigns = [];

    for (const config of params.campaigns) {
      const flow_settings = {
        connection_wait_hours: config.connection_wait_hours || 36,
        followup_wait_days: config.followup_wait_days || 5,
        messages: {
          connection_request: config.messages.connection_request,
          follow_up_1: config.messages.follow_up_1 || null,
          follow_up_2: config.messages.follow_up_2 || null,
          follow_up_3: config.messages.follow_up_3 || null,
          follow_up_4: config.messages.follow_up_4 || null,
          follow_up_5: config.messages.follow_up_5 || null,
          follow_up_6: config.messages.follow_up_6 || null,
          goodbye: config.messages.goodbye || null
        }
      };

      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          workspace_id: params.workspace_id,
          name: `${params.test_name} - ${config.variant_label || config.variant_name}`,
          channel: 'linkedin',
          status: 'draft',
          flow_settings,
          metadata: {
            ab_test_group: params.test_name,
            variant: config.variant_name,
            variant_label: config.variant_label
          }
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: `Failed to create variant ${config.variant_name}: ${error.message}` };
      }

      createdCampaigns.push({
        id: data.id,
        name: data.name,
        variant: config.variant_name,
        variant_label: config.variant_label
      });
    }

    return {
      success: true,
      test_name: params.test_name,
      campaigns: createdCampaigns
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'A/B test creation failed'
    };
  }
}

/**
 * Split prospects evenly between campaigns for A/B testing
 */
export async function mcp__sam__split_prospects_between_campaigns(params: {
  prospect_ids: string[];
  campaign_ids: string[];
  shuffle?: boolean; // Default true for randomization
}): Promise<{
  success: boolean;
  distribution?: Array<{
    campaign_id: string;
    prospect_count: number;
  }>;
  error?: string;
}> {
  try {
    const supabase = supabaseAdmin();

    // Shuffle prospects for random distribution
    const prospects = params.shuffle !== false
      ? params.prospect_ids.sort(() => Math.random() - 0.5)
      : params.prospect_ids;

    const perCampaign = Math.ceil(prospects.length / params.campaign_ids.length);
    const distribution = [];

    for (let i = 0; i < params.campaign_ids.length; i++) {
      const campaignProspects = prospects.slice(
        i * perCampaign,
        (i + 1) * perCampaign
      );

      if (campaignProspects.length > 0) {
        const { error } = await supabase
          .from('campaign_prospects')
          .insert(
            campaignProspects.map(prospectId => ({
              campaign_id: params.campaign_ids[i],
              prospect_id: prospectId,
              status: 'pending'
            }))
          );

        if (error) {
          return { success: false, error: error.message };
        }

        distribution.push({
          campaign_id: params.campaign_ids[i],
          prospect_count: campaignProspects.length
        });
      }
    }

    return {
      success: true,
      distribution
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Prospect split failed'
    };
  }
}

/**
 * Generate flow preview timeline
 */
function generateFlowPreview(flow_settings: any) {
  const messages = flow_settings.messages;
  const enabledSteps = Object.entries(messages).filter(([_, msg]) => msg !== null);

  const timeline: string[] = [];
  let currentDay = 0;

  timeline.push(`Day 0: Connection Request`);

  currentDay += flow_settings.connection_wait_hours / 24;

  enabledSteps.slice(1).forEach(([key, _], index) => {
    const stepName = key.split('_').map((word: string) =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    timeline.push(`Day ${currentDay.toFixed(1)}: ${stepName}`);

    if (index < enabledSteps.length - 2) { // Not the last step
      currentDay += flow_settings.followup_wait_days;
    }
  });

  return {
    total_steps: enabledSteps.length,
    total_days: Math.ceil(currentDay),
    timeline
  };
}

/**
 * Create LinkedIn DM campaign for 1st degree connections
 * For people already connected - no connection request needed
 */
export async function mcp__sam__create_linkedin_dm_campaign(params: {
  workspace_id: string;
  name: string;
  message_wait_days?: number; // Default: 5
  messages: {
    message_1: string;
    message_2?: string | null;
    message_3?: string | null;
    message_4?: string | null;
    message_5?: string | null;
    message_6?: string | null;
    message_7?: string | null;
    message_8?: string | null;
    message_9?: string | null;
    message_10?: string | null;
  };
  metadata?: any;
}): Promise<{
  success: boolean;
  campaign_id?: string;
  campaign_name?: string;
  flow_preview?: {
    total_messages: number;
    total_days: number;
    timeline: string[];
  };
  error?: string;
}> {
  try {
    const supabase = supabaseAdmin();

    const flow_settings = {
      campaign_type: 'linkedin_dm',
      message_wait_days: params.message_wait_days || 5,
      messages: {
        // Clear connection request fields (not used for DM campaigns)
        connection_request: null,
        follow_up_1: null,
        follow_up_2: null,
        follow_up_3: null,
        follow_up_4: null,
        follow_up_5: null,
        follow_up_6: null,
        goodbye: null,
        // DM messages
        message_1: params.messages.message_1,
        message_2: params.messages.message_2 || null,
        message_3: params.messages.message_3 || null,
        message_4: params.messages.message_4 || null,
        message_5: params.messages.message_5 || null,
        message_6: params.messages.message_6 || null,
        message_7: params.messages.message_7 || null,
        message_8: params.messages.message_8 || null,
        message_9: params.messages.message_9 || null,
        message_10: params.messages.message_10 || null
      }
    };

    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        workspace_id: params.workspace_id,
        name: params.name,
        channel: 'linkedin',
        status: 'draft',
        flow_settings,
        metadata: params.metadata || {}
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Generate timeline preview
    const messageCount = Object.entries(params.messages)
      .filter(([_, msg]) => msg !== null)
      .length;

    const timeline: string[] = [];
    for (let i = 0; i < messageCount; i++) {
      const day = i * (params.message_wait_days || 5);
      timeline.push(`Day ${day}: Message ${i + 1}`);
    }

    return {
      success: true,
      campaign_id: data.id,
      campaign_name: data.name,
      flow_preview: {
        total_messages: messageCount,
        total_days: (messageCount - 1) * (params.message_wait_days || 5),
        timeline
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'LinkedIn DM campaign creation failed'
    };
  }
}

export {
  findBestTemplate,
  findProspectsForCampaign,
  createExecutionSchedule,
  personalizeForProspect,
  determineNextAction,
  executeViaN8NWorkflow,
  generateSamSignature,
  generateFlowPreview
};
