/**
 * Process Scheduled Comments Queue
 * POST /api/cron/process-comment-queue
 *
 * Called by Netlify scheduled function every 30 minutes
 * Posts comments where scheduled_post_time <= now
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('📤 Processing scheduled comments queue...');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    // Get all scheduled comments that are due
    const { data: dueComments, error: fetchError } = await supabase
      .from('linkedin_post_comments')
      .select(`
        *,
        post:linkedin_posts_discovered!inner (
          id,
          social_id,
          share_url,
          workspace_id
        )
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_post_time', now.toISOString())
      .order('scheduled_post_time', { ascending: true })
      .limit(5); // Process up to 5 at a time to avoid timeout

    if (fetchError) {
      console.error('❌ Error fetching scheduled comments:', fetchError);
      return NextResponse.json({
        error: 'Failed to fetch scheduled comments',
        details: fetchError.message
      }, { status: 500 });
    }

    if (!dueComments || dueComments.length === 0) {
      console.log('✅ No scheduled comments due');
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No scheduled comments due'
      });
    }

    console.log(`📋 Found ${dueComments.length} scheduled comments to post`);

    // Process each comment
    for (const comment of dueComments) {
      try {
        console.log(`\n📤 Posting comment ${comment.id}...`);

        // Get LinkedIn account for this workspace
        const { data: linkedinAccount } = await supabase
          .from('workspace_accounts')
          .select('unipile_account_id')
          .eq('workspace_id', comment.workspace_id)
          .eq('account_type', 'linkedin')
          .eq('connection_status', 'connected')
          .limit(1)
          .single();

        if (!linkedinAccount) {
          console.error(`❌ No LinkedIn account for workspace ${comment.workspace_id}`);
          await supabase
            .from('linkedin_post_comments')
            .update({
              status: 'failed',
              failure_reason: 'No connected LinkedIn account',
              updated_at: new Date().toISOString()
            })
            .eq('id', comment.id);
          failed++;
          errors.push(`Comment ${comment.id}: No LinkedIn account`);
          continue;
        }

        // Post comment to LinkedIn via Unipile
        const postSocialId = comment.post.social_id;
        console.log(`   Posting to LinkedIn post: ${postSocialId}`);

        const unipileResponse = await fetch(
          `${UNIPILE_BASE_URL}/api/v1/posts/${encodeURIComponent(postSocialId)}/comments`,
          {
            method: 'POST',
            headers: {
              'X-API-KEY': UNIPILE_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              account_id: linkedinAccount.unipile_account_id,
              text: comment.comment_text
            })
          }
        );

        if (!unipileResponse.ok) {
          const errorText = await unipileResponse.text();
          console.error(`❌ Unipile error: ${unipileResponse.status} ${errorText}`);

          await supabase
            .from('linkedin_post_comments')
            .update({
              status: 'failed',
              failure_reason: `Unipile error: ${errorText}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', comment.id);

          failed++;
          errors.push(`Comment ${comment.id}: ${errorText}`);
          continue;
        }

        const unipileData = await unipileResponse.json();
        console.log('   ✅ Comment posted to LinkedIn');

        // Extract LinkedIn comment ID
        const linkedinCommentId = unipileData.id || unipileData.comment_id || unipileData.object_id || null;

        // Auto-like the post after commenting
        console.log(`   👍 Liking post ${postSocialId}...`);
        try {
          const likeResponse = await fetch(
            `${UNIPILE_BASE_URL}/api/v1/posts/${encodeURIComponent(postSocialId)}/reactions`,
            {
              method: 'POST',
              headers: {
                'X-API-KEY': UNIPILE_API_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                account_id: linkedinAccount.unipile_account_id,
                reaction_type: 'LIKE'
              })
            }
          );

          if (likeResponse.ok) {
            console.log('   ✅ Post liked');
          } else {
            const likeError = await likeResponse.text();
            console.log(`   ⚠️ Could not like post: ${likeError}`);
          }
        } catch (likeError) {
          console.log(`   ⚠️ Like failed: ${likeError}`);
        }

        // Update comment status to 'posted'
        await supabase
          .from('linkedin_post_comments')
          .update({
            status: 'posted',
            posted_at: new Date().toISOString(),
            post_response: unipileData,
            linkedin_comment_id: linkedinCommentId,
            updated_at: new Date().toISOString()
          })
          .eq('id', comment.id);

        // Update post status to 'commented'
        await supabase
          .from('linkedin_posts_discovered')
          .update({ status: 'commented' })
          .eq('id', comment.post_id);

        processed++;

        // Rate limit: wait 3 seconds between posts
        if (dueComments.indexOf(comment) < dueComments.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

      } catch (commentError) {
        console.error(`❌ Error processing comment ${comment.id}:`, commentError);
        failed++;
        errors.push(`Comment ${comment.id}: ${commentError instanceof Error ? commentError.message : 'Unknown error'}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n✅ Comment queue processing complete`);
    console.log(`   Processed: ${processed}, Failed: ${failed}, Duration: ${duration}ms`);

    return NextResponse.json({
      success: true,
      processed,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      duration_ms: duration
    });

  } catch (error) {
    console.error('❌ Comment queue processor error:', error);
    return NextResponse.json({
      error: 'Failed to process comment queue',
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
