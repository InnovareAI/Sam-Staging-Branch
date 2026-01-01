/**
 * Campaign Optimizer Agent
 * Analyzes campaign performance and suggests message improvements
 *
 * POST /api/agents/campaign-optimizer
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { claudeClient } from '@/lib/llm/claude-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface CampaignMetrics {
  campaign_id: string;
  campaign_name: string;
  total_prospects: number;
  connection_requests_sent: number;
  accepted: number;
  replied: number;
  positive_replies: number;
  acceptance_rate: number;
  reply_rate: number;
  positive_rate: number;
}

interface OptimizationSuggestion {
  type: 'message' | 'targeting' | 'timing' | 'sequence';
  priority: 'high' | 'medium' | 'low';
  current_value: string;
  suggested_value: string;
  expected_improvement: string;
  rationale: string;
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

    // Get campaigns to analyze
    const campaignFilter = body.campaign_id
      ? { column: 'id', value: body.campaign_id }
      : { column: 'status', value: 'active' };

    const { data: campaigns } = await supabase
      .from('campaigns')
      .select(`
        id, campaign_name, status, message_templates,
        campaign_prospects(status, classification)
      `)
      .eq(campaignFilter.column, campaignFilter.value)
      .limit(body.limit || 10);

    if (!campaigns?.length) {
      return NextResponse.json({ success: true, message: 'No campaigns to analyze' });
    }

    const optimizations = [];

    for (const campaign of campaigns) {
      const prospects = campaign.campaign_prospects || [];
      const metrics = calculateMetrics(campaign, prospects);

      // Skip campaigns with insufficient data
      if (metrics.connection_requests_sent < 10) continue;

      const suggestions = await generateOptimizations(campaign, metrics);

      optimizations.push({
        campaign_id: campaign.id,
        campaign_name: campaign.campaign_name,
        metrics,
        suggestions,
        analyzed_at: new Date().toISOString()
      });

      // Store optimization suggestions
      await supabase
        .from('campaign_optimizations')
        .upsert({
          campaign_id: campaign.id,
          metrics,
          suggestions,
          created_at: new Date().toISOString()
        }, { onConflict: 'campaign_id' });
    }

    return NextResponse.json({
      success: true,
      campaigns_analyzed: optimizations.length,
      optimizations
    });

  } catch (error) {
    console.error('Campaign optimizer error:', error);
    return NextResponse.json({
      error: 'Optimization failed',
      details: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 });
  }
}

function calculateMetrics(campaign: any, prospects: any[]): CampaignMetrics {
  const total = prospects.length;
  const sent = prospects.filter(p =>
    ['connection_request_sent', 'accepted', 'replied', 'messaging'].includes(p.status)
  ).length;
  const accepted = prospects.filter(p =>
    ['accepted', 'replied', 'messaging', 'connected'].includes(p.status)
  ).length;
  const replied = prospects.filter(p =>
    ['replied', 'messaging'].includes(p.status)
  ).length;
  const positive = prospects.filter(p =>
    p.classification === 'interested' || p.classification === 'positive'
  ).length;

  return {
    campaign_id: campaign.id,
    campaign_name: campaign.campaign_name,
    total_prospects: total,
    connection_requests_sent: sent,
    accepted,
    replied,
    positive_replies: positive,
    acceptance_rate: sent > 0 ? (accepted / sent) * 100 : 0,
    reply_rate: accepted > 0 ? (replied / accepted) * 100 : 0,
    positive_rate: replied > 0 ? (positive / replied) * 100 : 0
  };
}

async function generateOptimizations(
  campaign: any,
  metrics: CampaignMetrics
): Promise<OptimizationSuggestion[]> {
  const templates = campaign.message_templates || {};
  const connectionRequest = templates.connection_request || templates.initial_message || '';
  const followUp1 = templates.follow_up_1 || templates.followup_1 || '';

  const prompt = `Analyze this LinkedIn campaign and suggest optimizations.

CAMPAIGN: ${campaign.campaign_name}

METRICS:
- Connection Requests Sent: ${metrics.connection_requests_sent}
- Acceptance Rate: ${metrics.acceptance_rate.toFixed(1)}% (benchmark: 25-35%)
- Reply Rate: ${metrics.reply_rate.toFixed(1)}% (benchmark: 15-25%)
- Positive Reply Rate: ${metrics.positive_rate.toFixed(1)}% (benchmark: 40-60%)

CURRENT MESSAGES:
Connection Request: "${connectionRequest.substring(0, 500)}"
${followUp1 ? `Follow-up 1: "${followUp1.substring(0, 500)}"` : ''}

Analyze performance gaps and suggest improvements. Return JSON array:
[
  {
    "type": "message|targeting|timing|sequence",
    "priority": "high|medium|low",
    "current_value": "What's currently being done",
    "suggested_value": "Specific improvement",
    "expected_improvement": "+X% acceptance/reply rate",
    "rationale": "Why this will work"
  }
]

Focus on:
1. If acceptance < 25%: Message too salesy, unclear value prop, wrong targeting
2. If reply < 15%: Follow-up too pushy, not enough value, bad timing
3. If positive < 40%: Wrong audience, misaligned messaging

Return 2-4 actionable suggestions. Return ONLY valid JSON array.`;

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
    console.error('Optimization generation error:', error);
    return [];
  }
}
