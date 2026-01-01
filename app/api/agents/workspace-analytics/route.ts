/**
 * Workspace Analytics Agent
 * Weekly workspace performance digest with AI insights
 *
 * POST /api/agents/workspace-analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { claudeClient } from '@/lib/llm/claude-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

interface WorkspaceMetrics {
  workspace_id: string;
  workspace_name: string;
  period: { start: string; end: string };
  campaigns: {
    total: number;
    active: number;
    completed: number;
    paused: number;
  };
  prospects: {
    total: number;
    new_this_period: number;
    contacted: number;
    accepted: number;
    replied: number;
    positive_replies: number;
  };
  performance: {
    acceptance_rate: number;
    reply_rate: number;
    positive_rate: number;
    avg_time_to_accept: number;
    avg_time_to_reply: number;
  };
  trends: {
    acceptance_trend: 'up' | 'down' | 'stable';
    reply_trend: 'up' | 'down' | 'stable';
    volume_trend: 'up' | 'down' | 'stable';
  };
}

interface AIInsight {
  category: 'strength' | 'weakness' | 'opportunity' | 'threat';
  title: string;
  description: string;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
}

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret');
  const authHeader = request.headers.get('authorization');

  if (!cronSecret && !authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const supabase = pool;

    // Get workspaces to analyze
    let workspaceQuery = supabase.from('workspaces').select('id, name');
    if (body.workspace_id) {
      workspaceQuery = workspaceQuery.eq('id', body.workspace_id);
    }

    const { data: workspaces } = await workspaceQuery.limit(body.limit || 10);

    if (!workspaces?.length) {
      return NextResponse.json({ success: true, message: 'No workspaces to analyze' });
    }

    // Time period
    const periodDays = body.period_days || 7;
    const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
    const periodEnd = new Date().toISOString();
    const prevPeriodStart = new Date(Date.now() - 2 * periodDays * 24 * 60 * 60 * 1000).toISOString();

    const reports = [];

    for (const workspace of workspaces) {
      const metrics = await calculateWorkspaceMetrics(
        supabase,
        workspace.id,
        workspace.name,
        periodStart,
        periodEnd,
        prevPeriodStart
      );

      const insights = await generateAIInsights(metrics);

      const report = {
        ...metrics,
        ai_insights: insights,
        generated_at: new Date().toISOString()
      };

      reports.push(report);

      // Store report
      await supabase
        .from('workspace_analytics_reports')
        .insert({
          workspace_id: workspace.id,
          period_start: periodStart,
          period_end: periodEnd,
          metrics,
          ai_insights: insights,
          created_at: new Date().toISOString()
        });
    }

    return NextResponse.json({
      success: true,
      workspaces_analyzed: reports.length,
      period: { start: periodStart, end: periodEnd },
      reports
    });

  } catch (error) {
    console.error('Workspace analytics error:', error);
    return NextResponse.json({
      error: 'Analytics failed',
      details: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 });
  }
}

async function calculateWorkspaceMetrics(
  supabase: any,
  workspaceId: string,
  workspaceName: string,
  periodStart: string,
  periodEnd: string,
  prevPeriodStart: string
): Promise<WorkspaceMetrics> {
  // Campaign stats
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, status')
    .eq('workspace_id', workspaceId);

  const campaignStats = {
    total: campaigns?.length || 0,
    active: campaigns?.filter((c: any) => c.status === 'active').length || 0,
    completed: campaigns?.filter((c: any) => c.status === 'completed').length || 0,
    paused: campaigns?.filter((c: any) => c.status === 'paused' || c.status === 'inactive').length || 0
  };

  // Current period prospects
  const { data: currentProspects } = await supabase
    .from('campaign_prospects')
    .select('id, status, created_at, contacted_at, connection_accepted_at, responded_at, classification')
    .eq('workspace_id', workspaceId)
    .gte('created_at', periodStart);

  // Previous period for trends
  const { data: prevProspects } = await supabase
    .from('campaign_prospects')
    .select('id, status, contacted_at, connection_accepted_at, responded_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', prevPeriodStart)
    .lt('created_at', periodStart);

  // Calculate current metrics
  const current = currentProspects || [];
  const contacted = current.filter((p: any) => p.contacted_at);
  const accepted = current.filter((p: any) =>
    ['accepted', 'connected', 'replied', 'messaging'].includes(p.status)
  );
  const replied = current.filter((p: any) => p.responded_at);
  const positive = current.filter((p: any) =>
    p.classification === 'interested' || p.classification === 'positive'
  );

  const acceptanceRate = contacted.length > 0 ? (accepted.length / contacted.length) * 100 : 0;
  const replyRate = accepted.length > 0 ? (replied.length / accepted.length) * 100 : 0;
  const positiveRate = replied.length > 0 ? (positive.length / replied.length) * 100 : 0;

  // Previous period metrics for trends
  const prev = prevProspects || [];
  const prevContacted = prev.filter((p: any) => p.contacted_at).length;
  const prevAccepted = prev.filter((p: any) =>
    ['accepted', 'connected', 'replied', 'messaging'].includes(p.status)
  ).length;
  const prevReplied = prev.filter((p: any) => p.responded_at).length;

  const prevAcceptanceRate = prevContacted > 0 ? (prevAccepted / prevContacted) * 100 : 0;
  const prevReplyRate = prevAccepted > 0 ? (prevReplied / prevAccepted) * 100 : 0;

  // Calculate trends
  const getTrend = (current: number, previous: number): 'up' | 'down' | 'stable' => {
    const diff = current - previous;
    if (diff > 5) return 'up';
    if (diff < -5) return 'down';
    return 'stable';
  };

  // Average time to accept (in hours)
  const acceptTimes = accepted
    .filter((p: any) => p.contacted_at && p.connection_accepted_at)
    .map((p: any) => {
      const start = new Date(p.contacted_at).getTime();
      const end = new Date(p.connection_accepted_at).getTime();
      return (end - start) / (1000 * 60 * 60); // hours
    });
  const avgTimeToAccept = acceptTimes.length > 0
    ? acceptTimes.reduce((a, b) => a + b, 0) / acceptTimes.length
    : 0;

  // Average time to reply (in hours)
  const replyTimes = replied
    .filter((p: any) => p.connection_accepted_at && p.responded_at)
    .map((p: any) => {
      const start = new Date(p.connection_accepted_at).getTime();
      const end = new Date(p.responded_at).getTime();
      return (end - start) / (1000 * 60 * 60);
    });
  const avgTimeToReply = replyTimes.length > 0
    ? replyTimes.reduce((a, b) => a + b, 0) / replyTimes.length
    : 0;

  return {
    workspace_id: workspaceId,
    workspace_name: workspaceName,
    period: { start: periodStart, end: periodEnd },
    campaigns: campaignStats,
    prospects: {
      total: current.length + prev.length,
      new_this_period: current.length,
      contacted: contacted.length,
      accepted: accepted.length,
      replied: replied.length,
      positive_replies: positive.length
    },
    performance: {
      acceptance_rate: Math.round(acceptanceRate * 10) / 10,
      reply_rate: Math.round(replyRate * 10) / 10,
      positive_rate: Math.round(positiveRate * 10) / 10,
      avg_time_to_accept: Math.round(avgTimeToAccept * 10) / 10,
      avg_time_to_reply: Math.round(avgTimeToReply * 10) / 10
    },
    trends: {
      acceptance_trend: getTrend(acceptanceRate, prevAcceptanceRate),
      reply_trend: getTrend(replyRate, prevReplyRate),
      volume_trend: getTrend(current.length, prev.length)
    }
  };
}

async function generateAIInsights(metrics: WorkspaceMetrics): Promise<AIInsight[]> {
  const prompt = `Analyze these B2B LinkedIn campaign metrics and provide strategic insights.

WORKSPACE: ${metrics.workspace_name}
PERIOD: ${metrics.period.start} to ${metrics.period.end}

CAMPAIGNS:
- Total: ${metrics.campaigns.total}
- Active: ${metrics.campaigns.active}
- Completed: ${metrics.campaigns.completed}
- Paused: ${metrics.campaigns.paused}

PROSPECTS THIS PERIOD:
- New: ${metrics.prospects.new_this_period}
- Contacted: ${metrics.prospects.contacted}
- Accepted: ${metrics.prospects.accepted}
- Replied: ${metrics.prospects.replied}
- Positive Replies: ${metrics.prospects.positive_replies}

PERFORMANCE:
- Acceptance Rate: ${metrics.performance.acceptance_rate}% (benchmark: 25-35%)
- Reply Rate: ${metrics.performance.reply_rate}% (benchmark: 15-25%)
- Positive Rate: ${metrics.performance.positive_rate}% (benchmark: 40-60%)
- Avg Time to Accept: ${metrics.performance.avg_time_to_accept} hours
- Avg Time to Reply: ${metrics.performance.avg_time_to_reply} hours

TRENDS:
- Acceptance: ${metrics.trends.acceptance_trend}
- Reply: ${metrics.trends.reply_trend}
- Volume: ${metrics.trends.volume_trend}

Provide 3-5 SWOT insights as JSON array:
[
  {
    "category": "strength|weakness|opportunity|threat",
    "title": "Brief title",
    "description": "What the data shows",
    "recommendation": "Specific action to take",
    "priority": "high|medium|low"
  }
]

Focus on actionable insights. Return ONLY valid JSON array.`;

  try {
    const response = await claudeClient.chat({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.5
    });

    const content = response.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return [];
  } catch (error) {
    console.error('AI insights generation error:', error);
    return [];
  }
}
