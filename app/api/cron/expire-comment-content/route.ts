/**
 * POST /api/cron/expire-comment-content
 *
 * Expires discovered posts and pending comments that weren't approved
 * Content expires at 6 AM UTC on the next business day
 *
 * What happens:
 * 1. Finds posts with status='discovered' where expires_at <= NOW()
 * 2. Marks them as status='expired'
 * 3. Finds comments with status='pending_approval' or 'scheduled' where expires_at <= NOW()
 * 4. Marks them as status='expired'
 *
 * After expiration, the discover-posts cron will scrape fresh posts
 *
 * Schedule: Daily at 6 AM UTC via netlify.toml
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Initialize Supabase with service role for cron job
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const poolKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !poolKey) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(supabaseUrl, poolKey);
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // Validate cron secret
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    console.error('❌ Invalid cron secret');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🧹 Starting content expiration run...');
  console.log(`   Time: ${new Date().toISOString()}`);

  try {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    // 1. Expire discovered posts that passed their expiration time
    const { data: expiredPosts, error: postsError } = await supabase
      .from('linkedin_posts_discovered')
      .update({
        status: 'expired',
        expired_at: now
      })
      .eq('status', 'discovered')
      .not('expires_at', 'is', null)
      .lte('expires_at', now)
      .select('id, workspace_id, author_name');

    if (postsError) {
      console.error('❌ Error expiring posts:', postsError.message);
    }

    const postsExpired = expiredPosts?.length || 0;
    console.log(`📋 Expired ${postsExpired} discovered posts`);

    // 2. Expire pending/scheduled comments that passed their expiration time
    const { data: expiredComments, error: commentsError } = await supabase
      .from('linkedin_post_comments')
      .update({
        status: 'expired',
        expired_at: now
      })
      .in('status', ['pending_approval', 'scheduled'])
      .not('expires_at', 'is', null)
      .lte('expires_at', now)
      .select('id, workspace_id');

    if (commentsError) {
      console.error('❌ Error expiring comments:', commentsError.message);
    }

    const commentsExpired = expiredComments?.length || 0;
    console.log(`💬 Expired ${commentsExpired} pending comments`);

    // 3. Group by workspace for reporting
    const workspaceStats: Record<string, { posts: number; comments: number }> = {};

    for (const post of expiredPosts || []) {
      if (!workspaceStats[post.workspace_id]) {
        workspaceStats[post.workspace_id] = { posts: 0, comments: 0 };
      }
      workspaceStats[post.workspace_id].posts++;
    }

    for (const comment of expiredComments || []) {
      if (!workspaceStats[comment.workspace_id]) {
        workspaceStats[comment.workspace_id] = { posts: 0, comments: 0 };
      }
      workspaceStats[comment.workspace_id].comments++;
    }

    const duration = Date.now() - startTime;

    // 4. Log summary
    if (postsExpired > 0 || commentsExpired > 0) {
      console.log('📊 Expiration summary by workspace:');
      for (const [wsId, stats] of Object.entries(workspaceStats)) {
        console.log(`   ${wsId.slice(0, 8)}...: ${stats.posts} posts, ${stats.comments} comments`);
      }
    }

    console.log(`✅ Content expiration complete in ${duration}ms`);
    console.log(`   Posts expired: ${postsExpired}`);
    console.log(`   Comments expired: ${commentsExpired}`);

    return NextResponse.json({
      success: true,
      posts_expired: postsExpired,
      comments_expired: commentsExpired,
      workspace_stats: workspaceStats,
      duration_ms: duration,
      message: `Expired ${postsExpired} posts and ${commentsExpired} comments`,
      timestamp: now
    });

  } catch (error) {
    console.error('❌ Content expiration error:', error);
    return NextResponse.json({
      error: 'Content expiration failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
