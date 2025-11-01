import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// N8N Workflow configuration - n8n Cloud URL
const N8N_MASTER_FUNNEL_WEBHOOK = process.env.N8N_CAMPAIGN_WEBHOOK_URL || 'https://innovareai.app.n8n.cloud/webhook/campaign-execute';

// HITL Email configuration for approval system
const HITL_EMAIL_CONFIG = {
  smtp_host: process.env.HITL_SMTP_HOST,
  smtp_user: process.env.HITL_SMTP_USER,
  smtp_pass: process.env.HITL_SMTP_PASS,
  from_email: process.env.HITL_FROM_EMAIL || 'hitl@innovareai.com'
};

// V1 Master Funnel Request with workspace tier routing
interface N8NMasterFunnelRequest {
  // Campaign Identification
  campaign_id: string;
  workspace_id: string;
  
  // Workspace Configuration (V1 Multi-Tenant)
  workspace_tier: 'startup' | 'sme' | 'enterprise';
  workspace_config: {
    tier_limits: {
      monthly_email_limit: number;
      monthly_linkedin_limit: number;
      max_campaigns: number;
      current_usage: {
        emails_sent_this_month: number;
        linkedin_sent_this_month: number;
        active_campaigns: number;
      };
    };
    integration_config: {
      unipile_instance_url?: string;
      linkedin_accounts: any[];
      email_accounts: any[];
      reachinbox_api_key?: string;
      reachinbox_domains?: string[];
      reply_inbox_email?: string;
    };
    rate_limits: {
      linkedin_daily_limit: number;
      linkedin_hourly_limit: number;
      email_daily_limit: number;
      email_hourly_limit: number;
    };
  };
  
  // Campaign Configuration with V1 sophistication
  campaign_type: 'intelligence' | 'event_invitation' | 'direct_linkedin';
  execution_preferences: {
    immediate_execution: boolean;
    batch_size: number;
    execution_pace: 'conservative' | 'moderate' | 'aggressive';
    hitl_approval_required: boolean;
    fallback_strategy: 'linkedin_only' | 'email_only' | 'both_channels';
  };
  
  // HITL Approval Configuration
  hitl_config: {
    approval_method: 'email' | 'ui';
    approver_email: string;
    approval_timeout_hours: number;
    auto_approve_templates: boolean;
    require_message_approval: boolean;
    require_reply_approval: boolean;
  };
  
  // Channel Configuration based on workspace tier
  channel_preferences: {
    email_enabled: boolean;
    linkedin_enabled: boolean;
    primary_channel: 'linkedin' | 'email';
    execution_sequence: 'linkedin_first' | 'email_first' | 'simultaneous';
    cross_channel_timing: {
      linkedin_to_email_delay_days?: number;
      email_to_linkedin_delay_days?: number;
    };
  };
  
  // Prospect Data and ICP Criteria
  icp_criteria?: {
    target_job_titles: string[];
    target_industries: string[];
    target_locations: string[];
    company_sizes: string[];
    boolean_search_terms: string[];
    target_technologies?: string[];
  };
  
  // Event-specific configuration
  event_details?: {
    name: string;
    date: string;
    location: string;
    industry: string;
    type: string;
    registration_url?: string;
    event_description?: string;
  };
  
  // Campaign Data with full prospect enrichment
  campaign_data: {
    linkedin_account_id?: string;
    email_sending_domain?: string;
    message_templates: {
      connection_request?: string;
      follow_up_message?: string;
      email_subject?: string;
      email_body?: string;
      event_invitation?: string;
    };
    prospects: Array<{
      id: string;
      first_name: string;
      last_name: string;
      company: string;
      job_title: string;
      linkedin_url: string;
      linkedin_id?: string;
      email?: string;
      location?: string;
      industry?: string;
      engagement_score?: number;
      personalization_data?: any;
    }>;
  };
  
  // Real-time status update configuration
  webhook_config: {
    status_update_url: string;
    linkedin_response_url: string;
    email_response_url: string;
    completion_notification_url: string;
    error_notification_url: string;
  };
}

// Workspace Tier Configuration
interface WorkspaceTier {
  workspace_id: string;
  tier_type: 'startup' | 'sme' | 'enterprise';
  tier_status: string;
  monthly_email_limit: number;
  monthly_linkedin_limit: number;
  max_campaigns: number;
  billing_info: any;
  tier_features: {
    unipile_only: boolean;
    reachinbox_enabled: boolean;
    advanced_hitl: boolean;
    custom_workflows: boolean;
    advanced_analytics: boolean;
  };
}

// Workspace Integration Configuration
interface WorkspaceIntegrations {
  unipile_config?: {
    instance_url: string;
    linkedin_accounts: any[];
    email_accounts: any[];
    rate_limits: any;
    current_usage: any;
    oauth_status: string;
  };
  reachinbox_config?: {
    api_key: string;
    domains: string[];
    email_accounts: any[];
    reply_inbox_email: string;
    rate_limits: any;
    current_usage: any;
  };
}

