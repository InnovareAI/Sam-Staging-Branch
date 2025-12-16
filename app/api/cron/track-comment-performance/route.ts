/**
 * Track Comment Performance Cron Job
 * POST /api/cron/track-comment-performance
 *
 * Runs every 6 hours to check engagement on our posted comments.
 * Updates performance scores and relationship tracking.
 *
 * Created: December 16, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  checkRecentCommentsPerformance,
  aggregatePerformanceStats,
} from '@/lib/services/comment-performance-tracker';
import {
  recordAuthorResponse,
} from '@/lib/services/author-relationship-tracker';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;  // 5 minutes

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('📊 Track Comment Performance Cron Starting...');
  console.log(`   Time: ${new Date().toISOString()}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Get all active workspaces with LinkedIn accounts
    const { data: workspaces, error: wsError } = await supabase
      .from('workspace_members')
      .select('workspace_id, linkedin_unipile_account_id')
      .not('linkedin_unipile_account_id', 'is', null);

    if (wsError) {
      console.error('Failed to get workspaces:', wsError);
      return NextResponse.json({ error: wsError.message }, { status: 500 });
    }

    // Dedupe workspaces
    const workspaceAccounts = new Map<string, string>();
    for (const ws of workspaces || []) {
      if (ws.linkedin_unipile_account_id && !workspaceAccounts.has(ws.workspace_id)) {
        workspaceAccounts.set(ws.workspace_id, ws.linkedin_unipile_account_id);
      }
    }

    console.log(`   Found ${workspaceAccounts.size} workspaces with LinkedIn accounts`);

    const results: Array<{
      workspace_id: string;
      checked: number;
      updated: number;
      author_responses: number;
    }> = [];

    // Process each workspace
    for (const [workspaceId, accountId] of workspaceAccounts) {
      console.log(`\n📊 Processing workspace ${workspaceId.substring(0, 8)}...`);

      // Check performance on recent comments
      const { checked, updated } = await checkRecentCommentsPerformance(
        supabase,
        workspaceId,
        accountId,
        7  // Last 7 days
      );

      console.log(`   Checked: ${checked}, Updated: ${updated}`);

      // Update author relationships based on responses
      let authorResponses = 0;

      // Get comments where author responded (newly detected)
      const { data: respondedComments } = await supabase
        .from('linkedin_post_comments')
        .select(`
          id,
          author_replied,
          author_liked,
          post:linkedin_posts_discovered!inner(
            author_profile_id,
            workspace_id
          )
        `)
        .eq('workspace_id', workspaceId)
        .eq('status', 'posted')
        .or('author_replied.eq.true,author_liked.eq.true')
        .gte('last_engagement_check', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      for (const comment of respondedComments || []) {
        const post = comment.post as any;
        if (!post?.author_profile_id) continue;

        if (comment.author_replied) {
          await recordAuthorResponse(supabase, workspaceId, post.author_profile_id, 'reply');
          authorResponses++;
        }

        if (comment.author_liked) {
          await recordAuthorResponse(supabase, workspaceId, post.author_profile_id, 'like');
          authorResponses++;
        }
      }

      console.log(`   Author responses recorded: ${authorResponses}`);

      results.push({
        workspace_id: workspaceId,
        checked,
        updated,
        author_responses: authorResponses,
      });

      // Rate limit between workspaces
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Aggregate weekly stats for all workspaces
    const today = new Date();
    const isWeeklyAggregation = today.getDay() === 0;  // Sunday

    if (isWeeklyAggregation) {
      console.log('\n📈 Running weekly performance aggregation...');

      for (const [workspaceId] of workspaceAccounts) {
        const stats = await aggregatePerformanceStats(supabase, workspaceId, 7);

        if (stats && stats.total_comments > 0) {
          // Save to performance stats table
          const periodStart = new Date();
          periodStart.setDate(periodStart.getDate() - 7);

          await supabase
            .from('linkedin_comment_performance_stats')
            .upsert({
              workspace_id: workspaceId,
              period_start: periodStart.toISOString().split('T')[0],
              period_end: today.toISOString().split('T')[0],
              total_comments: stats.total_comments,
              total_posted: stats.total_comments,  // All are posted
              total_with_engagement: stats.total_with_engagement,
              total_reactions: Math.round(stats.avg_reactions * stats.total_comments),
              total_replies: Math.round(stats.avg_replies * stats.total_comments),
              author_response_rate: stats.author_response_rate,
              performance_by_type: stats.by_comment_type,
              performance_by_length: stats.by_length_category,
              top_openers: stats.top_performing_openers,
            }, {
              onConflict: 'workspace_id,period_start,period_end',
            });

          console.log(`   Saved weekly stats for ${workspaceId.substring(0, 8)}`);
        }
      }
    }

    const duration = Date.now() - startTime;
    const totals = results.reduce(
      (acc, r) => ({
        checked: acc.checked + r.checked,
        updated: acc.updated + r.updated,
        responses: acc.responses + r.author_responses,
      }),
      { checked: 0, updated: 0, responses: 0 }
    );

    console.log(`\n✅ Performance tracking complete:`);
    console.log(`   Total checked: ${totals.checked}`);
    console.log(`   Total updated: ${totals.updated}`);
    console.log(`   Author responses: ${totals.responses}`);
    console.log(`   Duration: ${duration}ms`);

    return NextResponse.json({
      success: true,
      workspaces_processed: results.length,
      totals,
      results,
      weekly_aggregation: isWeeklyAggregation,
      duration_ms: duration,
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

// GET for manual status check
export async function GET() {
  return NextResponse.json({
    service: 'Track Comment Performance Cron',
    status: 'ready',
    description: 'Checks engagement on posted comments and updates relationship tracking',
    schedule: 'Every 6 hours',
    features: [
      'Comment performance scoring',
      'Author relationship updates',
      'Weekly performance aggregation (Sundays)',
    ],
  });
}
