import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

// ReachInbox API Configuration
const REACHINBOX_API_URL = process.env.REACHINBOX_API_URL || 'https://api.reachinbox.ai/api/v1';
const REACHINBOX_API_KEY = process.env.REACHINBOX_API_KEY;

interface ReachInboxCampaignStats {
  campaign_id: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  total_prospects: number;
  emails_scheduled: number;
  emails_sent: number;
  emails_delivered: number;
  emails_opened: number;
  emails_clicked: number;
  emails_replied: number;
  emails_bounced: number;
  unsubscribes: number;
  account_performance: Array<{
    account_id: string;
    account_email: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
    delivery_rate: number;
    open_rate: number;
    click_rate: number;
    reply_rate: number;
  }>;
  daily_progress: Array<{
    date: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
  }>;
}

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

    // Verify campaign belongs to user's workspace
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, workspace_id, reachinbox_campaign_id, name, status, created_at, started_at')
      .eq('id', campaignId)
      .eq('workspace_id', user.user_metadata.workspace_id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (!campaign.reachinbox_campaign_id) {
      return NextResponse.json({ 
        error: 'Campaign is not using ReachInbox',
        suggestion: 'Use /api/campaigns/email/execute for Unipile integration'
      }, { status: 400 });
    }

    // Get ReachInbox campaign statistics
    const reachInboxStats = await getReachInboxCampaignStats(campaign.reachinbox_campaign_id);
    
    if (!reachInboxStats) {
      return NextResponse.json({ 
        error: 'Failed to fetch ReachInbox campaign statistics',
        campaign_id: campaignId,
        reachinbox_id: campaign.reachinbox_campaign_id
      }, { status: 500 });
    }

    // Get SAM AI specific metrics from our database
    const { data: campaignMetrics } = await supabase
      .from('campaign_interactions')
      .select(`
        interaction_type,
        created_at,
        interaction_data
      `)
      .eq('campaign_id', campaignId)
      .eq('platform', 'email');

    // Get prospects status breakdown
    const { data: prospectStats } = await supabase
      .rpc('get_campaign_prospect_stats', {
        p_campaign_id: campaignId
      });

    // Get HITL approval sessions created from this campaign
    const { data: hitlSessions } = await supabase
      .from('hitl_reply_approval_sessions')
      .select('id, approval_status, created_at, sam_confidence_score')
      .eq('campaign_execution_id', campaignId)
      .order('created_at', { ascending: false });

    // Calculate derived metrics
    const deliveryRate = reachInboxStats.emails_sent > 0 ? 
      (reachInboxStats.emails_delivered / reachInboxStats.emails_sent * 100) : 0;
    
    const openRate = reachInboxStats.emails_delivered > 0 ? 
      (reachInboxStats.emails_opened / reachInboxStats.emails_delivered * 100) : 0;
    
    const clickRate = reachInboxStats.emails_delivered > 0 ? 
      (reachInboxStats.emails_clicked / reachInboxStats.emails_delivered * 100) : 0;
    
    const replyRate = reachInboxStats.emails_delivered > 0 ? 
      (reachInboxStats.emails_replied / reachInboxStats.emails_delivered * 100) : 0;

    // Get workspace tier for context
    const { data: workspaceTier } = await supabase
      .from('workspace_tiers')
      .select('tier, monthly_email_limit, daily_email_limit')
      .eq('workspace_id', user.user_metadata.workspace_id)
      .single();

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: reachInboxStats.status,
        created_at: campaign.created_at,
        started_at: reachInboxStats.started_at,
        completed_at: reachInboxStats.completed_at,
        reachinbox_id: campaign.reachinbox_campaign_id
      },
      metrics: {
        total_prospects: reachInboxStats.total_prospects,
        emails_scheduled: reachInboxStats.emails_scheduled,
        emails_sent: reachInboxStats.emails_sent,
        emails_delivered: reachInboxStats.emails_delivered,
        emails_opened: reachInboxStats.emails_opened,
        emails_clicked: reachInboxStats.emails_clicked,
        emails_replied: reachInboxStats.emails_replied,
        emails_bounced: reachInboxStats.emails_bounced,
        unsubscribes: reachInboxStats.unsubscribes
      },
      performance: {
        delivery_rate: Number(deliveryRate.toFixed(2)),
        open_rate: Number(openRate.toFixed(2)),
        click_rate: Number(clickRate.toFixed(2)),
        reply_rate: Number(replyRate.toFixed(2)),
        bounce_rate: reachInboxStats.emails_sent > 0 ? 
          Number((reachInboxStats.emails_bounced / reachInboxStats.emails_sent * 100).toFixed(2)) : 0,
        unsubscribe_rate: reachInboxStats.emails_delivered > 0 ? 
          Number((reachInboxStats.unsubscribes / reachInboxStats.emails_delivered * 100).toFixed(2)) : 0
      },
      account_performance: reachInboxStats.account_performance,
      daily_progress: reachInboxStats.daily_progress,
      prospect_breakdown: prospectStats || {
        pending: 0,
        email_sent: 0,
        email_opened: 0,
        email_clicked: 0,
        replied: 0,
        email_bounced: 0,
        unsubscribed: 0,
        error: 0
      },
      sam_ai_integration: {
        hitl_sessions_created: hitlSessions?.length || 0,
        pending_approvals: hitlSessions?.filter(s => s.approval_status === 'pending').length || 0,
        approved_replies: hitlSessions?.filter(s => s.approval_status === 'approved').length || 0,
        average_confidence: hitlSessions?.length > 0 ? 
          Number((hitlSessions.reduce((sum, s) => sum + (s.sam_confidence_score || 0), 0) / hitlSessions.length).toFixed(2)) : 0
      },
      workspace_context: {
        tier: workspaceTier?.tier || 'startup',
        monthly_limit: workspaceTier?.monthly_email_limit,
        daily_limit: workspaceTier?.daily_email_limit,
        emails_used_this_campaign: reachInboxStats.emails_sent
      },
      recommendations: generateCampaignRecommendations({
        deliveryRate,
        openRate,
        clickRate,
        replyRate,
        bounceRate: reachInboxStats.emails_sent > 0 ? 
          (reachInboxStats.emails_bounced / reachInboxStats.emails_sent * 100) : 0,
        status: reachInboxStats.status,
        accountPerformance: reachInboxStats.account_performance
      })
    });

  } catch (error: any) {
    console.error('Get ReachInbox campaign status error:', error);
    return NextResponse.json(
      { error: 'Failed to get campaign status', details: error.message },
      { status: 500 }
    );
  }
}

