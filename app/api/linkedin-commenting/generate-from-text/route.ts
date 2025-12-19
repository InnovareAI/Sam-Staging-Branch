/**
 * NEW SAM API ENDPOINT FOR CHROME EXTENSION
 *
 * Add this file to: /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/linkedin-commenting/generate-from-text/route.ts
 *
 * This endpoint accepts raw LinkedIn post text from the Chrome extension
 * and generates a comment without needing the post to be in the database.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import {
  generateLinkedInComment,
  CommentGenerationContext
} from '@/lib/services/linkedin-commenting-agent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Generate LinkedIn comment from raw post text (Chrome Extension)
 *
 * POST /api/linkedin-commenting/generate-from-text
 *
 * Body:
 * {
 *   workspace_id: string,
 *   post_text: string,
 *   author_name: string,
 *   author_title?: string,
 *   engagement?: { likes: number, comments: number }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.workspace_id) {
      return NextResponse.json(
        { error: 'Missing required field: workspace_id' },
        { status: 400 }
      );
    }

    if (!body.post_text || body.post_text.trim().length < 20) {
      return NextResponse.json(
        { error: 'post_text is required and must be at least 20 characters' },
        { status: 400 }
      );
    }

    if (!body.author_name) {
      return NextResponse.json(
        { error: 'Missing required field: author_name' },
        { status: 400 }
      );
    }

    console.log('💬 Generating comment from extension for workspace:', body.workspace_id);

    const supabase = await createServerSupabaseClient();

    // Get workspace context
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', body.workspace_id)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 }
      );
    }

    // Check if commenting agent is enabled
    if (!workspace.commenting_agent_enabled) {
      return NextResponse.json(
        { error: 'Commenting agent is not enabled for this workspace' },
        { status: 403 }
      );
    }

    // Get brand guidelines for better quality comments
    const { data: brandGuidelines } = await supabase
      .from('linkedin_brand_guidelines')
      .select('*')
      .eq('workspace_id', body.workspace_id)
      .single();

    console.log('📋 Brand guidelines loaded:', brandGuidelines ? 'Yes' : 'No (using defaults)');

    // Get knowledge base context if enabled
    let knowledgeBaseContext = '';
    if (brandGuidelines?.use_workspace_knowledge) {
      const { data: kbItems } = await supabase
        .from('knowledge_base')
        .select('content, title')
        .eq('workspace_id', body.workspace_id)
        .limit(5);

      if (kbItems && kbItems.length > 0) {
        knowledgeBaseContext = kbItems
          .map((item) => `${item.title}: ${item.content}`)
          .join('\n\n');
      }
    }

    // Build context for AI
    const context: CommentGenerationContext = {
      post: {
        id: `extension-${Date.now()}`,
        post_linkedin_id: '',
        post_social_id: '',
        post_text: body.post_text,
        post_type: 'article',
        author: {
          linkedin_id: '',
          name: body.author_name,
          title: body.author_title || undefined,
          company: undefined,
          profile_url: undefined
        },
        engagement: {
          likes_count: body.engagement?.likes || 0,
          comments_count: body.engagement?.comments || 0,
          shares_count: 0
        },
        posted_at: new Date(),
        discovered_via_monitor_type: 'extension',
        matched_keywords: []
      },
      workspace: {
        workspace_id: workspace.id,
        company_name: workspace.name || 'Your Company',
        expertise_areas: workspace.expertise_areas || ['B2B Sales', 'Lead Generation'],
        products: workspace.products || [],
        value_props: workspace.value_props || [],
        tone_of_voice: brandGuidelines?.tone_of_voice || workspace.tone_of_voice || 'Professional and helpful',
        knowledge_base_snippets: [],
        brand_guidelines: brandGuidelines || undefined,
        knowledge_base_context: knowledgeBaseContext || undefined
      }
    };

    // Generate comment using AI
    console.log('🤖 Generating comment with SAM AI...');
    const generatedComment = await generateLinkedInComment(context);

    // Check if AI decided to skip
    if (generatedComment.confidence_score === 0.0) {
      console.log('⏭️ AI decided to skip this post:', generatedComment.reasoning);
      return NextResponse.json({
        skipped: true,
        reason: generatedComment.reasoning
      });
    }

    console.log('✅ Comment generated successfully:', {
      length: generatedComment.comment_text.length,
      confidence: generatedComment.confidence_score
    });

    // Return the generated comment (don't save to DB for extension)
    return NextResponse.json({
      success: true,
      comment_text: generatedComment.comment_text,
      confidence_score: generatedComment.confidence_score,
      reasoning: generatedComment.reasoning,
      quality_indicators: generatedComment.quality_indicators,
      should_auto_post: false, // Always require human review for extension
      generation_metadata: generatedComment.generation_metadata
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