interface Prospect {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string;
  job_title: string;
  linkedin_profile_url: string;
  linkedin_user_id?: string;
  email_address?: string;
  location?: string;
  industry?: string;
}

// V1 Multi-Tenant Helper Functions
async function getWorkspaceTier(supabase: any, workspaceId: string): Promise<WorkspaceTier | null> {
  const { data, error } = await supabase
    .from('workspace_tiers')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single();

  if (error || !data) {
    console.error('Error fetching workspace tier:', error);
    // Return default Startup tier if not found
    return {
      workspace_id: workspaceId,
      tier_type: 'startup',
      tier_status: 'active',
      monthly_email_limit: 200,
      monthly_linkedin_limit: 50,
      max_campaigns: 5,
      billing_info: {},
      tier_features: {
        unipile_only: true,
        reachinbox_enabled: false,
        advanced_hitl: false,
        custom_workflows: false,
        advanced_analytics: false
      }
    };
  }

  // Map database fields to expected interface
  // Database has 'tier' field, not 'tier_type'
  return {
    workspace_id: data.workspace_id,
    tier_type: data.tier || data.tier_type || 'startup',
    tier_status: data.tier_status || 'active',
    monthly_email_limit: data.monthly_email_limit || 200,
    monthly_linkedin_limit: data.monthly_linkedin_limit || 50,
    max_campaigns: data.max_campaigns || 5,
    billing_info: data.billing_info || {},
    tier_features: data.tier_features || {
      unipile_only: true,
      reachinbox_enabled: false,
      advanced_hitl: false,
      custom_workflows: false,
      advanced_analytics: false
    }
  };
}

