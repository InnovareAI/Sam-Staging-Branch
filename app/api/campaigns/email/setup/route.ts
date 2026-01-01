import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

// Import MCP tools for Unipile integration
declare global {
  function mcp__unipile__unipile_get_accounts(): Promise<any[]>;
}

interface EmailCampaignSetup {
  campaign_id: string;
  email_account_id?: string; // Optional - will auto-select if not provided
  message_templates: {
    email_subject: string;
    email_body: string;
    follow_up_emails?: Array<{
      subject: string;
      body: string;
      delay_days: number;
    }>;
  };
  daily_limit?: number; // Default 40 for Startup plan
  schedule?: {
    start_time: string; // HH:MM format
    end_time: string;   // HH:MM format
    timezone: string;
    weekdays_only: boolean;
  };
}

export async function POST(req: NextRequest) {
  try {
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const setup: EmailCampaignSetup = await req.json();
    
    if (!setup.campaign_id) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 });
    }

    // Validate campaign exists and belongs to user's workspace
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, workspace_id, name, status')
      .eq('id', setup.campaign_id)
      .eq('workspace_id', user.user_metadata.workspace_id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Get available email accounts via MCP
    const availableAccounts = await mcp__unipile__unipile_get_accounts();
    const emailAccounts = availableAccounts.filter(account => 
      (account.type === 'MAIL' || account.type === 'EMAIL') && 
      account.sources?.[0]?.status === 'OK'
    );

    if (emailAccounts.length === 0) {
      return NextResponse.json({ 
        error: 'No email accounts available',
        message: 'Please connect an email account first',
        setup_guide: {
          startup_plan: 'Connect your Gmail or Outlook account via Unipile for $99/month plan',
          upgrade_options: {
            sme_plan: '$399/month - Includes 6 email accounts with custom domains',
            enterprise_plan: '$899/month - Includes 20+ email accounts with dedicated IPs'
          }
        }
      }, { status: 400 });
    }

    // Select email account
    const selectedAccount = setup.email_account_id 
      ? emailAccounts.find(account => account.id === setup.email_account_id)
      : emailAccounts[0]; // Auto-select first available

    if (!selectedAccount) {
      return NextResponse.json({ 
        error: 'Specified email account not found',
        available_accounts: emailAccounts.map(acc => ({
          id: acc.id,
          name: acc.name,
          type: acc.type,
          status: acc.sources?.[0]?.status
        }))
      }, { status: 400 });
    }

    // Get workspace tier to determine limits
    const { data: workspaceTier } = await supabase
      .from('workspace_tiers')
      .select('tier, daily_email_limit, monthly_email_limit')
      .eq('workspace_id', user.user_metadata.workspace_id)
      .single();

    // Set daily limit based on tier (Startup plan default: 40/day)
    const tierLimits = {
      startup: { daily: 40, monthly: 800 },
      sme: { daily: 160, monthly: 4800 }, // 6 accounts × 800 each
      enterprise: { daily: 533, monthly: 16000 } // 20 accounts × 800 each
    };
    
    const currentTier = workspaceTier?.tier || 'startup';
    const maxDailyLimit = tierLimits[currentTier as keyof typeof tierLimits]?.daily || 40;
    const dailyLimit = Math.min(setup.daily_limit || maxDailyLimit, maxDailyLimit);

    // Validate message templates
    if (!setup.message_templates.email_subject || !setup.message_templates.email_body) {
      return NextResponse.json({ 
        error: 'Email subject and body templates are required' 
      }, { status: 400 });
    }

    // Update campaign with email configuration
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        platform: 'email',
        email_account_id: selectedAccount.id,
        message_templates: setup.message_templates,
        daily_limit: dailyLimit,
        schedule_config: setup.schedule || {
          start_time: '09:00',
          end_time: '17:00',
          timezone: 'UTC',
          weekdays_only: true
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', setup.campaign_id);

    if (updateError) {
      return NextResponse.json({ 
        error: 'Failed to update campaign configuration',
        details: updateError.message 
      }, { status: 500 });
    }

    // Get campaign prospects count for validation
    const { count: prospectsCount } = await supabase
      .from('campaign_prospects')
      .select('id', { count: 'exact' })
      .eq('campaign_id', setup.campaign_id)
      .eq('status', 'pending');

    // Calculate estimated execution time
    const estimatedDays = Math.ceil((prospectsCount || 0) / dailyLimit);
    const estimatedCompletionDate = new Date();
    estimatedCompletionDate.setDate(estimatedCompletionDate.getDate() + estimatedDays);

    return NextResponse.json({
      message: 'Email campaign configured successfully',
      configuration: {
        campaign_id: setup.campaign_id,
        campaign_name: campaign.name,
        email_account: {
          id: selectedAccount.id,
          name: selectedAccount.name,
          type: selectedAccount.type
        },
        daily_limit: dailyLimit,
        prospects_count: prospectsCount,
        estimated_completion: estimatedCompletionDate.toISOString().split('T')[0],
        estimated_days: estimatedDays,
        tier_info: {
          current_tier: currentTier,
          monthly_limit: tierLimits[currentTier as keyof typeof tierLimits]?.monthly,
          upgrade_benefits: currentTier === 'startup' ? {
            sme_plan: '6 email accounts, 4,800 emails/month, custom domains',
            enterprise_plan: '20+ accounts, 16,000 emails/month, dedicated IPs'
          } : null
        },
        schedule: setup.schedule || {
          start_time: '09:00',
          end_time: '17:00',
          timezone: 'UTC',
          weekdays_only: true
        }
      }
    });

  } catch (error: any) {
    console.error('Email campaign setup error:', error);
    return NextResponse.json(
      { error: 'Campaign setup failed', details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve current email campaign configuration
export async function GET(req: NextRequest) {
  try {
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaign_id');
    
    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 });
    }

    // Get campaign configuration
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        platform,
        email_account_id,
        message_templates,
        daily_limit,
        schedule_config,
        status,
        emails_sent,
        created_at,
        updated_at
      `)
      .eq('id', campaignId)
      .eq('workspace_id', user.user_metadata.workspace_id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Get available email accounts
    const availableAccounts = await mcp__unipile__unipile_get_accounts();
    const emailAccounts = availableAccounts.filter(account => 
      (account.type === 'MAIL' || account.type === 'EMAIL') && 
      account.sources?.[0]?.status === 'OK'
    );

    // Find current selected account
    const selectedAccount = emailAccounts.find(account => 
      account.id === campaign.email_account_id
    );

    // Get workspace tier for limits
    const { data: workspaceTier } = await supabase
      .from('workspace_tiers')
      .select('tier, daily_email_limit, monthly_email_limit')
      .eq('workspace_id', user.user_metadata.workspace_id)
      .single();

    // Get prospects count
    const { count: totalProspects } = await supabase
      .from('campaign_prospects')
      .select('id', { count: 'exact' })
      .eq('campaign_id', campaignId);

    const { count: pendingProspects } = await supabase
      .from('campaign_prospects')
      .select('id', { count: 'exact' })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        platform: campaign.platform,
        status: campaign.status,
        emails_sent: campaign.emails_sent || 0,
        message_templates: campaign.message_templates,
        daily_limit: campaign.daily_limit,
        schedule_config: campaign.schedule_config
      },
      email_account: selectedAccount ? {
        id: selectedAccount.id,
        name: selectedAccount.name,
        type: selectedAccount.type,
        status: selectedAccount.sources?.[0]?.status
      } : null,
      available_accounts: emailAccounts.map(acc => ({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        status: acc.sources?.[0]?.status
      })),
      prospects: {
        total: totalProspects || 0,
        pending: pendingProspects || 0,
        completed: (totalProspects || 0) - (pendingProspects || 0)
      },
      tier_info: {
        current_tier: workspaceTier?.tier || 'startup',
        daily_email_limit: workspaceTier?.daily_email_limit,
        monthly_email_limit: workspaceTier?.monthly_email_limit
      }
    });

  } catch (error: any) {
    console.error('Get email campaign configuration error:', error);
    return NextResponse.json(
      { error: 'Failed to get campaign configuration', details: error.message },
      { status: 500 }
    );
  }
}