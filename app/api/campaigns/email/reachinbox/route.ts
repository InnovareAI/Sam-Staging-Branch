import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';
import { personalizeMessage as personalizeMessageUniversal } from '@/lib/personalization';

// ReachInbox API Configuration
const REACHINBOX_API_URL = process.env.REACHINBOX_API_URL || 'https://api.reachinbox.ai/api/v1';
const REACHINBOX_API_KEY = process.env.REACHINBOX_API_KEY;

interface ReachInboxAccount {
  id: string;
  email: string;
  domain: string;
  status: 'active' | 'warming' | 'inactive';
  daily_limit: number;
  warmup_stage: number;
  reputation_score: number;
}

interface ReachInboxCampaignRequest {
  campaign_id: string;
  email_accounts?: string[]; // Optional - will auto-select if not provided
  schedule?: {
    start_date?: string;
    daily_limit_per_account?: number;
    time_zone?: string;
    sending_hours?: {
      start: string;
      end: string;
    };
  };
  tracking?: {
    open_tracking?: boolean;
    click_tracking?: boolean;
    reply_tracking?: boolean;
    unsubscribe_tracking?: boolean;
  };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check workspace tier - ReachInbox only for SME/Enterprise
    const { data: workspaceTier } = await supabase
      .from('workspace_tiers')
      .select('tier, monthly_email_limit')
      .eq('workspace_id', user.user_metadata.workspace_id)
      .single();

    if (!workspaceTier || workspaceTier.tier === 'startup') {
      return NextResponse.json({ 
        error: 'ReachInbox requires SME or Enterprise plan',
        current_tier: workspaceTier?.tier || 'startup',
        upgrade_info: {
          sme_plan: '$399/month - 6 email accounts, 4,800 emails/month, managed setup',
          enterprise_plan: '$899/month - 20+ accounts, 16,000+ emails/month, dedicated IPs'
        },
        alternative: 'Use Unipile integration via /api/campaigns/email/execute for Startup plan'
      }, { status: 403 });
    }

    const request: ReachInboxCampaignRequest = await req.json();
    
