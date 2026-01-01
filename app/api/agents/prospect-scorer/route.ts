/**
 * Prospect Scorer Agent
 * Scores prospects based on engagement signals and profile fit
 *
 * POST /api/agents/prospect-scorer
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { claudeClient } from '@/lib/llm/claude-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface ProspectScore {
  prospect_id: string;
  overall_score: number; // 0-100
  engagement_score: number;
  profile_fit_score: number;
  timing_score: number;
  priority: 'hot' | 'warm' | 'cold' | 'dormant';
  signals: string[];
  recommended_action: string;
  next_best_time: string;
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

    // Get prospects to score
    let query = supabase
      .from('campaign_prospects')
      .select(`
        id, first_name, last_name, title, company_name, industry, location,
        status, contacted_at, connection_accepted_at, responded_at,
        follow_up_sequence_index, last_follow_up_at, notes,
        campaign:campaigns(campaign_name, status)
      `)
      .in('status', ['connection_request_sent', 'accepted', 'messaging', 'replied']);

    if (body.workspace_id) {
      query = query.eq('workspace_id', body.workspace_id);
    }

    if (body.campaign_id) {
      query = query.eq('campaign_id', body.campaign_id);
    }

    const { data: prospects } = await query.limit(body.limit || 50);

    if (!prospects?.length) {
      return NextResponse.json({ success: true, message: 'No prospects to score', scored: 0 });
    }

    const scores: ProspectScore[] = [];

    for (const prospect of prospects) {
      const score = await scoreProspect(prospect);
      scores.push(score);

      // Update prospect with score
      await supabase
        .from('campaign_prospects')
        .update({
          engagement_score: score.overall_score,
          priority_level: score.priority,
          scoring_metadata: score,
          updated_at: new Date().toISOString()
        })
        .eq('id', prospect.id);
    }

    // Sort by score for summary
    scores.sort((a, b) => b.overall_score - a.overall_score);

    const summary = {
      hot: scores.filter(s => s.priority === 'hot').length,
      warm: scores.filter(s => s.priority === 'warm').length,
      cold: scores.filter(s => s.priority === 'cold').length,
      dormant: scores.filter(s => s.priority === 'dormant').length,
      average_score: scores.reduce((sum, s) => sum + s.overall_score, 0) / scores.length
    };

    return NextResponse.json({
      success: true,
      scored: scores.length,
      summary,
      top_prospects: scores.slice(0, 10),
      all_scores: scores
    });

  } catch (error) {
    console.error('Prospect scorer error:', error);
    return NextResponse.json({
      error: 'Scoring failed',
      details: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 });
  }
}

async function scoreProspect(prospect: any): Promise<ProspectScore> {
  // Calculate engagement score based on actions
  let engagementScore = 0;

  if (prospect.status === 'replied' || prospect.status === 'messaging') {
    engagementScore += 40;
  } else if (prospect.status === 'accepted') {
    engagementScore += 25;
  } else if (prospect.status === 'connection_request_sent') {
    engagementScore += 10;
  }

  // Recency bonus
  const now = new Date();
  const lastActivity = prospect.responded_at || prospect.connection_accepted_at || prospect.contacted_at;
  if (lastActivity) {
    const daysSinceActivity = (now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceActivity < 1) engagementScore += 20;
    else if (daysSinceActivity < 3) engagementScore += 15;
    else if (daysSinceActivity < 7) engagementScore += 10;
    else if (daysSinceActivity < 14) engagementScore += 5;
  }

  // Profile fit score (heuristic)
  let profileFitScore = 50; // Base score
  const seniorTitles = ['ceo', 'cto', 'coo', 'cfo', 'founder', 'president', 'director', 'vp', 'head', 'chief'];
  const title = (prospect.title || '').toLowerCase();
  if (seniorTitles.some(t => title.includes(t))) {
    profileFitScore += 25;
  } else if (title.includes('manager') || title.includes('lead')) {
    profileFitScore += 15;
  }

  if (prospect.company_name) profileFitScore += 10;
  if (prospect.industry) profileFitScore += 5;

  // Timing score
  let timingScore = 50;
  const hour = now.getHours();
  if (hour >= 9 && hour <= 11) timingScore += 20; // Morning
  else if (hour >= 14 && hour <= 16) timingScore += 15; // Afternoon
  else if (hour >= 17 && hour <= 19) timingScore += 10; // After work

  // Overall score
  const overallScore = Math.min(100, Math.round(
    engagementScore * 0.5 +
    profileFitScore * 0.3 +
    timingScore * 0.2
  ));

  // Determine priority
  let priority: 'hot' | 'warm' | 'cold' | 'dormant' = 'cold';
  if (overallScore >= 70) priority = 'hot';
  else if (overallScore >= 50) priority = 'warm';
  else if (overallScore >= 30) priority = 'cold';
  else priority = 'dormant';

  // Generate signals
  const signals: string[] = [];
  if (prospect.status === 'replied') signals.push('Has replied to messages');
  if (prospect.status === 'accepted') signals.push('Connection accepted');
  if (seniorTitles.some(t => title.includes(t))) signals.push('Senior decision maker');
  if (lastActivity) {
    const daysSince = (now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 3) signals.push('Recent activity');
    else if (daysSince > 14) signals.push('Going cold - needs attention');
  }

  // Recommended action
  let recommendedAction = 'Monitor';
  if (priority === 'hot') {
    recommendedAction = prospect.status === 'replied' ? 'Respond immediately' : 'Send personalized follow-up';
  } else if (priority === 'warm') {
    recommendedAction = 'Schedule follow-up within 24h';
  } else if (priority === 'cold') {
    recommendedAction = 'Send value-add content or case study';
  } else {
    recommendedAction = 'Re-engagement campaign or archive';
  }

  return {
    prospect_id: prospect.id,
    overall_score: overallScore,
    engagement_score: engagementScore,
    profile_fit_score: profileFitScore,
    timing_score: timingScore,
    priority,
    signals,
    recommended_action: recommendedAction,
    next_best_time: getNextBestTime()
  };
}

function getNextBestTime(): string {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  // Weekend
  if (day === 0 || day === 6) {
    return 'Monday 9:00 AM';
  }

  // After hours
  if (hour >= 18 || hour < 9) {
    return 'Tomorrow 9:00 AM';
  }

  // During lunch
  if (hour >= 12 && hour < 14) {
    return 'Today 2:00 PM';
  }

  return 'Now - good timing';
}
