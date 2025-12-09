/**
 * Discover Comments on Self-Posts
 * POST /api/cron/discover-self-post-comments
 *
 * Called by Netlify scheduled function every 30 minutes
 * Fetches new comments on monitored posts and queues them for reply generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

interface UnipileComment {
  id: string;
  social_id?: string;
  text: string;
  date?: string;
  created_at?: string;
  author?: {
    name?: string;
    first_name?: string;
    last_name?: string;
    headline?: string;
    profile_url?: string;
    provider_id?: string;
  };
  reaction_counter?: {
    total_count?: number;
    like_count?: number;
  };
}

/**
 * Fetch comments on a post via Unipile API
 */
async function fetchPostComments(
  postSocialId: string,
  accountId: string
): Promise<UnipileComment[]> {
  try {
    const response = await fetch(
      `${UNIPILE_BASE_URL}/api/v1/posts/${encodeURIComponent(postSocialId)}/comments?account_id=${accountId}`,
      {
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch comments: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.items || data.comments || data || [];
  } catch (error) {
    console.error('Error fetching comments:', error);
    return [];
  }
}

/**
 * Check if a comment is a question (simple heuristic)
 */
function isQuestion(text: string): boolean {
  const questionPatterns = [
    /\?/,
    /^(what|where|when|why|how|who|which|can|could|would|should|is|are|do|does|did|will|has|have)/i,
    /tell me (more|about)/i,
    /interested in/i,
    /learn more/i
  ];
  return questionPatterns.some(pattern => pattern.test(text));
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🔍 Discovering comments on self-posts...');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let monitorsChecked = 0;
  let commentsFound = 0;
  let repliesQueued = 0;
  const errors: string[] = [];

  try {
    // Get active self-post monitors that are due for checking
    const now = new Date();
    const { data: monitors, error: fetchError } = await supabase
      .from('linkedin_self_post_monitors')
      .select('*')
      .eq('is_active', true)
      .or(`last_checked_at.is.null,last_checked_at.lt.${new Date(now.getTime() - 30 * 60 * 1000).toISOString()}`);

    if (fetchError) {
      console.error('Error fetching monitors:', fetchError);
      return NextResponse.json({
        error: 'Failed to fetch monitors',
        details: fetchError.message
      }, { status: 500 });
    }

    if (!monitors || monitors.length === 0) {
      console.log('✅ No monitors due for checking');
      return NextResponse.json({
        success: true,
        monitorsChecked: 0,
        commentsFound: 0,
        repliesQueued: 0,
        message: 'No monitors due for checking'
      });
    }

    console.log(`📋 Found ${monitors.length} monitors to check`);

    // Process each monitor
    for (const monitor of monitors) {
      try {
        console.log(`\n📝 Checking monitor: ${monitor.post_title || monitor.id}`);
        monitorsChecked++;

        // Get LinkedIn account for this workspace
        const { data: linkedinAccount } = await supabase
          .from('workspace_accounts')
          .select('unipile_account_id')
          .eq('workspace_id', monitor.workspace_id)
          .eq('account_type', 'linkedin')
          .eq('connection_status', 'connected')
          .limit(1)
          .single();

        if (!linkedinAccount) {
          console.log(`   ⚠️ No LinkedIn account for workspace ${monitor.workspace_id}`);
          errors.push(`Monitor ${monitor.id}: No LinkedIn account`);
          continue;
        }

        // Fetch comments from LinkedIn
        const postId = monitor.post_social_id || monitor.post_ugc_id;
        if (!postId) {
          console.log(`   ⚠️ No post ID for monitor`);
          errors.push(`Monitor ${monitor.id}: No post ID`);
          continue;
        }

        const comments = await fetchPostComments(postId, linkedinAccount.unipile_account_id);
        console.log(`   📨 Found ${comments.length} comments on post`);

        // Reset daily counter if needed
        const today = new Date().toISOString().split('T')[0];
        if (monitor.replies_reset_date !== today) {
          await supabase
            .from('linkedin_self_post_monitors')
            .update({
              replies_sent_today: 0,
              replies_reset_date: today
            })
            .eq('id', monitor.id);
        }

        // Get existing replies to avoid duplicates
        const { data: existingReplies } = await supabase
          .from('linkedin_self_post_comment_replies')
          .select('comment_linkedin_id')
          .eq('monitor_id', monitor.id);

        const existingCommentIds = new Set(existingReplies?.map(r => r.comment_linkedin_id) || []);

        // Process new comments
        for (const comment of comments) {
          const commentId = comment.social_id || comment.id;
          if (!commentId || existingCommentIds.has(commentId)) {
            continue; // Skip if already processed
          }

          commentsFound++;

          // Skip short comments if configured
          const commentText = comment.text || '';
          if (monitor.skip_single_word_comments && commentText.split(/\s+/).length <= 2) {
            console.log(`   ⏭️ Skipping short comment: "${commentText.substring(0, 30)}..."`);
            continue;
          }

          if (commentText.length < (monitor.min_comment_length || 10)) {
            console.log(`   ⏭️ Skipping comment below min length`);
            continue;
          }

          // Skip non-questions if configured
          const commentIsQuestion = isQuestion(commentText);
          if (monitor.reply_to_questions_only && !commentIsQuestion) {
            console.log(`   ⏭️ Skipping non-question comment`);
            continue;
          }

          // Check daily limit
          if ((monitor.replies_sent_today || 0) >= (monitor.max_replies_per_day || 20)) {
            console.log(`   ⚠️ Daily reply limit reached for this monitor`);
            break;
          }

          // Queue the comment for reply generation
          const { error: insertError } = await supabase
            .from('linkedin_self_post_comment_replies')
            .insert({
              workspace_id: monitor.workspace_id,
              monitor_id: monitor.id,
              comment_linkedin_id: commentId,
              comment_text: commentText,
              commenter_name: comment.author?.name ||
                `${comment.author?.first_name || ''} ${comment.author?.last_name || ''}`.trim() ||
                'Unknown',
              commenter_headline: comment.author?.headline,
              commenter_linkedin_url: comment.author?.profile_url,
              commenter_provider_id: comment.author?.provider_id,
              commented_at: comment.date || comment.created_at,
              comment_likes_count: comment.reaction_counter?.total_count || 0,
              is_question: commentIsQuestion,
              status: 'pending_generation'
            });

          if (insertError) {
            if (insertError.code !== '23505') { // Ignore duplicates
              console.error(`   ❌ Error inserting reply record:`, insertError);
              errors.push(`Comment ${commentId}: ${insertError.message}`);
            }
            continue;
          }

          repliesQueued++;
          console.log(`   ✅ Queued reply for: "${commentText.substring(0, 50)}..."`);
        }

        // Update monitor last checked
        await supabase
          .from('linkedin_self_post_monitors')
          .update({
            last_checked_at: new Date().toISOString(),
            total_comments_found: (monitor.total_comments_found || 0) + commentsFound
          })
          .eq('id', monitor.id);

      } catch (monitorError) {
        console.error(`❌ Error processing monitor ${monitor.id}:`, monitorError);
        errors.push(`Monitor ${monitor.id}: ${monitorError instanceof Error ? monitorError.message : 'Unknown error'}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n✅ Self-post comment discovery complete`);
    console.log(`   Monitors checked: ${monitorsChecked}`);
    console.log(`   Comments found: ${commentsFound}`);
    console.log(`   Replies queued: ${repliesQueued}`);
    console.log(`   Duration: ${duration}ms`);

    return NextResponse.json({
      success: true,
      monitorsChecked,
      commentsFound,
      repliesQueued,
      errors: errors.length > 0 ? errors : undefined,
      duration_ms: duration
    });

  } catch (error) {
    console.error('❌ Self-post comment discovery error:', error);
    return NextResponse.json({
      error: 'Failed to discover comments',
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