async function getWorkspaceIntegrations(supabase: any, workspaceId: string, tierType: string): Promise<WorkspaceIntegrations> {
  const integrations: WorkspaceIntegrations = {};

  // Get workspace accounts (LinkedIn and email) from workspace_accounts table
  const { data: workspaceAccounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  if (workspaceAccounts && workspaceAccounts.length > 0) {
    // Separate LinkedIn and email accounts
    const linkedinAccounts = workspaceAccounts.filter((acc: any) => acc.account_type === 'linkedin');
    const emailAccounts = workspaceAccounts.filter((acc: any) => acc.account_type === 'email');

    // Build individual account objects for N8N workflow
    const linkedinAccountsFormatted = linkedinAccounts.map((acc: any) => ({
      id: acc.id,
      unipile_account_id: acc.unipile_account_id,
      account_name: acc.account_name,
      status: acc.connection_status,
      is_active: acc.is_active,
      daily_limit: acc.daily_message_limit || 20,
      messages_sent_today: acc.messages_sent_today || 0
    }));

    const emailAccountsFormatted = emailAccounts.map((acc: any) => ({
      id: acc.id,
      unipile_account_id: acc.unipile_account_id,
      account_name: acc.account_name,
      status: acc.connection_status,
      is_active: acc.is_active
    }));

    integrations.unipile_config = {
      instance_url: process.env.UNIPILE_DSN || '',
      linkedin_accounts: linkedinAccountsFormatted,
      email_accounts: emailAccountsFormatted,
      rate_limits: {},
      current_usage: {},
      oauth_status: 'connected'
    };
  }
  
  // Get ReachInbox integration (SME/Enterprise only)
  if (tierType === 'sme' || tierType === 'enterprise') {
    const { data: reachinboxData } = await supabase
      .from('workspace_reachinbox_integrations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();
    
    if (reachinboxData) {
      integrations.reachinbox_config = {
        api_key: reachinboxData.reachinbox_api_key,
        domains: [reachinboxData.domain_1, reachinboxData.domain_2].filter(Boolean),
        email_accounts: reachinboxData.email_accounts || [],
        reply_inbox_email: reachinboxData.reply_inbox_email,
        rate_limits: reachinboxData.rate_limits || {},
        current_usage: reachinboxData.current_usage || {}
      };
    }
  }
  
  return integrations;
}

async function getWorkspaceUsage(supabase: any, workspaceId: string): Promise<any> {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
  
  // Get current month usage from campaign executions
  const { data: executions } = await supabase
    .from('n8n_campaign_executions')
    .select('channel_specific_metrics')
    .eq('workspace_id', workspaceId)
    .gte('created_at', `${currentMonth}-01`)
    .lt('created_at', `${currentMonth}-32`);
  
  let emailsSent = 0;
  let linkedinSent = 0;
  
  executions?.forEach((exec: any) => {
    const metrics = exec.channel_specific_metrics || {};
    emailsSent += metrics.emails_sent || 0;
    linkedinSent += metrics.linkedin_sent || 0;
  });
  
  // Get active campaigns count
  const { count: activeCampaigns } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .in('status', ['active', 'executing']);
  
  return {
    emails_sent_this_month: emailsSent,
    linkedin_sent_this_month: linkedinSent,
    active_campaigns: activeCampaigns || 0
  };
}

async function createN8nCampaignExecution(supabase: any, workspaceId: string, campaignId: string, config: any): Promise<any> {
  const { data, error } = await supabase
    .from('n8n_campaign_executions')
    .insert({
      workspace_id: workspaceId,
      campaign_name: config.campaign_name || `Campaign ${campaignId}`,
      campaign_type: config.campaign_type,
      campaign_config: config,
      execution_status: 'initializing',
      n8n_execution_id: `n8n_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      prospects_processed: 0,
      messages_sent: 0,
      replies_received: 0,
      channel_specific_metrics: {}
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating N8N execution record:', error);
    throw new Error('Failed to create execution record');
  }
  
  return data;
}

async function initializeHitlApprovalSession(supabase: any, workspaceId: string, campaignExecutionId: string, config: any): Promise<any> {
  const { data, error } = await supabase
    .from('hitl_reply_approval_sessions')
    .insert({
      workspace_id: workspaceId,
      campaign_execution_id: campaignExecutionId,
      original_message_content: JSON.stringify(config.message_templates || {}),
      approval_status: 'pending_approval',
      approval_method: config.hitl_config?.approval_method || 'email',
      approver_email: config.hitl_config?.approver_email,
      approval_timeout_hours: config.hitl_config?.approval_timeout_hours || 24,
      created_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating HITL session:', error);
    return null;
  }
  
  return data;
}

function buildMasterFunnelPayload(
  campaignId: string,
  workspaceId: string,
  tier: WorkspaceTier,
  integrations: WorkspaceIntegrations,
  currentUsage: any,
  campaign: any,
  prospectsToProcess: any[],
  executionType: string,
  approverEmail: string
): N8NMasterFunnelRequest {
  // Determine channel preferences based on tier
  const channelPreferences = determineChannelPreferences(tier, integrations, executionType);
  
  // Build workspace configuration
  const workspaceConfig = {
    tier_limits: {
      monthly_email_limit: tier.monthly_email_limit,
      monthly_linkedin_limit: tier.monthly_linkedin_limit,
      max_campaigns: tier.max_campaigns,
      current_usage: currentUsage
    },
    integration_config: {
      unipile_instance_url: integrations.unipile_config?.instance_url,
      linkedin_accounts: integrations.unipile_config?.linkedin_accounts || [],
      email_accounts: integrations.unipile_config?.email_accounts || [],
      reachinbox_api_key: integrations.reachinbox_config?.api_key,
      reachinbox_domains: integrations.reachinbox_config?.domains || [],
      reply_inbox_email: integrations.reachinbox_config?.reply_inbox_email
    },
    rate_limits: determineRateLimits(tier)
  };
  
  // Build HITL configuration
  const hitlConfig = {
    approval_method: tier.tier_features.advanced_hitl ? 'ui' : 'email',
    approver_email: approverEmail,
    approval_timeout_hours: tier.tier_type === 'enterprise' ? 48 : 24,
    auto_approve_templates: tier.tier_features.advanced_hitl,
    require_message_approval: true,
    require_reply_approval: true
  };
  
  // Build execution preferences
  const executionPreferences = {
    immediate_execution: false, // Always require HITL approval
    batch_size: determineBatchSize(tier, prospectsToProcess.length),
    execution_pace: tier.tier_type === 'enterprise' ? 'aggressive' : 'moderate',
    hitl_approval_required: true,
    fallback_strategy: channelPreferences.email_enabled && channelPreferences.linkedin_enabled ? 'both_channels' : 
                       channelPreferences.linkedin_enabled ? 'linkedin_only' : 'email_only'
  };
  
  return {
    campaign_id: campaignId,
    workspace_id: workspaceId,
    workspace_tier: tier.tier_type,
    workspace_config: workspaceConfig,
    campaign_type: executionType as any,
    execution_preferences: executionPreferences,
    hitl_config: hitlConfig,
    channel_preferences: channelPreferences,
    icp_criteria: buildIcpCriteria(prospectsToProcess, campaign),
    event_details: buildEventDetails(campaign, executionType),
    campaign_data: buildCampaignData(campaign, prospectsToProcess),
    webhook_config: {
      status_update_url: 'https://app.meet-sam.com/api/webhooks/n8n/campaign-status',
      linkedin_response_url: 'https://app.meet-sam.com/api/webhooks/n8n/linkedin-responses',
      email_response_url: 'https://app.meet-sam.com/api/webhooks/n8n/email-responses',
      completion_notification_url: 'https://app.meet-sam.com/api/webhooks/n8n/campaign-complete',
      error_notification_url: 'https://app.meet-sam.com/api/webhooks/n8n/campaign-error'
    }
  };
}

function determineChannelPreferences(tier: WorkspaceTier, integrations: WorkspaceIntegrations, executionType: string) {
  const hasUnipile = !!integrations.unipile_config;
  const hasReachInbox = !!integrations.reachinbox_config;
  
  // Startup tier: Unipile only (LinkedIn + basic email)
  if (tier.tier_type === 'startup') {
    return {
      email_enabled: hasUnipile && integrations.unipile_config!.email_accounts.length > 0,
      linkedin_enabled: hasUnipile && integrations.unipile_config!.linkedin_accounts.length > 0,
      primary_channel: 'linkedin' as const,
      execution_sequence: 'linkedin_first' as const,
      cross_channel_timing: {
        linkedin_to_email_delay_days: 3
      }
    };
  }
  
  // SME/Enterprise tier: ReachInbox for email, Unipile for LinkedIn
  return {
    email_enabled: hasReachInbox || (hasUnipile && integrations.unipile_config!.email_accounts.length > 0),
    linkedin_enabled: hasUnipile && integrations.unipile_config!.linkedin_accounts.length > 0,
    primary_channel: executionType === 'direct_linkedin' ? 'linkedin' : 'email',
    execution_sequence: executionType === 'intelligence' ? 'simultaneous' : 'linkedin_first',
    cross_channel_timing: {
      linkedin_to_email_delay_days: 1,
      email_to_linkedin_delay_days: 2
    }
  };
}

function determineRateLimits(tier: WorkspaceTier) {
  switch (tier.tier_type) {
    case 'startup':
      return {
        linkedin_daily_limit: 50,
        linkedin_hourly_limit: 10,
        email_daily_limit: 200,
        email_hourly_limit: 50
      };
    case 'sme':
      return {
        linkedin_daily_limit: 100,
        linkedin_hourly_limit: 20,
        email_daily_limit: 1000,
        email_hourly_limit: 200
      };
    case 'enterprise':
      return {
        linkedin_daily_limit: 200,
        linkedin_hourly_limit: 40,
        email_daily_limit: 2000,
        email_hourly_limit: 400
      };
    default:
      return {
        linkedin_daily_limit: 50,
        linkedin_hourly_limit: 10,
        email_daily_limit: 200,
        email_hourly_limit: 50
      };
  }
}

function determineBatchSize(tier: WorkspaceTier, totalProspects: number): number {
  const maxBatch = tier.tier_type === 'enterprise' ? 20 : tier.tier_type === 'sme' ? 15 : 10;
  return Math.min(totalProspects, maxBatch);
}

function buildIcpCriteria(prospects: any[], campaign: any) {
  return {
    target_job_titles: extractJobTitles(prospects),
    target_industries: extractIndustries(prospects),
    target_locations: extractLocations(prospects),
    company_sizes: campaign.target_company_sizes || ['50-200', '200-1000'],
    boolean_search_terms: generateBooleanSearchTerms(prospects),
    target_technologies: campaign.target_technologies || []
  };
}

function buildEventDetails(campaign: any, executionType: string) {
  if (executionType !== 'event_invitation') return undefined;
  
  return {
    name: campaign.event_name || 'Business Event',
    date: campaign.event_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    location: campaign.event_location || 'Virtual',
    industry: campaign.target_industry || 'technology',
    type: campaign.event_type || 'conference',
    registration_url: campaign.event_registration_url,
    event_description: campaign.event_description
  };
}

function buildCampaignData(campaign: any, prospects: any[]) {
  return {
    linkedin_account_id: campaign.linkedin_account_id,
    email_sending_domain: campaign.email_sending_domain,
    message_templates: {
      connection_request: campaign.message_templates?.connection_request || "Hi {first_name}, I'd like to connect!",
      follow_up_message: campaign.message_templates?.follow_up_message || "Thanks for connecting, {first_name}!",
      email_subject: campaign.message_templates?.email_subject || "Quick question about {company}",
      email_body: campaign.message_templates?.email_body || "Hi {first_name}, I wanted to reach out about...",
      event_invitation: campaign.message_templates?.event_invitation || "Hi {first_name}, I'd like to invite you to..."
    },
    prospects: prospects.map(p => ({
      ...p,
      engagement_score: calculateEngagementScore(p),
      personalization_data: buildPersonalizationData(p)
    }))
  };
}

function calculateEngagementScore(prospect: any): number {
  let score = 50; // Base score
  
  if (prospect.linkedin_id) score += 20; // Has LinkedIn connection
  if (prospect.email) score += 15; // Has email
  if (prospect.job_title?.toLowerCase().includes('vp') || prospect.job_title?.toLowerCase().includes('director')) score += 10;
  if (prospect.company) score += 5;
  
  return Math.min(score, 100);
}

function buildPersonalizationData(prospect: any) {
  return {
    company_info: {
      name: prospect.company,
      industry: prospect.industry,
      location: prospect.location
    },
    role_info: {
      title: prospect.job_title,
      seniority_level: determineSeniorityLevel(prospect.job_title)
    },
    contact_preferences: {
      preferred_channel: prospect.linkedin_id ? 'linkedin' : 'email',
      time_zone: prospect.location ? getTimezoneFromLocation(prospect.location) : 'UTC'
    }
  };
}

function determineSeniorityLevel(jobTitle: string): string {
  if (!jobTitle) return 'individual_contributor';
  
  const title = jobTitle.toLowerCase();
  if (title.includes('ceo') || title.includes('founder') || title.includes('president')) return 'c_level';
  if (title.includes('vp') || title.includes('vice president')) return 'vp_level';
  if (title.includes('director') || title.includes('head of')) return 'director_level';
  if (title.includes('manager') || title.includes('lead')) return 'manager_level';
  
  return 'individual_contributor';
}

function getTimezoneFromLocation(location: string): string {
  // Simplified timezone mapping - in production, use a proper geo library
  if (location.toLowerCase().includes('california') || location.toLowerCase().includes('san francisco') || location.toLowerCase().includes('los angeles')) return 'America/Los_Angeles';
  if (location.toLowerCase().includes('new york') || location.toLowerCase().includes('eastern')) return 'America/New_York';
  if (location.toLowerCase().includes('london') || location.toLowerCase().includes('uk')) return 'Europe/London';
  return 'UTC';
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Get user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request data
    const { campaignId, workspaceId, executionType = 'direct_linkedin' } = await req.json();

    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
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

    console.log(`🚀 V1 Campaign Orchestration: Launching ${executionType} campaign for workspace ${workspaceId}`);

    // Step 1: Get workspace tier configuration
    console.log('📊 Step 1: Fetching workspace tier...');
    const tier = await getWorkspaceTier(supabase, workspaceId);
    if (!tier) {
      console.error('❌ Workspace tier not found');
      return NextResponse.json({ error: 'Workspace tier configuration not found' }, { status: 400 });
    }
    console.log(`✅ Workspace tier: ${tier.tier_type} (${tier.tier_status})`);

    // Step 2: Get workspace integrations based on tier
    console.log('🔌 Step 2: Fetching workspace integrations...');
    const integrations = await getWorkspaceIntegrations(supabase, workspaceId, tier.tier_type);
    console.log(`✅ Integrations: Unipile=${!!integrations.unipile_config}, ReachInbox=${!!integrations.reachinbox_config}`);

    // Step 3: Get current usage and validate limits
    const currentUsage = await getWorkspaceUsage(supabase, workspaceId);
    
    // Validate monthly limits
    if (currentUsage.emails_sent_this_month >= tier.monthly_email_limit) {
      return NextResponse.json({ 
        error: 'Monthly email limit exceeded',
        current_usage: currentUsage.emails_sent_this_month,
        limit: tier.monthly_email_limit
      }, { status: 429 });
    }
    
    if (currentUsage.linkedin_sent_this_month >= tier.monthly_linkedin_limit) {
      return NextResponse.json({ 
        error: 'Monthly LinkedIn limit exceeded',
        current_usage: currentUsage.linkedin_sent_this_month,
        limit: tier.monthly_linkedin_limit
      }, { status: 429 });
    }

    // Step 4: Get approver email from user profile
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('email, first_name, last_name')
      .eq('user_id', user.id)
      .single();
    
    const approverEmail = userProfile?.email || user.email;

    // Step 5: Get campaign details with full prospect data
    console.log('📋 Step 5: Fetching campaign details...');
    console.log(`   Campaign ID: ${campaignId}`);
    console.log(`   Workspace ID: ${workspaceId}`);

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        *,
        campaign_prospects (
          id,
          prospect_id,
          status,
          sequence_step,
          invitation_sent_at,
          workspace_prospects (
            id,
            first_name,
            last_name,
            company_name,
            job_title,
            linkedin_profile_url,
            linkedin_user_id,
            email_address,
            location,
            industry
          )
        )
      `)
      .eq('id', campaignId)
      .eq('workspace_id', workspaceId)
      .single();

    if (campaignError || !campaign) {
      console.error('❌ Campaign query failed:', campaignError);
      return NextResponse.json({
        error: 'Campaign not found',
        details: campaignError?.message || 'Campaign does not exist or you do not have access',
        campaign_id: campaignId,
        workspace_id: workspaceId
      }, { status: 404 });
    }

    console.log(`✅ Found campaign: ${campaign.name} (status: ${campaign.status})`);

    // Validate campaign is active
    if (campaign.status !== 'active') {
      return NextResponse.json({ error: 'Campaign is not active' }, { status: 400 });
    }

    // Validate active campaigns limit
    if (currentUsage.active_campaigns >= tier.max_campaigns) {
      return NextResponse.json({ 
        error: 'Maximum active campaigns limit exceeded',
        current_active: currentUsage.active_campaigns,
        limit: tier.max_campaigns
      }, { status: 429 });
    }

    // Get prospects ready for processing
    const pendingProspects = campaign.campaign_prospects.filter(
      (cp: any) => cp.status === 'pending' && cp.workspace_prospects
    );

    if (pendingProspects.length === 0) {
      return NextResponse.json({ 
        message: 'No pending prospects to contact',
        processed: 0 
      });
    }

    // Apply tier-based daily limits
    const tierLimits = determineRateLimits(tier);
    const dailyLimit = Math.min(
      campaign.daily_limit || tierLimits.linkedin_daily_limit,
      tierLimits.linkedin_daily_limit
    );

    const prospectsToProcess = pendingProspects
      .slice(0, dailyLimit)
      .map((cp: any) => ({
        id: cp.workspace_prospects.id,
        first_name: cp.workspace_prospects.first_name,
        last_name: cp.workspace_prospects.last_name,
        company: cp.workspace_prospects.company_name,
        job_title: cp.workspace_prospects.job_title,
        linkedin_url: cp.workspace_prospects.linkedin_profile_url,
        linkedin_id: cp.workspace_prospects.linkedin_user_id,
        email: cp.workspace_prospects.email_address,
        location: cp.workspace_prospects.location,
        industry: cp.workspace_prospects.industry
      }));

    console.log(`📋 Processing ${prospectsToProcess.length} prospects (daily limit: ${dailyLimit})`);

    // Step 6: Create N8N campaign execution record
    const executionRecord = await createN8nCampaignExecution(supabase, workspaceId, campaignId, {
      campaign_name: campaign.name,
      campaign_type: executionType,
      workspace_tier: tier.tier_type,
      prospect_count: prospectsToProcess.length
    });

    console.log(`📝 Created execution record: ${executionRecord.n8n_execution_id}`);

    // Step 7: Initialize HITL approval session
    const hitlSession = await initializeHitlApprovalSession(supabase, workspaceId, executionRecord.id, {
      message_templates: campaign.message_templates,
      hitl_config: {
        approval_method: tier.tier_features.advanced_hitl ? 'ui' : 'email',
        approver_email: approverEmail,
        approval_timeout_hours: tier.tier_type === 'enterprise' ? 48 : 24
      }
    });

    if (hitlSession) {
      console.log(`✅ HITL approval session created: ${hitlSession.id}`);
    }

    // Step 8: Build V1 Master Funnel payload with full sophistication
    const masterFunnelPayload = buildMasterFunnelPayload(
      campaignId,
      workspaceId,
      tier,
      integrations,
      currentUsage,
      campaign,
      prospectsToProcess,
      executionType,
      approverEmail
    );

    console.log(`🎯 Master Funnel Payload:`, {
      workspace_tier: masterFunnelPayload.workspace_tier,
      channel_preferences: masterFunnelPayload.channel_preferences,
      execution_preferences: masterFunnelPayload.execution_preferences,
      hitl_approval_required: masterFunnelPayload.execution_preferences.hitl_approval_required
    });

    // Step 9: Execute N8N Master Funnel with V1 sophistication
    try {
      console.log(`🚀 Sending to N8N Master Funnel: ${N8N_MASTER_FUNNEL_WEBHOOK}`);

      const n8nResponse = await fetch(N8N_MASTER_FUNNEL_WEBHOOK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.N8N_API_KEY || ''}`,
          'X-SAM-Workspace-ID': workspaceId,
          'X-SAM-Campaign-ID': campaignId,
          'X-SAM-Execution-ID': executionRecord.n8n_execution_id
        },
        body: JSON.stringify(masterFunnelPayload)
      });

      if (!n8nResponse.ok) {
        throw new Error(`N8N Master Funnel failed: ${n8nResponse.status} ${n8nResponse.statusText}`);
      }

      const n8nResult = await n8nResponse.json();
      console.log(`✅ N8N Master Funnel response:`, n8nResult);

      // Step 10: Update execution record with N8N response
      await supabase
        .from('n8n_campaign_executions')
        .update({
          execution_status: 'hitl_approval_pending',
          n8n_execution_id: n8nResult.execution_id || executionRecord.n8n_execution_id,
          started_at: new Date().toISOString(),
          channel_specific_metrics: {
            total_prospects: prospectsToProcess.length,
            processed_prospects: 0,
            successful_outreach: 0,
            failed_outreach: 0,
            responses_received: 0,
            emails_sent: 0,
            linkedin_sent: 0,
            hitl_approval_sessions: hitlSession ? [hitlSession.id] : []
          }
        })
        .eq('id', executionRecord.id);

      // Step 11: Update campaign prospects to 'hitl_approval' status
      for (const prospect of prospectsToProcess) {
        await supabase.rpc('update_campaign_prospect_status', {
          p_campaign_id: campaignId,
          p_prospect_id: prospect.id,
          p_status: 'hitl_approval',
          p_n8n_execution_id: executionRecord.n8n_execution_id
        });
      }

      // Step 12: Update campaign status
      await supabase
        .from('campaigns')
        .update({
          status: 'hitl_approval_pending',
          last_executed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      // Step 13: Calculate sophisticated completion estimates
      const estimatedTimes = calculateV1EstimatedCompletion(prospectsToProcess.length, executionType, tier);

      console.log(`🎉 V1 Campaign Orchestration launched successfully!`);

      return NextResponse.json({
        success: true,
        message: 'V1 Campaign Orchestration launched - HITL approval required',
        
        // Execution Details
        execution_id: executionRecord.id,
        n8n_execution_id: executionRecord.n8n_execution_id,
        hitl_session_id: hitlSession?.id,
        
        // Campaign Configuration
        workspace_tier: tier.tier_type,
        execution_type: executionType,
        prospects_processing: prospectsToProcess.length,
        
        // Channel Configuration
        channels_enabled: {
          linkedin: masterFunnelPayload.channel_preferences.linkedin_enabled,
          email: masterFunnelPayload.channel_preferences.email_enabled,
          primary_channel: masterFunnelPayload.channel_preferences.primary_channel
        },
        
        // HITL Configuration
        hitl_approval: {
          required: true,
          method: masterFunnelPayload.hitl_config.approval_method,
          approver_email: masterFunnelPayload.hitl_config.approver_email,
          timeout_hours: masterFunnelPayload.hitl_config.approval_timeout_hours
        },
        
        // Timing Estimates
        estimated_times: estimatedTimes,
        
        // Integration Status
        integrations: {
          unipile_available: !!integrations.unipile_config,
          reachinbox_available: !!integrations.reachinbox_config,
          linkedin_accounts: integrations.unipile_config?.linkedin_accounts.length || 0,
          email_accounts: (integrations.unipile_config?.email_accounts.length || 0) + 
                          (integrations.reachinbox_config?.email_accounts.length || 0)
        },
        
        // Rate Limits
        rate_limits: {
          daily_limits: masterFunnelPayload.workspace_config.rate_limits,
          monthly_usage: masterFunnelPayload.workspace_config.tier_limits.current_usage
        },
        
        // Monitoring
        monitoring: {
          n8n_workflow_url: `https://innovareai.app.n8n.cloud/workflow/2bmFPN5t2y6A4Rx2`,
          status_webhook: masterFunnelPayload.webhook_config.status_update_url,
          completion_webhook: masterFunnelPayload.webhook_config.completion_notification_url
        },
        
        // Next Steps
        next_steps: [
          `HITL approval email sent to ${approverEmail}`,
          'Campaign will start after message approval',
          'Real-time status updates via webhooks',
          `Estimated completion: ${estimatedTimes.approval_to_completion}`
        ]
      });

    } catch (n8nError: any) {
      console.error('N8N Master Funnel execution failed:', n8nError);

      // Update execution record with sophisticated error handling
      await supabase
        .from('n8n_campaign_executions')
        .update({
          execution_status: 'failed',
          error_details: {
            error_type: 'n8n_execution_failure',
            error_message: n8nError.message,
            error_timestamp: new Date().toISOString(),
            workspace_tier: tier.tier_type,
            execution_type: executionType,
            fallback_strategy: masterFunnelPayload.execution_preferences.fallback_strategy
          },
          completed_at: new Date().toISOString()
        })
        .eq('id', executionRecord.id);

      // Return sophisticated error response with fallback options
      return NextResponse.json({
        error: 'N8N Master Funnel execution failed',
        details: n8nError.message,
        
        // Error Context
        error_context: {
          workspace_tier: tier.tier_type,
          execution_type: executionType,
          prospects_count: prospectsToProcess.length,
          error_timestamp: new Date().toISOString()
        },
        
        // Fallback Options
        fallback_options: {
          available: true,
          strategy: masterFunnelPayload.execution_preferences.fallback_strategy,
          direct_execution_available: tier.tier_features.unipile_only,
          retry_recommended: true
        },
        
        // Execution Record
        execution_id: executionRecord.id,
        
        // Support Information
        support: {
          contact: 'support@innovareai.com',
          debug_id: executionRecord.n8n_execution_id
        }
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('❌ V1 Campaign Orchestration error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));

    return NextResponse.json({
      error: 'V1 Campaign Orchestration failed',
      details: error.message,
      error_type: error.name,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      support_contact: 'support@innovareai.com'
    }, { status: 500 });
  }
}

// Helper function to personalize messages
function personalizeMessage(template: string, prospect: any): string {
  return template
    .replace(/{first_name}/g, prospect.first_name || '')
    .replace(/{last_name}/g, prospect.last_name || '')
    .replace(/{company_name}/g, prospect.company || '')
    .replace(/{job_title}/g, prospect.job_title || '')
    .replace(/{location}/g, prospect.location || '')
    .replace(/{full_name}/g, `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim());
}

// Helper function to extract job titles for ICP criteria
function extractJobTitles(prospects: any[]): string[] {
  const titles = prospects
    .map(p => p.job_title)
    .filter(Boolean)
    .filter((title, index, arr) => arr.indexOf(title) === index) // unique
    .slice(0, 10); // limit to top 10
  
  return titles.length > 0 ? titles : ['CTO', 'VP Engineering', 'Director'];
}

// Helper function to extract industries for ICP criteria
function extractIndustries(prospects: any[]): string[] {
  const industries = prospects
    .map(p => p.industry)
    .filter(Boolean)
    .filter((industry, index, arr) => arr.indexOf(industry) === index) // unique
    .slice(0, 5); // limit to top 5
  
  return industries.length > 0 ? industries : ['Technology', 'Software'];
}

// Helper function to extract locations for ICP criteria
function extractLocations(prospects: any[]): string[] {
  const locations = prospects
    .map(p => p.location)
    .filter(Boolean)
    .filter((location, index, arr) => arr.indexOf(location) === index) // unique
    .slice(0, 5); // limit to top 5
  
  return locations.length > 0 ? locations : ['United States'];
}

// Helper function to generate Boolean search terms
function generateBooleanSearchTerms(prospects: any[]): string[] {
  const titles = extractJobTitles(prospects).slice(0, 3);
  const industries = extractIndustries(prospects).slice(0, 2);
  
  const searchTerms: string[] = [];
  
  // Combine titles with industries
  for (const title of titles) {
    for (const industry of industries) {
      searchTerms.push(`"${title}" "${industry}"`);
    }
  }
  
  // Add standalone title searches
  titles.forEach(title => {
    searchTerms.push(`"${title}" technology`);
    searchTerms.push(`"${title}" startup`);
  });
  
  return searchTerms.slice(0, 8); // limit to 8 search terms
}

// Helper function to get workflow ID from endpoint
function getWorkflowIdFromEndpoint(endpoint: string): string {
  if (endpoint.includes('sam-intelligence-core')) {
    return 'SAM_INTELLIGENCE_CORE_FUNNEL';
  } else if (endpoint.includes('sam-event-invitation')) {
    return 'SAM_EVENT_INVITATION_INTELLIGENCE';
  } else if (endpoint.includes('sam-charissa-messaging')) {
    return 'SAM_CHARISSA_MESSAGING_ONLY';
  }
  return 'UNKNOWN_WORKFLOW';
}

// Helper function to calculate estimated completion time (V1 sophisticated)
function calculateV1EstimatedCompletion(prospectCount: number, executionType: string, tier: WorkspaceTier) {
  let baseTimePerProspect: number;
  let hitlApprovalTime: number;
  
  // Determine base processing time based on execution type and tier
  switch (executionType) {
    case 'intelligence':
      baseTimePerProspect = tier.tier_type === 'enterprise' ? 2 : 3; // Enterprise gets faster processing
      hitlApprovalTime = 30; // 30 minutes for intelligence review
      break;
    case 'event_invitation':
      baseTimePerProspect = tier.tier_type === 'enterprise' ? 1.5 : 2;
      hitlApprovalTime = 20; // 20 minutes for event invitation review
      break;
    default:
      baseTimePerProspect = tier.tier_type === 'enterprise' ? 0.5 : 1;
      hitlApprovalTime = 15; // 15 minutes for direct message review
  }
  
  // Calculate timing phases
  const processingMinutes = prospectCount * baseTimePerProspect;
  const totalMinutes = hitlApprovalTime + processingMinutes;
  
  const now = new Date();
  const approvalCompleteTime = new Date(now.getTime() + hitlApprovalTime * 60 * 1000);
  const finalCompletionTime = new Date(now.getTime() + totalMinutes * 60 * 1000);
  
  return {
    hitl_approval_time: approvalCompleteTime.toISOString(),
    approval_to_completion: finalCompletionTime.toISOString(),
    total_duration_minutes: totalMinutes,
    processing_duration_minutes: processingMinutes,
    phases: {
      hitl_approval: `${hitlApprovalTime} minutes`,
      campaign_execution: `${processingMinutes} minutes`,
      total: `${totalMinutes} minutes`
    }
  };
}

// Legacy helper function for backward compatibility
function calculateEstimatedCompletion(prospectCount: number, executionType: string): string {
  let baseTimePerProspect: number;
  
  switch (executionType) {
    case 'intelligence':
      baseTimePerProspect = 3;
      break;
    case 'event_invitation':
      baseTimePerProspect = 2;
      break;
    default:
      baseTimePerProspect = 1;
  }
  
  const totalMinutes = prospectCount * baseTimePerProspect;
  const completionTime = new Date(Date.now() + totalMinutes * 60 * 1000);
  
  return completionTime.toISOString();
}