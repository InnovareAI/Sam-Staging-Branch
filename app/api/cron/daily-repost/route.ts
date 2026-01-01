/**
 * Daily Repost - Share high-engagement posts with your comment
 * POST /api/cron/daily-repost
 *
 * Finds posts with high engagement (likes/comments) and reposts them
 * with your own commentary. Limited to 1 repost per day per workspace.
 *
 * Since Unipile doesn't have native repost, we create a "quote post"
 * with your comment + link to the original post.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

// OpenRouter for generating repost commentary
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

interface HighEngagementPost {
  id: string;
  social_id: string;
  post_author: string;
  post_content: string;
  share_url: string;
  workspace_id: string;
  engagement_metrics: {
    likes: number;
    comments: number;
    reposts: number;
  };
}

/**
 * Generate a repost comment using AI
 */
async function generateRepostComment(
  post: HighEngagementPost,
  brandVoice: string,
  topics: string
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    // Fallback to simple template
    return `Great insights on this topic! Worth a read.\n\n${post.share_url}`;
  }

  const prompt = `You are writing a brief LinkedIn repost comment for a thought leader.

ORIGINAL POST by ${post.post_author}:
"${post.post_content.substring(0, 500)}..."

YOUR BRAND VOICE: ${brandVoice}
YOUR TOPICS: ${topics}

Write a 1-2 sentence comment that:
1. Adds your perspective or insight (not just "great post!")
2. Shows why this resonates with your work
3. Keeps your authentic voice
4. Is under 100 words

Do NOT include the URL - it will be added automatically.
Do NOT use hashtags.
Just write the comment text.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() ||
      `Great insights on this topic! Worth a read.`;
  } catch (error) {
    console.error('AI comment generation failed:', error);
    return `Great insights on this topic! Worth a read.`;
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('📢 Daily repost cron starting...');

  let reposted = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    // Get workspaces with auto-repost enabled
    const { data: workspaces, error: wsError } = await supabase
      .from('linkedin_brand_guidelines')
      .select('workspace_id, repost_min_likes, repost_min_comments, reposts_per_day, tone_of_voice, topics_and_perspective')
      .eq('auto_repost_enabled', true);

    if (wsError || !workspaces?.length) {
      console.log('No workspaces with auto-repost enabled');
      return NextResponse.json({
        success: true,
        message: 'No workspaces with auto-repost enabled',
        reposted: 0
      });
    }

    console.log(`📋 Found ${workspaces.length} workspace(s) with auto-repost enabled`);

    for (const workspace of workspaces) {
      console.log(`\n📢 Processing workspace ${workspace.workspace_id}...`);

      // Check if already reposted today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: todayReposts } = await supabase
        .from('linkedin_reposts')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspace.workspace_id)
        .gte('created_at', today.toISOString());

      if ((todayReposts || 0) >= (workspace.reposts_per_day || 1)) {
        console.log(`   ⏸️ Already reposted ${todayReposts} time(s) today, skipping`);
        skipped++;
        continue;
      }

      // Find high-engagement posts from discovered posts
      const { data: highEngagementPosts, error: postsError } = await supabase
        .from('linkedin_posts_discovered')
        .select('*')
        .eq('workspace_id', workspace.workspace_id)
        .or(`engagement_metrics->likes.gte.${workspace.repost_min_likes || 100},engagement_metrics->comments.gte.${workspace.repost_min_comments || 20}`)
        .eq('status', 'commented') // Only repost posts we've already commented on
        .order('created_at', { ascending: false })
        .limit(10);

      if (postsError || !highEngagementPosts?.length) {
        console.log('   No high-engagement posts found');
        continue;
      }

      console.log(`   Found ${highEngagementPosts.length} high-engagement posts`);

      // Check which posts haven't been reposted yet
      const { data: existingReposts } = await supabase
        .from('linkedin_reposts')
        .select('original_social_id')
        .eq('workspace_id', workspace.workspace_id);

      const repostedIds = new Set((existingReposts || []).map(r => r.original_social_id));

      // Find first unreposted high-engagement post
      const postToRepost = highEngagementPosts.find(p => !repostedIds.has(p.social_id));

      if (!postToRepost) {
        console.log('   All high-engagement posts already reposted');
        continue;
      }

      console.log(`   🎯 Selected post: ${postToRepost.social_id}`);
      console.log(`      Engagement: ${postToRepost.engagement_metrics?.likes || 0} likes, ${postToRepost.engagement_metrics?.comments || 0} comments`);

      // Get LinkedIn account
      const { data: linkedinAccount } = await supabase
        .from('workspace_accounts')
        .select('unipile_account_id')
        .eq('workspace_id', workspace.workspace_id)
        .eq('account_type', 'linkedin')
        .in('connection_status', VALID_CONNECTION_STATUSES)
        .limit(1)
        .single();

      if (!linkedinAccount) {
        console.log('   ❌ No LinkedIn account connected');
        errors.push(`Workspace ${workspace.workspace_id}: No LinkedIn account`);
        continue;
      }

      // Generate repost comment
      const repostComment = await generateRepostComment(
        {
          id: postToRepost.id,
          social_id: postToRepost.social_id,
          post_author: postToRepost.post_author || 'Unknown',
          post_content: postToRepost.post_content || '',
          share_url: postToRepost.share_url,
          workspace_id: workspace.workspace_id,
          engagement_metrics: postToRepost.engagement_metrics || { likes: 0, comments: 0, reposts: 0 }
        },
        workspace.tone_of_voice || '',
        workspace.topics_and_perspective || ''
      );

      // Create the quote post with comment + link
      const postText = `${repostComment}\n\n${postToRepost.share_url}`;
      console.log(`   📝 Post text: ${postText.substring(0, 100)}...`);

      // Create post via Unipile
      const unipileResponse = await fetch(
        `${UNIPILE_BASE_URL}/api/v1/posts`,
        {
          method: 'POST',
          headers: {
            'X-API-KEY': UNIPILE_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            account_id: linkedinAccount.unipile_account_id,
            text: postText
          })
        }
      );

      if (!unipileResponse.ok) {
        const errorText = await unipileResponse.text();
        console.error(`   ❌ Unipile error: ${errorText}`);
        errors.push(`Workspace ${workspace.workspace_id}: ${errorText}`);

        // Save failed repost attempt
        await supabase.from('linkedin_reposts').insert({
          workspace_id: workspace.workspace_id,
          original_post_id: postToRepost.id,
          original_social_id: postToRepost.social_id,
          original_author: postToRepost.post_author,
          original_share_url: postToRepost.share_url,
          repost_comment: repostComment,
          status: 'failed'
        });

        continue;
      }

      const unipileData = await unipileResponse.json();
      const repostSocialId = unipileData.id || unipileData.object?.id || null;
      console.log(`   ✅ Repost created: ${repostSocialId}`);

      // Save successful repost
      await supabase.from('linkedin_reposts').insert({
        workspace_id: workspace.workspace_id,
        original_post_id: postToRepost.id,
        original_social_id: postToRepost.social_id,
        original_author: postToRepost.post_author,
        original_share_url: postToRepost.share_url,
        repost_comment: repostComment,
        repost_social_id: repostSocialId,
        status: 'posted',
        posted_at: new Date().toISOString()
      });

      reposted++;
    }

    const duration = Date.now() - startTime;
    console.log(`\n✅ Daily repost complete`);
    console.log(`   Reposted: ${reposted}, Skipped: ${skipped}, Errors: ${errors.length}`);

    return NextResponse.json({
      success: true,
      reposted,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      duration_ms: duration
    });

  } catch (error) {
    console.error('❌ Daily repost error:', error);
    return NextResponse.json({
      error: 'Daily repost failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET for manual testing
export async function GET(req: NextRequest) {
  const testReq = new NextRequest(req.url, {
    method: 'POST',
    headers: {
      'x-cron-secret': process.env.CRON_SECRET || ''
    }
  });
  return POST(testReq);
}
