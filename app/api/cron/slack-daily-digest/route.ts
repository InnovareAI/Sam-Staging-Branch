import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';
import { slackService } from '@/lib/slack';

/**
 * Daily Digest Cron Job
 * Sends a daily summary to Slack for each workspace with active Slack integration
 *
 * Schedule: Run daily at 9 AM (configure in netlify.toml or Netlify dashboard)
 */

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret (skip for manual triggers with channel param)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET;

    // Parse body for manual trigger params
    let body: { channel?: string; workspaceId?: string } = {};
    try {
      body = await request.json();
    } catch {
      // No body, that's fine for cron triggers
    }

    const isManualTrigger = body.channel || body.workspaceId;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !isManualTrigger) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Daily Digest] Starting daily digest generation...', { isManualTrigger, channel: body.channel });

    // Get all workspaces with active Slack app config
    const query = supabaseAdmin()
      .from('slack_app_config')
      .select('workspace_id, slack_team_name, default_channel')
      .eq('status', 'active');

    // If specific workspace requested, filter to it
    if (body.workspaceId) {
      query.eq('workspace_id', body.workspaceId);
    }

    const { data: slackConfigs, error: configError } = await query;

    if (configError || !slackConfigs?.length) {
      console.log('[Daily Digest] No active Slack integrations found');
      return NextResponse.json({ success: true, message: 'No active Slack integrations' });
    }

    const results: { workspaceId: string; success: boolean; error?: string; channel?: string }[] = [];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const config of slackConfigs) {
      try {
        const workspaceId = config.workspace_id;
        // Use provided channel, or workspace's default channel
        const targetChannel = body.channel || config.default_channel;

        console.log(`[Daily Digest] Processing workspace: ${workspaceId}, channel: ${targetChannel || 'default'}`);

        // Gather stats for the last 24 hours
        const stats = await gatherDailyStats(workspaceId, yesterday, today);

        // Send the digest to the specified channel
        const result = await slackService.sendDailyDigest(workspaceId, stats, targetChannel);

        results.push({
          workspaceId,
          success: result.success,
          error: result.error,
          channel: targetChannel,
        });

        console.log(`[Daily Digest] Workspace ${workspaceId}: ${result.success ? 'sent' : result.error}`);
      } catch (error) {
        console.error(`[Daily Digest] Error for workspace ${config.workspace_id}:`, error);
        results.push({
          workspaceId: config.workspace_id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[Daily Digest] Completed: ${successCount}/${results.length} digests sent`);

    return NextResponse.json({
      success: true,
      sent: successCount,
      total: results.length,
      results,
    });

  } catch (error) {
    console.error('[Daily Digest] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function gatherDailyStats(
  workspaceId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  crSent: number;
  crAccepted: number;
  repliesReceived: number;
  followUpsSent: number;
  activeCampaigns: number;
  hotLeads: number;
  topCampaign?: { name: string; acceptRate: number };
  pendingActions: number;
}> {
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  // Connection requests sent yesterday
  const { count: crSent } = await supabaseAdmin()
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .gte('contacted_at', startIso)
    .lt('contacted_at', endIso);

  // Connections accepted yesterday
  const { count: crAccepted } = await supabaseAdmin()
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'accepted')
    .gte('updated_at', startIso)
    .lt('updated_at', endIso);

  // Replies received yesterday (from linkedin_messages table)
  const { count: repliesReceived } = await supabaseAdmin()
    .from('linkedin_messages')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('direction', 'inbound')
    .gte('created_at', startIso)
    .lt('created_at', endIso);

  // Follow-ups sent yesterday
  const { count: followUpsSent } = await supabaseAdmin()
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .not('follow_up_sent_at', 'is', null)
    .gte('follow_up_sent_at', startIso)
    .lt('follow_up_sent_at', endIso);

  // Active campaigns count
  const { count: activeCampaigns } = await supabaseAdmin()
    .from('campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');

  // Hot leads (prospects marked as hot or with positive sentiment)
  const { count: hotLeads } = await supabaseAdmin()
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .or('lead_score.gte.80,status.eq.hot_lead');

  // Get top performing campaign
  const { data: campaigns } = await supabaseAdmin()
    .from('campaigns')
    .select(`
      id,
      name,
      campaign_prospects(status)
    `)
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .limit(10);

  let topCampaign: { name: string; acceptRate: number } | undefined;

  if (campaigns?.length) {
    let bestRate = 0;
    for (const campaign of campaigns) {
      const prospects = campaign.campaign_prospects || [];
      const total = prospects.length;
      const accepted = prospects.filter((p: any) => p.status === 'accepted' || p.status === 'replied').length;
      const rate = total > 0 ? (accepted / total) * 100 : 0;

      if (rate > bestRate && total >= 5) { // Minimum 5 prospects for meaningful stats
        bestRate = rate;
        topCampaign = { name: campaign.name, acceptRate: rate };
      }
    }
  }

  // Pending approval actions
  const { count: pendingActions } = await supabaseAdmin()
    .from('slack_pending_actions')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending');

  return {
    crSent: crSent || 0,
    crAccepted: crAccepted || 0,
    repliesReceived: repliesReceived || 0,
    followUpsSent: followUpsSent || 0,
    activeCampaigns: activeCampaigns || 0,
    hotLeads: hotLeads || 0,
    topCampaign,
    pendingActions: pendingActions || 0,
  };
}

// Also allow GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request);
}
