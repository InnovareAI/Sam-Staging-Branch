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
import { pool } from '@/lib/db';
import {
  generateLinkedInComment,
  CommentGenerationContext
} from '@/lib/services/linkedin-commenting-agent';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// CORS headers for Chrome extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS preflight request
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Validate API key from Authorization header
 */
async function validateApiKey(request: NextRequest): Promise<{ valid: boolean; workspace_id?: string; error?: string }> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid Authorization header' };
  }

  const apiKey = authHeader.replace('Bearer ', '').trim();

  if (!apiKey.startsWith('sk_live_')) {
    return { valid: false, error: 'Invalid API key format' };
  }

  // Hash the provided key
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  // Look up key in database using service role to bypass RLS
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const poolKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const { data: apiKeyRecord, error } = await supabase
    .from('api_keys')
    .select('id, workspace_id, is_active, expires_at, scopes')
    .eq('key_hash', keyHash)
    .single();

  if (error || !apiKeyRecord) {
    return { valid: false, error: 'Invalid API key' };
  }

  // Check if key is active
  if (!apiKeyRecord.is_active) {
    return { valid: false, error: 'API key has been deactivated' };
  }

  // Check if key has expired
  if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
    return { valid: false, error: 'API key has expired' };
  }

  // Check if key has required scope
  if (!apiKeyRecord.scopes || !apiKeyRecord.scopes.includes('linkedin:comment:generate')) {
    return { valid: false, error: 'API key does not have required permissions' };
  }

  // Update last_used_at (fire and forget)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKeyRecord.id)
    .then(() => {});

  return { valid: true, workspace_id: apiKeyRecord.workspace_id };
}

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
 *   engagement?: { likes: number, comments: number },
 *   image_url?: string,
 *   image_description?: string,
 *   video_captions?: string,
 *   generate_variations?: boolean (default: true)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const authResult = await validateApiKey(request);
    if (!authResult.valid) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await request.json();

    // Use workspace_id from API key (more secure than trusting request body)
    const workspaceId = authResult.workspace_id!;

    console.log('💬 Generating comment from extension for workspace:', workspaceId);

    if (!body.post_text || body.post_text.trim().length < 20) {
      return NextResponse.json(
        { error: 'post_text is required and must be at least 20 characters' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!body.author_name) {
      return NextResponse.json(
        { error: 'Missing required field: author_name' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Use service role client for workspace and brand guidelines access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const poolKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    // Get workspace context
    const { data: workspace, error: workspaceError} = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Check if commenting agent is enabled
    if (!workspace.commenting_agent_enabled) {
      return NextResponse.json(
        { error: 'Commenting agent is not enabled for this workspace' },
        { status: 403, headers: corsHeaders }
      );
    }

    // Get brand guidelines for better quality comments
    const { data: brandGuidelines } = await supabase
      .from('linkedin_brand_guidelines')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();

    console.log('📋 Brand guidelines loaded:', brandGuidelines ? 'Yes' : 'No (using defaults)');

    // Get knowledge base context if enabled
    let knowledgeBaseContext = '';
    if (brandGuidelines?.use_workspace_knowledge) {
      const { data: kbItems } = await supabase
        .from('knowledge_base')
        .select('content, title')
        .eq('workspace_id', workspaceId)
        .limit(5);

      if (kbItems && kbItems.length > 0) {
        knowledgeBaseContext = kbItems
          .map((item) => `${item.title}: ${item.content}`)
          .join('\n\n');
      }
    }

    // Enhance post text with image/video context
    let enhancedPostText = body.post_text;
    if (body.image_description) {
      enhancedPostText += `\n\n[Image in post: ${body.image_description}]`;
    }
    if (body.video_captions) {
      enhancedPostText += `\n\n[Video transcript: ${body.video_captions}]`;
    }

    // Build context for AI
    const context: CommentGenerationContext = {
      post: {
        id: `extension-${Date.now()}`,
        post_linkedin_id: '',
        post_social_id: '',
        post_text: enhancedPostText,
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

    // Determine if we should generate variations
    const generateVariations = body.generate_variations !== false; // default true

    if (!generateVariations) {
      // Single comment generation (legacy behavior)
      console.log('🤖 Generating single comment with SAM AI...');
      const generatedComment = await generateLinkedInComment(context);

      if (generatedComment.confidence_score === 0.0) {
        return NextResponse.json({
          skipped: true,
          reason: generatedComment.reasoning
        }, { headers: corsHeaders });
      }

      return NextResponse.json({
        success: true,
        comment_text: generatedComment.comment_text,
        confidence_score: generatedComment.confidence_score,
        reasoning: generatedComment.reasoning,
        quality_indicators: generatedComment.quality_indicators,
        should_auto_post: false,
        generation_metadata: generatedComment.generation_metadata
      }, { headers: corsHeaders });
    }

    // Generate multiple variations
    console.log('🤖 Generating 3 comment variations (long/short, comment/question)...');

    const variations = await Promise.all([
      // Variation 1: Longer thoughtful comment
      generateLinkedInComment({
        ...context,
        workspace: {
          ...context.workspace,
          tone_of_voice: (context.workspace.tone_of_voice || '') + '. Write a longer, more thoughtful comment (3-4 sentences).'
        }
      }),
      // Variation 2: Shorter punchy comment
      generateLinkedInComment({
        ...context,
        workspace: {
          ...context.workspace,
          tone_of_voice: (context.workspace.tone_of_voice || '') + '. Write a short, punchy comment (1-2 sentences).'
        }
      }),
      // Variation 3: Thought-provoking question
      generateLinkedInComment({
        ...context,
        workspace: {
          ...context.workspace,
          tone_of_voice: (context.workspace.tone_of_voice || '') + '. End with a thought-provoking question to spark discussion.'
        }
      })
    ]);

    // Filter out any skipped variations
    const validVariations = variations.filter(v => v.confidence_score > 0.0);

    if (validVariations.length === 0) {
      return NextResponse.json({
        skipped: true,
        reason: 'All variations were skipped by AI'
      }, { headers: corsHeaders });
    }

    console.log(`✅ Generated ${validVariations.length} variations successfully`);

    // Return all variations
    return NextResponse.json({
      success: true,
      variations: validVariations.map((v, index) => ({
        id: index + 1,
        type: index === 0 ? 'long' : index === 1 ? 'short' : 'question',
        comment_text: v.comment_text,
        confidence_score: v.confidence_score,
        reasoning: v.reasoning,
        quality_indicators: v.quality_indicators
      })),
      generation_metadata: variations[0].generation_metadata,
      should_auto_post: false
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500, headers: corsHeaders });
  }
}
