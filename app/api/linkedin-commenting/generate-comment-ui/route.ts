/**
 * LinkedIn Commenting Agent - Generate Comment (UI-triggered)
 * Called directly from the UI to generate AI comments for discovered posts
 */

import { supabaseAdmin } from '@/app/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import {
  generateLinkedInComment,
  CommentGenerationContext
} from '@/lib/services/linkedin-commenting-agent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.post_id) {
      return NextResponse.json(
        { error: 'Missing required field: post_id' },
        { status: 400 }
      );
    }

    console.log('💬 Generating comment for post (UI-triggered):', body.post_id);

    const supabase = supabaseAdmin();

    // Get post details
    const { data: post, error: postError } = await supabase
      .from('linkedin_posts_discovered')
      .select('*')
      .eq('id', body.post_id)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: 'Post not found', details: postError?.message },
        { status: 404 }
      );
    }

    // Get workspace context
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', post.workspace_id)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Get monitor settings
    const { data: monitor, error: monitorError } = await supabase
      .from('linkedin_post_monitors')
      .select('*')
      .eq('id', post.monitor_id)
      .single();

    if (monitorError || !monitor) {
      return NextResponse.json(
        { error: 'Monitor not found' },
        { status: 404 }
      );
    }

    // Build context for AI (matching the signature from linkedin-commenting-agent.ts)
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

    // Generate comment using AI
    const generatedComment = await generateLinkedInComment(context);

    // Check if AI decided to skip
    if (generatedComment.confidence_score === 0.0) {
      console.log('⏭️ AI decided to skip this post:', generatedComment.reasoning);
      return NextResponse.json({
        skipped: true,
        reason: generatedComment.reasoning
      });
    }

    // Save comment to database
    const { data: savedComment, error: saveError } = await supabase
      .from('linkedin_post_comments')
      .insert({
        workspace_id: post.workspace_id,
        monitor_id: post.monitor_id,
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
      console.error('❌ Error saving comment:', saveError);
      return NextResponse.json({
        error: 'Failed to save comment',
        details: saveError.message
      }, { status: 500 });
    }

    // Update post status
    await supabase
      .from('linkedin_posts_discovered')
      .update({
        status: 'comment_generated',
        updated_at: new Date().toISOString()
      })
      .eq('id', body.post_id);

    console.log('✅ Comment generated and saved:', savedComment.id);

    return NextResponse.json({
      success: true,
      comment: savedComment
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
