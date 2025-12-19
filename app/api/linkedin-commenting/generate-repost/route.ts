/**
 * SAM API ENDPOINT FOR GENERATING LINKEDIN REPOST BLURBS
 *
 * This endpoint generates thoughtful commentary/blurbs for reposting content
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  generateLinkedInComment,
  CommentGenerationContext
} from '@/lib/services/linkedin-commenting-agent';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

async function validateApiKey(request: NextRequest): Promise<{ valid: boolean; workspace_id?: string; error?: string }> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid Authorization header' };
  }

  const apiKey = authHeader.replace('Bearer ', '').trim();

  if (!apiKey.startsWith('sk_live_')) {
    return { valid: false, error: 'Invalid API key format' };
  }

  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: apiKeyRecord, error } = await supabase
    .from('api_keys')
    .select('id, workspace_id, is_active, expires_at, scopes')
    .eq('key_hash', keyHash)
    .single();

  if (error || !apiKeyRecord) {
    return { valid: false, error: 'Invalid API key' };
  }

  if (!apiKeyRecord.is_active) {
    return { valid: false, error: 'API key is inactive' };
  }

  if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
    return { valid: false, error: 'API key has expired' };
  }

  const requiredScope = 'linkedin:comment:generate';
  if (!apiKeyRecord.scopes || !apiKeyRecord.scopes.includes(requiredScope)) {
    return { valid: false, error: `Missing required scope: ${requiredScope}` };
  }

  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKeyRecord.id)
    .then(() => {});

  return { valid: true, workspace_id: apiKeyRecord.workspace_id };
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiKey(request);
    if (!authResult.valid) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const workspaceId = authResult.workspace_id!;

    console.log('🔄 Generating repost blurb for workspace:', workspaceId);

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const { data: brandGuidelines } = await supabase
      .from('linkedin_brand_guidelines')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();

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

    let enhancedPostText = body.post_text;
    if (body.image_description) {
      enhancedPostText += `\n\n[Image in post: ${body.image_description}]`;
    }
    if (body.video_captions) {
      enhancedPostText += `\n\n[Video transcript: ${body.video_captions}]`;
    }

    const baseContext: CommentGenerationContext = {
      post: {
        id: `extension-repost-${Date.now()}`,
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
          likes_count: 0,
          comments_count: 0,
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

    console.log('🤖 Generating 3 repost blurb variations...');

    const variations = await Promise.all([
      // Variation 1: Longer thoughtful repost blurb
      generateLinkedInComment({
        ...baseContext,
        workspace: {
          ...baseContext.workspace,
          tone_of_voice: (baseContext.workspace.tone_of_voice || '') + '. Write a thoughtful 2-3 sentence introduction for reposting this content. Explain why it resonates with you or your audience.'
        }
      }),
      // Variation 2: Shorter punchy blurb
      generateLinkedInComment({
        ...baseContext,
        workspace: {
          ...baseContext.workspace,
          tone_of_voice: (baseContext.workspace.tone_of_voice || '') + '. Write a short, punchy 1-sentence introduction for reposting this. Keep it sharp and engaging.'
        }
      }),
      // Variation 3: Question-based engagement
      generateLinkedInComment({
        ...baseContext,
        workspace: {
          ...baseContext.workspace,
          tone_of_voice: (baseContext.workspace.tone_of_voice || '') + '. Write a brief introduction that ends with a question to spark discussion when reposting this content.'
        }
      })
    ]);

    const validVariations = variations.filter(v => v.confidence_score > 0.0);

    if (validVariations.length === 0) {
      return NextResponse.json({
        skipped: true,
        reason: 'All variations were skipped by AI'
      }, { headers: corsHeaders });
    }

    console.log(`✅ Generated ${validVariations.length} repost blurb variations`);

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
