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
              title: undefined,
              company: undefined,
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
            tone_of_voice: monitor.tone_of_voice || 'Professional and helpful',
            knowledge_base_snippets: []
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

        // Save comment to database with status='pending_approval'
        const { data: savedComment, error: saveError } = await supabase
          .from('linkedin_post_comments')
          .insert({
            workspace_id: workspace_id,
            monitor_id: monitor_id,
            post_id: post.id,
            comment_text: generatedComment.comment_text,
            status: 'pending_approval',
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
