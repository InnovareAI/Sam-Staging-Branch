/**
 * Generate AI-powered reply suggestion for a LinkedIn comment
 * POST /api/linkedin-commenting/generate-reply
 *
 * "Ask Sam" feature - generates contextual, engaging replies
 */

import { verifyAuth, pool, AuthError } from '@/lib/auth';
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
    const { post_id, original_comment_text, original_comment_author } = body;

    if (!post_id || !original_comment_text || !original_comment_author) {
      return NextResponse.json(
        { error: 'Missing required fields: post_id, original_comment_text, original_comment_author' },
        { status: 400 }
      );
    }

    // Authenticate user using Firebase auth
    const { workspaceId } = await verifyAuth(request);

    // Get post details
    const postResult = await pool.query(
      `SELECT post_content, author_name, author_title FROM linkedin_posts_discovered WHERE id = $1`,
      [post_id]
    );

    if (postResult.rows.length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const post = postResult.rows[0];

    // Get workspace name
    const workspaceResult = await pool.query(
      `SELECT name FROM workspaces WHERE id = $1`,
      [workspaceId]
    );

    // Get brand guidelines
    const brandResult = await pool.query(
      `SELECT * FROM linkedin_brand_guidelines WHERE workspace_id = $1`,
      [workspaceId]
    );

    const brandGuidelines = brandResult.rows[0];

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
    // Handle auth errors
    if (error && typeof error === 'object' && 'code' in error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }

    console.error('❌ Error generating reply:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
