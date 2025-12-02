/**
 * Daily Campaign Summary Agent
 * Generates and sends daily campaign stats to Google Chat
 *
 * Trigger: Netlify scheduled functions daily at 8 AM PT (4 PM UTC)
 * POST /api/agents/daily-campaign-summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';
import {
  sendDailyCampaignSummary,
  getIAWorkspaceIds,
  DailyCampaignSummary,
} from '@/lib/notifications/google-chat';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 minute

interface WorkspaceStats {
  workspaceId: string;
  workspaceName: string;
  connectionRequests: number;
  accepted: number;
  replies: number;
  messages: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('📊 Starting daily campaign summary...');

  const supabase = supabaseAdmin();

  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get ALL active workspaces (not just InnovareAI)
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('is_active', true);

    if (!workspaces || workspaces.length === 0) {
      console.log('No active workspaces found');
      return NextResponse.json({
        success: true,
        message: 'No active workspaces to monitor'
      });
    }

    const allWorkspaceIds = workspaces.map(ws => ws.id);
    const workspaceNameMap: Record<string, string> = {};
    workspaces.forEach((ws: any) => {
      workspaceNameMap[ws.id] = ws.name;
    });

    console.log(`📊 Monitoring ${allWorkspaceIds.length} active workspaces:`, workspaces.map(w => w.name));

    // Get campaign prospects activity for last 24h from ALL workspaces
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select(`
        id,
        status,
        contacted_at,
        campaigns!inner(workspace_id)
      `)
      .in('campaigns.workspace_id', allWorkspaceIds)
      .gte('contacted_at', yesterday);

    // Get send queue stats for messages sent
    const { data: sendQueue } = await supabase
      .from('send_queue')
      .select(`
        id,
        status,
        message_type,
        campaigns!inner(workspace_id)
      `)
      .in('campaigns.workspace_id', allWorkspaceIds)
      .eq('status', 'sent')
      .gte('created_at', yesterday);

    // Get replies for last 24h
    const { data: replies } = await supabase
      .from('campaign_replies')
      .select(`
        id,
        intent,
        campaign_prospects!inner(
          campaigns!inner(workspace_id)
        )
      `)
      .in('campaign_prospects.campaigns.workspace_id', allWorkspaceIds)
      .gte('created_at', yesterday);

    // Calculate totals
    let totalConnectionRequests = 0;
    let totalAccepted = 0;
    let totalMessages = 0;
    let totalReplies = replies?.length || 0;

    // Group by workspace
    const workspaceStats: Record<string, WorkspaceStats> = {};

    // Initialize stats for all workspaces
    allWorkspaceIds.forEach((wsId) => {
      workspaceStats[wsId] = {
        workspaceId: wsId,
        workspaceName: workspaceNameMap[wsId] || wsId.substring(0, 8),
        connectionRequests: 0,
        accepted: 0,
        replies: 0,
        messages: 0,
      };
    });

    // Count connection requests and accepts
    prospects?.forEach((p: any) => {
      const wsId = p.campaigns?.workspace_id;
      if (!wsId || !workspaceStats[wsId]) return;

      if (p.status === 'connection_request_sent') {
        workspaceStats[wsId].connectionRequests++;
        totalConnectionRequests++;
      } else if (p.status === 'accepted' || p.status === 'message_sent') {
        workspaceStats[wsId].accepted++;
        totalAccepted++;
      }
    });

    // Count messages sent
    sendQueue?.forEach((sq: any) => {
      const wsId = sq.campaigns?.workspace_id;
      if (!wsId || !workspaceStats[wsId]) return;

      if (sq.message_type === 'connection_request') {
        workspaceStats[wsId].connectionRequests++;
        totalConnectionRequests++;
      } else {
        workspaceStats[wsId].messages++;
        totalMessages++;
      }
    });

    // Count replies by workspace
    replies?.forEach((r: any) => {
      const wsId = r.campaign_prospects?.campaigns?.workspace_id;
      if (!wsId || !workspaceStats[wsId]) return;
      workspaceStats[wsId].replies++;
    });

    // Calculate intent breakdown
    const intentCounts: Record<string, number> = {};
    replies?.forEach((r: any) => {
      const intent = r.intent || 'other';
      intentCounts[intent] = (intentCounts[intent] || 0) + 1;
    });

    const byIntent = Object.entries(intentCounts)
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count);

    // Calculate rates
    const acceptRate = totalConnectionRequests > 0
      ? (totalAccepted / totalConnectionRequests) * 100
      : 0;
    const replyRate = totalConnectionRequests > 0
      ? (totalReplies / totalConnectionRequests) * 100
      : 0;

    // Filter to only workspaces with activity
    const activeWorkspaces = Object.values(workspaceStats)
      .filter((ws) => ws.connectionRequests > 0 || ws.accepted > 0 || ws.replies > 0 || ws.messages > 0)
      .sort((a, b) => b.connectionRequests - a.connectionRequests);

    const summary: DailyCampaignSummary = {
      period: 'Last 24 hours',
      totalConnectionRequests,
      totalAccepted,
      totalReplies,
      totalMessages,
      acceptRate,
      replyRate,
      byWorkspace: activeWorkspaces,
      byIntent: byIntent.length > 0 ? byIntent : undefined,
    };

    // Send to Google Chat
    const notificationResult = await sendDailyCampaignSummary(summary);

    console.log('✅ Daily campaign summary complete:', {
      totalCRs: totalConnectionRequests,
      totalAccepted,
      totalReplies,
      workspacesWithActivity: activeWorkspaces.length,
      duration_ms: Date.now() - startTime,
      notificationSent: notificationResult.success,
    });

    return NextResponse.json({
      success: true,
      summary,
      notification: notificationResult,
      duration_ms: Date.now() - startTime,
    });
  } catch (error) {
    console.error('❌ Daily campaign summary failed:', error);
    return NextResponse.json(
      {
        error: 'Summary generation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
