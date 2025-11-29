/**
 * Generate AI-powered reply suggestion for a LinkedIn comment
 * POST /api/linkedin-commenting/generate-reply
 *
 * "Ask Sam" feature - generates contextual, engaging replies
 */

import { createClient } from '@supabase/supabase-js';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextRequest, NextResponse } from 'next/server';
import { claudeClient } from '@/lib/llm/claude-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

interface GenerateReplyRequest {
  post_id: string;
  original_comment_text: string;
  original_comment_author: string;
  workspace_id: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateReplyRequest = await request.json();
    const { post_id, original_comment_text, original_comment_author, workspace_id } = body;

    if (!post_id || !original_comment_text || !original_comment_author) {
      return NextResponse.json(
        { error: 'Missing required fields: post_id, original_comment_text, original_comment_author' },
        { status: 400 }
      );
    }

    // Authenticate user
    const authClient = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get post details
    const { data: post, error: postError } = await supabase
      .from('linkedin_posts_discovered')
      .select('post_content, author_name, author_title')
      .eq('id', post_id)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Get workspace and brand guidelines
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspace_id)
      .single();

    const { data: brandGuidelines } = await supabase
      .from('linkedin_brand_guidelines')
      .select('*')
      .eq('workspace_id', workspace_id)
      .single();

    console.log(`🤖 Ask Sam: Generating reply to ${original_comment_author}'s comment`);

    // Build the prompt
    const systemPrompt = `You are Sam, an AI assistant helping professionals engage authentically on LinkedIn.
Your job is to generate a thoughtful, conversational reply to a comment on a LinkedIn post.

GUIDELINES:
- Be conversational and warm, not corporate or stiff
- Add value to the conversation - share a relevant insight, ask a thoughtful question, or build on their point
- Keep it concise (1-3 sentences max)
- Sound human and genuine, not like a bot
- Don't be salesy or promotional
- Match the tone of the original comment (casual if they're casual, professional if they're professional)
${brandGuidelines?.tone_of_voice ? `- Tone of voice: ${brandGuidelines.tone_of_voice}` : ''}
${brandGuidelines?.topics_to_avoid ? `- Avoid topics: ${brandGuidelines.topics_to_avoid.join(', ')}` : ''}

NEVER:
- Start with "Great point!" or "Love this!" (too generic)
- Use corporate buzzwords like "synergy", "leverage", "touch base"
- Sound like you're reading from a script
- Be sycophantic or over-the-top with praise`;

    const userPrompt = `CONTEXT:
Original LinkedIn Post by ${post.author_name}${post.author_title ? ` (${post.author_title})` : ''}:
"${post.post_content?.substring(0, 500)}${post.post_content?.length > 500 ? '...' : ''}"

Comment by ${original_comment_author} that we're replying to:
"${original_comment_text}"

Generate a thoughtful reply to ${original_comment_author}'s comment. The reply should feel natural and add to the conversation.`;

    // Call Claude Direct API (GDPR compliant)
    let aiResponse: string;
    try {
      const response = await claudeClient.chat({
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 200,
        temperature: 0.7
      });
      aiResponse = response.content;
    } catch (error) {
      console.error('❌ Claude API error:', error);
      return NextResponse.json(
        { error: 'Failed to generate reply', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }

    const generatedReply = aiResponse.trim();

    if (!generatedReply) {
      return NextResponse.json(
        { error: 'No reply generated' },
        { status: 500 }
      );
    }

    console.log(`✅ Generated reply: "${generatedReply.substring(0, 50)}..."`);

    return NextResponse.json({
      success: true,
      reply: generatedReply,
      context: {
        replying_to: original_comment_author,
        post_author: post.author_name
      }
    });

  } catch (error) {
    console.error('❌ Error generating reply:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
