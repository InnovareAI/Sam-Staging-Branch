/**
 * Auto-Generate Comments Cron Job
 * POST /api/cron/auto-generate-comments
 *
 * Runs every 30 minutes via Netlify scheduled function
 * Finds discovered posts without comments and generates AI comments
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateLinkedInComment, generateCommentReply } from '@/lib/services/linkedin-commenting-agent';
import type { CommentGenerationContext, CommentReplyGenerationContext } from '@/lib/services/linkedin-commenting-agent';
import { fetchPostComments, shouldReplyToComment } from '@/lib/services/linkedin-comment-replies';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for batch generation

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET = process.env.CRON_SECRET;

// Limit posts per run to avoid timeout
const MAX_POSTS_PER_RUN = 10;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret !== CRON_SECRET) {
    console.error('❌ Invalid cron secret');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🤖 Auto-Generate Comments Cron Starting...');
  console.log(`   Time: ${new Date().toISOString()}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Find discovered posts that don't have comments yet
    // Join with monitors to get generation settings
    // IMPORTANT: Only process posts that have passed their comment_eligible_at time (randomizer)
    // This ensures we never comment immediately - posts must "age" 1-4 hours first
    const now = new Date().toISOString();
    const { data: posts, error: postsError } = await supabase
      .from('linkedin_posts_discovered')
      .select(`
        id,
        workspace_id,
        monitor_id,
        social_id,
        share_url,
        author_name,
        author_profile_id,
        author_title,
        author_company,
        post_content,
        post_date,
        hashtags,
        engagement_metrics,
        status,
        comment_eligible_at,
        linkedin_post_monitors!inner (
          id,
          auto_approve_enabled,
          metadata
        )
      `)
      .eq('status', 'discovered')
      .is('comment_generated_at', null)
      // RANDOMIZER: Only process posts that have passed their eligible time
      // Posts without comment_eligible_at (legacy) are immediately eligible
      .or(`comment_eligible_at.is.null,comment_eligible_at.lte.${now}`)
      .order('created_at', { ascending: false })
      .limit(MAX_POSTS_PER_RUN);

    if (postsError) {
      console.error('❌ Error fetching posts:', postsError);
      return NextResponse.json({ error: postsError.message }, { status: 500 });
    }

    if (!posts || posts.length === 0) {
      console.log('📭 No posts eligible for comments (may still be in waiting period)');
      return NextResponse.json({
        success: true,
        message: 'No posts eligible for comments (may still be in waiting period)',
        posts_processed: 0,
        comments_generated: 0,
        duration_ms: Date.now() - startTime
      });
    }

    // Log eligible posts with their wait times
    console.log(`📋 Found ${posts.length} posts eligible for comments`);
    for (const post of posts) {
      const eligibleAt = post.comment_eligible_at ? new Date(post.comment_eligible_at) : null;
      const waitedHours = eligibleAt ? ((Date.now() - eligibleAt.getTime()) / (1000 * 60 * 60)).toFixed(1) : 'N/A';
      console.log(`   - ${post.author_name}: waited ${waitedHours}h past eligible time`);
    }

    // Get unique workspace IDs for brand guidelines
    const workspaceIds = [...new Set(posts.map(p => p.workspace_id))];

    // Fetch brand guidelines for all workspaces
    const { data: brandGuidelines } = await supabase
      .from('linkedin_brand_guidelines')
      .select('*')
      .in('workspace_id', workspaceIds);

    const guidelinesByWorkspace: Record<string, any> = {};
    for (const bg of brandGuidelines || []) {
      guidelinesByWorkspace[bg.workspace_id] = bg;
    }

    // Fetch workspace names
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id, name')
      .in('id', workspaceIds);

    const workspaceNames: Record<string, string> = {};
    for (const ws of workspaces || []) {
      workspaceNames[ws.id] = ws.name;
    }

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const results: Array<{ post_id: string; status: string; comment_id?: string; error?: string }> = [];

    // Track authors we've already commented on in THIS RUN (one comment per author per run)
    const authorsCommentedThisRun = new Set<string>();

    // Get authors who already have pending/scheduled comments (avoid double-commenting)
    const { data: existingComments } = await supabase
      .from('linkedin_post_comments')
      .select('post:linkedin_posts_discovered!inner(author_profile_id, author_name)')
      .in('status', ['pending_approval', 'scheduled'])
      .in('workspace_id', workspaceIds);

    const authorsWithPendingComments = new Set<string>();
    for (const comment of existingComments || []) {
      const authorId = (comment.post as any)?.author_profile_id;
      if (authorId) authorsWithPendingComments.add(authorId);
    }

    console.log(`📋 ${authorsWithPendingComments.size} authors already have pending comments`);

    // Generate comments for each post
    for (const post of posts) {
      try {
        const monitor = post.linkedin_post_monitors;
        const brandGuideline = guidelinesByWorkspace[post.workspace_id];
        const authorId = post.author_profile_id || post.author_name || 'unknown';

        // DEDUPLICATION: Skip if we already commented on this author in this run
        if (authorsCommentedThisRun.has(authorId)) {
          console.log(`\n⏭️ Skipping post ${post.id.substring(0, 8)} - already commented on ${post.author_name} this run`);
          skipCount++;
          results.push({ post_id: post.id, status: 'skipped_duplicate_author_this_run' });
          continue;
        }

        // DEDUPLICATION: Skip if author already has a pending/scheduled comment
        if (authorsWithPendingComments.has(authorId)) {
          console.log(`\n⏭️ Skipping post ${post.id.substring(0, 8)} - ${post.author_name} already has pending comment`);
          skipCount++;
          results.push({ post_id: post.id, status: 'skipped_author_has_pending' });
          continue;
        }

        console.log(`\n💬 Processing post ${post.id.substring(0, 8)}...`);
        console.log(`   Author: ${post.author_name}`);

        // === 70/30 RULE: Check if we should reply to a comment ===
        // Fetch existing comments on the post
        const existingComments = await fetchPostComments(post.social_id);
        const replyDecision = shouldReplyToComment(existingComments);

        let isReplyToComment = false;
        let replyToCommentId: string | null = null;
        let replyToAuthorName: string | null = null;

        if (replyDecision.shouldReply && replyDecision.targetComment) {
          console.log(`   🎯 Will REPLY to comment (30% path): ${replyDecision.reason}`);
          isReplyToComment = true;
          replyToCommentId = replyDecision.targetComment.id;
          replyToAuthorName = replyDecision.targetComment.author_name;
        } else {
          console.log(`   📝 Will comment on POST (70% path): ${replyDecision.reason}`);
        }

        // Build workspace context (shared between both paths)
        // Note: expertise_areas, products, value_props are stored in brand_guidelines or monitor.metadata
        const monitorMetadata = monitor?.metadata as Record<string, any> || {};
        const workspaceContext = {
          workspace_id: post.workspace_id,
          company_name: workspaceNames[post.workspace_id] || 'Your Company',
          expertise_areas: monitorMetadata.expertise_areas || brandGuideline?.industry_talking_points || ['B2B Sales', 'Lead Generation'],
          products: monitorMetadata.products || [],
          value_props: monitorMetadata.value_props || [],
          tone_of_voice: brandGuideline?.tone_of_voice || monitorMetadata.tone_of_voice || 'Professional and helpful',
          knowledge_base_snippets: [],
          brand_guidelines: brandGuideline || undefined
        };

        // Generate comment with retry logic
        let generatedComment;
        let retries = 0;
        const maxRetries = 3;

        while (retries < maxRetries) {
          try {
            if (isReplyToComment && replyDecision.targetComment) {
              // Generate reply to comment (30% path)
              const replyContext: CommentReplyGenerationContext = {
                originalPost: {
                  text: post.post_content || '',
                  author_name: post.author_name || 'Unknown'
                },
                targetComment: {
                  id: replyDecision.targetComment.id,
                  text: replyDecision.targetComment.text,
                  author_name: replyDecision.targetComment.author_name,
                  reactions_count: replyDecision.targetComment.reactions_count
                },
                workspace: workspaceContext
              };
              generatedComment = await generateCommentReply(replyContext);
            } else {
              // Generate direct post comment (70% path)
              const context: CommentGenerationContext = {
                post: {
                  id: post.id,
                  post_linkedin_id: post.social_id || '',
                  post_social_id: post.social_id || '',
                  post_text: post.post_content || '',
                  post_type: 'article',
                  author: {
                    linkedin_id: post.author_profile_id || '',
                    name: post.author_name || 'Unknown Author',
                    title: post.author_title || undefined,
                    company: post.author_company || undefined,
                    profile_url: post.share_url ? post.share_url.split('/posts/')[0] : undefined
                  },
                  engagement: {
                    likes_count: post.engagement_metrics?.reactions || 0,
                    comments_count: post.engagement_metrics?.comments || 0,
                    shares_count: post.engagement_metrics?.reposts || 0
                  },
                  posted_at: post.post_date ? new Date(post.post_date) : new Date(),
                  discovered_via_monitor_type: 'profile',
                  matched_keywords: post.hashtags || []
                },
                workspace: workspaceContext
              };
              generatedComment = await generateLinkedInComment(context);
            }
            break;
          } catch (error: any) {
            retries++;
            if (error.message?.includes('Too Many Requests') && retries < maxRetries) {
              const waitTime = Math.pow(2, retries) * 1000;
              console.log(`   ⏳ Rate limited, waiting ${waitTime/1000}s before retry ${retries}/${maxRetries}...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
            throw error;
          }
        }

        // Check if AI decided to skip
        if (!generatedComment || generatedComment.confidence_score === 0.0) {
          console.log(`   ⏭️ AI decided not to comment: ${generatedComment?.reasoning || 'No reason'}`);
          skipCount++;

          // Mark post so we don't try again
          await supabase
            .from('linkedin_posts_discovered')
            .update({
              comment_generated_at: new Date().toISOString(),
              status: 'skipped'
            })
            .eq('id', post.id);

          results.push({ post_id: post.id, status: 'skipped' });
          continue;
        }

        // Determine status based on auto_approve setting
        let commentStatus = 'pending_approval';
        let scheduledPostTime: string | null = null;

        if (monitor?.auto_approve_enabled) {
          commentStatus = 'scheduled';

          // Calculate scheduled time (spread throughout business hours)
          const now = new Date();
          const tz = brandGuideline?.timezone || 'America/Los_Angeles';

          // Count already scheduled comments today
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const { count: scheduledToday } = await supabase
            .from('linkedin_post_comments')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', post.workspace_id)
            .eq('status', 'scheduled')
            .gte('scheduled_post_time', today.toISOString());

          // 36 minutes between posts (fills 6 AM - 6 PM with 20 posts)
          const minutesBetween = 36;
          const scheduled = new Date(now.getTime() + (scheduledToday || 0) * minutesBetween * 60 * 1000);
          scheduledPostTime = scheduled.toISOString();

          console.log(`   🤖 Auto-approved, scheduled for ${scheduledPostTime}`);
        }

        // Save comment to database
        const { data: savedComment, error: saveError } = await supabase
          .from('linkedin_post_comments')
          .insert({
            workspace_id: post.workspace_id,
            monitor_id: post.monitor_id,
            post_id: post.id,
            comment_text: generatedComment.comment_text,
            status: commentStatus,
            scheduled_post_time: scheduledPostTime,
            approved_at: monitor?.auto_approve_enabled ? new Date().toISOString() : null,
            generated_at: new Date().toISOString(),
            // Reply tracking (70/30 rule)
            is_reply_to_comment: isReplyToComment,
            reply_to_comment_id: replyToCommentId,
            reply_to_author_name: replyToAuthorName,
            generation_metadata: {
              model: generatedComment.generation_metadata?.model || 'claude-3-5-sonnet',
              tokens_used: generatedComment.generation_metadata?.tokens_used || 0,
              generation_time_ms: generatedComment.generation_metadata?.generation_time_ms || 0,
              confidence_score: generatedComment.confidence_score,
              quality_indicators: generatedComment.quality_indicators,
              reasoning: generatedComment.reasoning
            }
          })
          .select()
          .single();

        if (saveError) {
          console.error(`   ❌ Error saving comment:`, saveError);
          errorCount++;
          results.push({ post_id: post.id, status: 'error', error: saveError.message });
          continue;
        }

        // Update post to mark comment generated
        await supabase
          .from('linkedin_posts_discovered')
          .update({
            comment_generated_at: new Date().toISOString(),
            status: 'comment_pending'
          })
          .eq('id', post.id);

        console.log(`   ✅ Comment saved: ${savedComment.id.substring(0, 8)}`);
        successCount++;
        results.push({
          post_id: post.id,
          status: 'success',
          comment_id: savedComment.id
        });

        // Track this author so we don't comment on their other posts in this run
        authorsCommentedThisRun.add(authorId);
        authorsWithPendingComments.add(authorId); // Also prevent future runs from double-commenting

        // Rate limiting: 5 seconds between AI calls
        await new Promise(resolve => setTimeout(resolve, 5000));

      } catch (error) {
        console.error(`   ❌ Error generating comment for ${post.id}:`, error);
        errorCount++;
        results.push({
          post_id: post.id,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n✅ Auto-generate complete:`);
    console.log(`   Success: ${successCount}, Skipped: ${skipCount}, Errors: ${errorCount}`);
    console.log(`   Duration: ${duration}ms`);

    return NextResponse.json({
      success: true,
      posts_processed: posts.length,
      comments_generated: successCount,
      skipped: skipCount,
      errors: errorCount,
      results,
      duration_ms: duration
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// GET for manual testing
export async function GET(req: NextRequest) {
  return NextResponse.json({
    service: 'Auto-Generate Comments Cron',
    status: 'ready',
    description: 'Generates AI comments for discovered LinkedIn posts',
    schedule: 'Every 30 minutes',
    max_posts_per_run: MAX_POSTS_PER_RUN
  });
}
