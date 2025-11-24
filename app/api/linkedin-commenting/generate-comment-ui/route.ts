/**
 * LinkedIn Commenting Agent - Generate Comment (UI-triggered)
 * Called directly from the UI to generate AI comments for discovered posts
 */

import { createClient } from '@/app/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  generateLinkedInComment,
  CommentGenerationContext,
  shouldSkipPost,
  validateCommentQuality
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

    const supabase = await createClient();

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
      .select('name, metadata')
      .eq('id', post.workspace_id)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Get knowledge base snippets for context
    const { data: knowledgeSnippets } = await supabase
      .from('knowledge_base')
      .select('content')
      .eq('workspace_id', post.workspace_id)
      .limit(3);

    // Build context for AI
    const workspaceContext = {
      workspace_id: post.workspace_id,
      company_name: workspace.name || 'Our Company',
      expertise_areas: workspace.metadata?.expertise_areas || [],
      products: workspace.metadata?.products || [],
      value_props: workspace.metadata?.value_propositions || [],
      tone_of_voice: workspace.metadata?.tone_of_voice || 'professional_friendly',
      knowledge_base_snippets: knowledgeSnippets?.map(k => k.content) || []
    };

    const context: CommentGenerationContext = {
      workspace_context: workspaceContext,
      post: {
        content: post.post_content,
        author_name: post.author_name,
        hashtags: post.hashtags || [],
        engagement_metrics: post.engagement_metrics
      }
    };

    // Check if we should skip this post
    const skipCheck = await shouldSkipPost(post, supabase);
    if (skipCheck.should_skip) {
      // Update post status to skipped
      await supabase
        .from('linkedin_posts_discovered')
        .update({
          status: 'skipped',
          skip_reason: skipCheck.reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', body.post_id);

      return NextResponse.json({
        skipped: true,
        reason: skipCheck.reason
      });
    }

    // Generate comment using AI
    const generatedComment = await generateLinkedInComment(context);

    // Validate quality
    const qualityCheck = validateCommentQuality(generatedComment, post.post_content);
    if (!qualityCheck.is_valid) {
      console.warn('❌ Generated comment failed quality check:', qualityCheck.reason);
      return NextResponse.json({
        error: 'Generated comment failed quality check',
        reason: qualityCheck.reason
      }, { status: 500 });
    }

    // Save comment to database
    const { data: savedComment, error: saveError } = await supabase
      .from('linkedin_post_comments')
      .insert({
        workspace_id: post.workspace_id,
        monitor_id: post.monitor_id,
        post_id: post.id,
        comment_text: generatedComment,
        status: 'pending_approval',
        generated_at: new Date().toISOString()
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