    if (!request.campaign_id) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 });
    }

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        *,
        campaign_prospects (
          id,
          prospect_id,
          status,
          workspace_prospects (
            id,
            first_name,
            last_name,
            company_name,
            job_title,
            email_address,
            location,
            industry
          )
        )
      `)
      .eq('id', request.campaign_id)
      .eq('workspace_id', user.user_metadata.workspace_id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Get available ReachInbox email accounts
    const availableAccounts = await getReachInboxAccounts(user.user_metadata.workspace_id);
    
    if (availableAccounts.length === 0) {
      return NextResponse.json({ 
        error: 'No ReachInbox email accounts configured',
        message: 'Please contact support to set up your managed email infrastructure',
        setup_required: {
          sme_plan: '6 email accounts setup across 2 custom domains',
          enterprise_plan: '20+ accounts with dedicated IPs and premium domains'
        }
      }, { status: 400 });
    }

    // Select optimal email accounts
    const pendingProspects = campaign.campaign_prospects.filter(
      (cp: any) => cp.status === 'pending' && cp.workspace_prospects?.email_address
    );

    const selectedAccounts = selectOptimalEmailAccounts(
      availableAccounts, 
      pendingProspects.length, 
      workspaceTier.tier as 'sme' | 'enterprise'
    );

    // Prepare prospects data for ReachInbox
    const prospectsData = pendingProspects.map((cp: any) => {
      const prospect = cp.workspace_prospects;
      return {
        email: prospect.email_address,
        first_name: prospect.first_name,
        last_name: prospect.last_name,
        company_name: prospect.company_name,
        job_title: prospect.job_title,
        location: prospect.location,
        industry: prospect.industry,
        personalized_subject: personalizeMessage(
          campaign.message_templates?.email_subject || 'Quick question about {company_name}',
          prospect
        ),
        personalized_body: personalizeMessage(
          campaign.message_templates?.email_body || 'Hi {first_name}, I noticed your work at {company_name}...',
          prospect
        ),
        prospect_id: prospect.id,
        campaign_prospect_id: cp.id
      };
    });

    // Execute ReachInbox campaign
    const reachInboxCampaign = await executeReachInboxCampaign({
      campaign_id: request.campaign_id,
      workspace_id: user.user_metadata.workspace_id,
      prospects: prospectsData,
      email_accounts: selectedAccounts.map(acc => acc.id),
      schedule: {
        start_date: request.schedule?.start_date || new Date().toISOString().split('T')[0],
        daily_limit_per_account: request.schedule?.daily_limit_per_account || 40,
        time_zone: request.schedule?.time_zone || 'UTC',
        sending_hours: request.schedule?.sending_hours || {
          start: '09:00',
          end: '17:00'
        }
      },
      tracking: {
        open_tracking: true,
        click_tracking: true,
        reply_tracking: true,
        unsubscribe_tracking: true,
        ...request.tracking
      }
    });

    if (reachInboxCampaign.error) {
      return NextResponse.json({ 
        error: 'ReachInbox campaign creation failed',
        details: reachInboxCampaign.error 
      }, { status: 500 });
    }

    // Update campaign with ReachInbox details
    await supabase
      .from('campaigns')
      .update({
        platform: 'email',
        reachinbox_campaign_id: reachInboxCampaign.id,
        status: 'active',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', request.campaign_id);

    // Track all prospects as email_scheduled
    for (const prospect of prospectsData) {
      await supabase.rpc('update_campaign_prospect_status', {
        p_campaign_id: request.campaign_id,
        p_prospect_id: prospect.prospect_id,
        p_status: 'email_scheduled'
      });
    }

    const distribution = distributeEmailVolume(prospectsData, selectedAccounts);

    return NextResponse.json({
      message: 'ReachInbox campaign launched successfully',
      campaign: {
        id: request.campaign_id,
        reachinbox_id: reachInboxCampaign.id,
        status: 'active'
      },
      email_infrastructure: {
        accounts_used: selectedAccounts.length,
        total_accounts_available: availableAccounts.length,
        tier: workspaceTier.tier,
        monthly_limit: workspaceTier.monthly_email_limit
      },
      volume_distribution: distribution,
      tracking: {
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/campaigns/email/reachinbox/webhook`,
        events_tracked: ['sent', 'opened', 'clicked', 'replied', 'bounced', 'unsubscribed']
      },
      next_steps: [
        'Monitor campaign progress via ReachInbox dashboard',
        'Check real-time stats at /api/campaigns/email/reachinbox/status',
        'Review replies in HITL approval system',
        'Optimize messaging based on performance metrics'
      ]
    });

  } catch (error: any) {
    console.error('ReachInbox campaign execution error:', error);
    return NextResponse.json(
      { error: 'Campaign execution failed', details: error.message },
      { status: 500 }
    );
  }
}