// Get campaign statistics from ReachInbox API
async function getReachInboxCampaignStats(campaignId: string): Promise<ReachInboxCampaignStats | null> {
  try {
    if (!REACHINBOX_API_KEY) {
      console.error('REACHINBOX_API_KEY not configured');
      return null;
    }

    const response = await fetch(`${REACHINBOX_API_URL}/campaigns/${campaignId}/stats`, {
      headers: {
        'Authorization': `Bearer ${REACHINBOX_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch ReachInbox campaign stats:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Error fetching ReachInbox campaign stats:', error);
    return null;
  }
}

// Generate campaign optimization recommendations
function generateCampaignRecommendations(metrics: {
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
  status: string;
  accountPerformance: any[];
}): string[] {
  const recommendations: string[] = [];

  // Delivery rate recommendations
  if (metrics.deliveryRate < 95) {
    recommendations.push('🚨 Low delivery rate - Review email authentication (SPF, DKIM, DMARC) and sender reputation');
  }
  
  if (metrics.bounceRate > 5) {
    recommendations.push('📧 High bounce rate - Improve list quality and validate email addresses before sending');
  }

  // Engagement recommendations
  if (metrics.openRate < 15) {
    recommendations.push('📊 Low open rate - Test different subject lines and sending times');
  } else if (metrics.openRate > 30) {
    recommendations.push('🎯 Excellent open rate - Consider scaling this campaign or using similar messaging for new campaigns');
  }

  if (metrics.clickRate < 2) {
    recommendations.push('🖱️ Low click rate - Review email content, CTAs, and value proposition');
  }

  if (metrics.replyRate < 1) {
    recommendations.push('💬 Low reply rate - Personalize messages further and include clear questions or calls to action');
  } else if (metrics.replyRate > 5) {
    recommendations.push('🎉 Outstanding reply rate - Document what\'s working well for future campaigns');
  }

  // Account performance recommendations
  if (metrics.accountPerformance && metrics.accountPerformance.length > 1) {
    const bestAccount = metrics.accountPerformance.reduce((best, current) => 
      current.reply_rate > best.reply_rate ? current : best
    );
    const worstAccount = metrics.accountPerformance.reduce((worst, current) => 
      current.reply_rate < worst.reply_rate ? current : worst
    );
    
    if (bestAccount.reply_rate > worstAccount.reply_rate * 2) {
      recommendations.push(`⚡ Account performance variance detected - Focus more volume on high-performing accounts like ${bestAccount.account_email}`);
    }
  }

  // Status-based recommendations
  if (metrics.status === 'active') {
    recommendations.push('✅ Campaign is actively running - Monitor daily progress and be ready to respond to replies promptly');
  } else if (metrics.status === 'completed') {
    recommendations.push('🏁 Campaign completed - Analyze results and plan follow-up campaigns for non-responders');
  }

  // General best practices
  if (recommendations.length === 0) {
    recommendations.push('🚀 Campaign performance looks good - Continue monitoring and be prepared to scale successful patterns');
  }

  return recommendations;
}

// POST endpoint for campaign control actions (pause, resume, stop)
export async function POST(req: NextRequest) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { campaign_id, action } = await req.json();
    
    if (!campaign_id || !action) {
      return NextResponse.json({ 
        error: 'Campaign ID and action required',
        valid_actions: ['pause', 'resume', 'stop'] 
      }, { status: 400 });
    }

    // Verify campaign ownership
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('reachinbox_campaign_id')
      .eq('id', campaign_id)
      .eq('workspace_id', user.user_metadata.workspace_id)
      .single();

    if (!campaign?.reachinbox_campaign_id) {
      return NextResponse.json({ error: 'Campaign not found or not using ReachInbox' }, { status: 404 });
    }

    // Execute action via ReachInbox API
    const result = await executeReachInboxAction(campaign.reachinbox_campaign_id, action);
    
    if (result.success) {
      // Update campaign status in our database
      await supabase
        .from('campaigns')
        .update({ 
          status: action === 'stop' ? 'completed' : action === 'pause' ? 'paused' : 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', campaign_id);
    }

    return NextResponse.json({
      message: `Campaign ${action} ${result.success ? 'successful' : 'failed'}`,
      campaign_id,
      action,
      success: result.success,
      details: result.details
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to execute campaign action', details: error.message },
      { status: 500 }
    );
  }
}

// Execute campaign control actions via ReachInbox API
async function executeReachInboxAction(campaignId: string, action: string) {
  try {
    const response = await fetch(`${REACHINBOX_API_URL}/campaigns/${campaignId}/${action}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REACHINBOX_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    return {
      success: response.ok,
      details: result
    };

  } catch (error: any) {
    return {
      success: false,
      details: error.message
    };
  }
}