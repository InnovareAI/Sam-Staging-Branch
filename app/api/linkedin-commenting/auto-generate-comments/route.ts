/**
 * Auto-generate comments for newly discovered LinkedIn posts
 * POST /api/linkedin-commenting/auto-generate-comments
 */

import { supabaseAdmin } from '@/app/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { generateLinkedInComment } from '@/lib/services/linkedin-commenting-agent';
import type { CommentGenerationContext } from '@/lib/services/linkedin-commenting-agent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for batch generation

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { post_ids, workspace_id, monitor_id } = body;

    if (!post_ids || !Array.isArray(post_ids) || post_ids.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid post_ids array' },
        { status: 400 }
      );
    }

    if (!workspace_id) {
      return NextResponse.json(
        { error: 'Missing workspace_id' },
        { status: 400 }
      );
    }

    console.log(`🤖 Auto-generating comments for ${post_ids.length} posts...`);

    const supabase = supabaseAdmin();

    // Fetch workspace context
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspace_id)
      .single();

    if (workspaceError || !workspace) {
      console.error('❌ Error fetching workspace:', workspaceError);
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Fetch brand guidelines for higher quality comments
    const { data: brandGuidelines } = await supabase
      .from('linkedin_brand_guidelines')
      .select('*')
      .eq('workspace_id', workspace_id)
      .single();

    console.log('📋 Brand guidelines loaded:', brandGuidelines ? 'Yes' : 'No (using defaults)');

    // Fetch monitor settings
    const { data: monitor, error: monitorError } = await supabase
      .from('linkedin_post_monitors')
      .select('*')
      .eq('id', monitor_id)
      .single();

    if (monitorError || !monitor) {
      console.error('❌ Error fetching monitor:', monitorError);
      return NextResponse.json(
        { error: 'Monitor not found' },
        { status: 404 }
      );
    }

    // Fetch posts to generate comments for
    const { data: posts, error: postsError } = await supabase
      .from('linkedin_posts_discovered')
      .select('*')
      .in('id', post_ids)
      .eq('workspace_id', workspace_id);

    if (postsError || !posts || posts.length === 0) {
      console.error('❌ Error fetching posts:', postsError);
      return NextResponse.json(
        { error: 'Posts not found' },
        { status: 404 }
      );
    }

    console.log(`📝 Generating comments for ${posts.length} posts...`);

    const results = [];
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Generate comments for each post
    for (const post of posts) {
      try {
        // Build context for comment generation
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
              profile_url: `https://www.linkedin.com/in/${post.author_profile_id}`
            },
            engagement: {
              likes_count: post.engagement_metrics?.reactions || 0,
              comments_count: post.engagement_metrics?.comments || 0,
              shares_count: post.engagement_metrics?.reposts || 0
            },
            posted_at: new Date(post.post_date),
            discovered_via_monitor_type: 'profile',
            matched_keywords: post.hashtags || []
          },
          workspace: {
            workspace_id: workspace.id,
            company_name: workspace.name || 'Your Company',
            expertise_areas: monitor.expertise_areas || ['B2B Sales', 'Lead Generation'],
            products: monitor.products || [],
            value_props: monitor.value_props || [],
            tone_of_voice: brandGuidelines?.tone_of_voice || monitor.tone_of_voice || 'Professional and helpful',
            knowledge_base_snippets: [],
            brand_guidelines: brandGuidelines || undefined
          }
        };

        // Generate comment using AI with retry logic
        console.log(`💬 Generating comment for post: ${post.id.substring(0, 8)}...`);
        let generatedComment;
        let retries = 0;
        const maxRetries = 3;

        while (retries < maxRetries) {
          try {
            generatedComment = await generateLinkedInComment(context);
            break; // Success, exit retry loop
          } catch (error: any) {
            retries++;
            if (error.message?.includes('Too Many Requests') && retries < maxRetries) {
              const waitTime = Math.pow(2, retries) * 1000; // Exponential backoff: 2s, 4s, 8s
              console.log(`⏳ Rate limited, waiting ${waitTime/1000}s before retry ${retries}/${maxRetries}...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
            throw error; // Not rate limit or max retries reached
          }
        }

        // Check if AI decided to skip this post
        if (generatedComment.confidence_score === 0.0) {
          console.log(`⏭️ Skipping post ${post.id.substring(0, 8)} - AI decided not to comment`);
          skipCount++;
          results.push({
            post_id: post.id,
            status: 'skipped',
            reason: generatedComment.reasoning
          });
          continue;
        }

        // Determine status based on auto_approve setting
        let commentStatus = 'pending_approval';
        let scheduledPostTime: string | null = null;

        if (monitor.auto_approve_enabled) {
          // Auto-approve: schedule the comment for posting
          commentStatus = 'scheduled';

          // Count already scheduled comments today
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const { count: scheduledToday } = await supabase
            .from('linkedin_post_comments')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', workspace_id)
            .eq('status', 'scheduled')
            .gte('scheduled_post_time', today.toISOString());

          // Calculate scheduled time (spread throughout day, 36 min apart)
          const POSTING_START_HOUR = 6;
          const POSTING_END_HOUR = 18;
          const MAX_COMMENTS_PER_DAY = 20;
          const minutesBetween = Math.floor((POSTING_END_HOUR - POSTING_START_HOUR) * 60 / MAX_COMMENTS_PER_DAY);

          const now = new Date();
          const tz = brandGuidelines?.timezone || 'America/Los_Angeles';
          const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false });
          const currentHour = parseInt(formatter.format(now));

          let scheduled = new Date(now);
          if (currentHour < POSTING_START_HOUR || currentHour >= POSTING_END_HOUR) {
            scheduled.setDate(scheduled.getDate() + (currentHour >= POSTING_END_HOUR ? 1 : 0));
            scheduled.setHours(POSTING_START_HOUR, 0, 0, 0);
          }
          scheduled = new Date(scheduled.getTime() + (scheduledToday || 0) * minutesBetween * 60 * 1000);
          scheduledPostTime = scheduled.toISOString();

          console.log(`   🤖 Auto-approved, scheduled for ${scheduledPostTime}`);
        }

        // Save comment to database
        const { data: savedComment, error: saveError } = await supabase
          .from('linkedin_post_comments')
          .insert({
            workspace_id: workspace_id,
            monitor_id: monitor_id,
            post_id: post.id,
            comment_text: generatedComment.comment_text,
            status: commentStatus,
            scheduled_post_time: scheduledPostTime,
            approved_at: monitor.auto_approve_enabled ? new Date().toISOString() : null,
            generated_at: new Date().toISOString(),
            generation_metadata: {
              model: generatedComment.generation_metadata.model,
              tokens_used: generatedComment.generation_metadata.tokens_used,
              generation_time_ms: generatedComment.generation_metadata.generation_time_ms,
              confidence_score: generatedComment.confidence_score,
              quality_indicators: generatedComment.quality_indicators,
              reasoning: generatedComment.reasoning
            }
          })
          .select()
          .single();

        if (saveError) {
          console.error(`❌ Error saving comment for post ${post.id}:`, saveError);
          errorCount++;
          results.push({
            post_id: post.id,
            status: 'error',
            error: saveError.message
          });
          continue;
        }

        console.log(`✅ Comment generated and saved: ${savedComment.id.substring(0, 8)}`);
        successCount++;
        results.push({
          post_id: post.id,
          status: 'success',
          comment_id: savedComment.id,
          confidence_score: generatedComment.confidence_score
        });

        // Rate limiting: Wait 5 seconds between AI calls to avoid OpenRouter rate limits
        await new Promise(resolve => setTimeout(resolve, 5000));

      } catch (error) {
        console.error(`❌ Error generating comment for post ${post.id}:`, error);
        errorCount++;
        results.push({
          post_id: post.id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`\n✅ Comment generation complete:`);
    console.log(`   - Success: ${successCount}`);
    console.log(`   - Skipped: ${skipCount}`);
    console.log(`   - Errors: ${errorCount}`);

    return NextResponse.json({
      success: true,
      total_posts: posts.length,
      success_count: successCount,
      skip_count: skipCount,
      error_count: errorCount,
      results
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