// Get ReachInbox accounts for workspace
async function getReachInboxAccounts(workspaceId: string): Promise<ReachInboxAccount[]> {
  try {
    if (!REACHINBOX_API_KEY) {
      console.error('REACHINBOX_API_KEY not configured');
      return [];
    }

    const response = await fetch(`${REACHINBOX_API_URL}/workspace/${workspaceId}/accounts`, {
      headers: {
        'Authorization': `Bearer ${REACHINBOX_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch ReachInbox accounts:', response.statusText);
      return [];
    }

    const data = await response.json();
    return data.accounts || [];

  } catch (error) {
    console.error('Error fetching ReachInbox accounts:', error);
    return [];
  }
}

// Select optimal email accounts for campaign
function selectOptimalEmailAccounts(
  availableAccounts: ReachInboxAccount[],
  prospectsCount: number,
  tier: 'sme' | 'enterprise'
): ReachInboxAccount[] {
  const maxAccounts = tier === 'sme' ? 6 : 20;
  const dailyLimitPerAccount = 40; // 800/month ÷ 20 weekdays
  
  // Filter active, warmed accounts
  const readyAccounts = availableAccounts.filter(account => 
    account.status === 'active' && 
    account.warmup_stage >= 30
  );
  
  if (readyAccounts.length === 0) {
    // If no accounts are fully warmed, use best available
    return availableAccounts
      .filter(acc => acc.status === 'active')
      .sort((a, b) => b.warmup_stage - a.warmup_stage)
      .slice(0, Math.min(maxAccounts, availableAccounts.length));
  }
  
  // Calculate required accounts
  const requiredAccounts = Math.ceil(prospectsCount / (dailyLimitPerAccount * 20));
  const accountsToUse = Math.min(requiredAccounts, maxAccounts, readyAccounts.length);
  
  // Select accounts with best sender reputation
  return readyAccounts
    .sort((a, b) => b.reputation_score - a.reputation_score)
    .slice(0, accountsToUse);
}

// Distribute email volume across accounts
function distributeEmailVolume(
  prospects: any[],
  selectedAccounts: ReachInboxAccount[]
) {
  const distribution = selectedAccounts.map(account => ({
    account_id: account.id,
    email: account.email,
    prospects: [] as any[],
    daily_limit: account.daily_limit
  }));
  
  // Round-robin distribution to balance load
  prospects.forEach((prospect, index) => {
    const accountIndex = index % selectedAccounts.length;
    distribution[accountIndex].prospects.push(prospect);
  });
  
  return {
    total_prospects: prospects.length,
    accounts_used: selectedAccounts.length,
    distribution: distribution,
    estimated_days: Math.ceil(
      Math.max(...distribution.map(d => d.prospects.length)) / 
      Math.min(...distribution.map(d => d.daily_limit))
    )
  };
}

// Execute ReachInbox campaign
async function executeReachInboxCampaign(params: {
  campaign_id: string;
  workspace_id: string;
  prospects: any[];
  email_accounts: string[];
  schedule: any;
  tracking: any;
}) {
  try {
    const response = await fetch(`${REACHINBOX_API_URL}/campaigns`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REACHINBOX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `SAM AI Campaign ${params.campaign_id}`,
        workspace_id: params.workspace_id,
        prospects: params.prospects,
        email_accounts: params.email_accounts,
        schedule: params.schedule,
        tracking: params.tracking,
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/campaigns/email/reachinbox/webhook`,
        sam_ai_integration: true
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.message || `HTTP ${response.status}` };
    }

    return await response.json();

  } catch (error: any) {
    return { error: error.message };
  }
}

// Helper function to personalize messages (uses universal personalization)
function personalizeMessage(template: string, prospect: any): string {
  return personalizeMessageUniversal(template, {
    first_name: prospect.first_name,
    last_name: prospect.last_name,
    company_name: prospect.company_name,
    company: prospect.company,
    title: prospect.title,
    job_title: prospect.job_title,
    email: prospect.email,
    location: prospect.location,
    industry: prospect.industry
  });
}

// GET endpoint for checking ReachInbox configuration
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check workspace tier
    const { data: workspaceTier } = await supabase
      .from('workspace_tiers')
      .select('tier, monthly_email_limit, daily_email_limit')
      .eq('workspace_id', user.user_metadata.workspace_id)
      .single();

    if (!workspaceTier || workspaceTier.tier === 'startup') {
      return NextResponse.json({ 
        available: false,
        reason: 'ReachInbox requires SME or Enterprise plan',
        current_tier: workspaceTier?.tier || 'startup',
        upgrade_options: {
          sme_plan: '$399/month - Managed email infrastructure with 6 accounts',
          enterprise_plan: '$899/month - Premium infrastructure with 20+ accounts'
        }
      });
    }

    // Get ReachInbox accounts
    const accounts = await getReachInboxAccounts(user.user_metadata.workspace_id);

    return NextResponse.json({
      available: true,
      tier: workspaceTier.tier,
      limits: {
        monthly: workspaceTier.monthly_email_limit,
        daily: workspaceTier.daily_email_limit
      },
      email_accounts: {
        total: accounts.length,
        active: accounts.filter(acc => acc.status === 'active').length,
        warming: accounts.filter(acc => acc.status === 'warming').length,
        accounts: accounts.map(acc => ({
          id: acc.id,
          email: acc.email,
          domain: acc.domain,
          status: acc.status,
          warmup_stage: acc.warmup_stage,
          daily_limit: acc.daily_limit
        }))
      },
      setup_status: accounts.length > 0 ? 'configured' : 'pending_setup'
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to check ReachInbox configuration', details: error.message },
      { status: 500 }
    );
  }
}