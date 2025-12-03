import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';
import { getClaudeClient } from '@/lib/llm/claude-client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/reply-agent/regenerate
 * Regenerate a draft reply with additional instructions
 */
export async function POST(request: NextRequest) {
  try {
    const { draftId, token, instructions } = await request.json();

    if (!draftId || !token || !instructions) {
      return NextResponse.json(
        { error: 'Missing draftId, token, or instructions' },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    // Fetch the draft
    const { data: draft, error: fetchError } = await supabase
      .from('reply_agent_drafts')
      .select('*')
      .eq('id', draftId)
      .eq('approval_token', token)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json(
        { error: 'Draft not found or invalid token' },
        { status: 404 }
      );
    }

    // Check if draft is still pending
    if (draft.status !== 'pending_approval') {
      return NextResponse.json(
        { error: `This draft was already ${draft.status}` },
        { status: 409 }
      );
    }

    // Generate new reply with instructions
    const claude = getClaudeClient();

    const systemPrompt = `You are a sales rep for SAM AI, an AI-powered LinkedIn outreach automation platform.

You previously wrote this reply to a prospect:
"${draft.draft_text}"

The user has provided additional instructions for how to improve the reply.
Follow their instructions while keeping the message professional and conversational.

## UNIVERSAL TONE RULES
- Sound human, not templated
- NO corporate buzzwords (leverage, synergy, robust)
- NO fake enthusiasm ("Thanks so much!", "Love what you're doing!")
- Keep it conversational and natural
- Match the appropriate level of formality for their industry`;

    const userPrompt = `PROSPECT:
- Name: ${draft.prospect_name}
- Title: ${draft.prospect_title || 'Unknown'}
- Company: ${draft.prospect_company || 'Unknown'}

THEIR ORIGINAL MESSAGE:
"${draft.inbound_message_text}"

YOUR PREVIOUS REPLY:
"${draft.draft_text}"

USER'S INSTRUCTIONS:
${instructions}

Generate an improved reply following the user's instructions. Reply only with the new message text, no explanations.`;

    const newReply = await claude.complete(userPrompt, {
      system: systemPrompt,
      maxTokens: 400,
      temperature: 0.7,
    });

    // Update the draft with the new text
    await supabase
      .from('reply_agent_drafts')
      .update({
        draft_text: newReply.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId);

    return NextResponse.json({
      success: true,
      newDraftText: newReply.trim(),
    });
  } catch (error) {
    console.error('Regenerate error:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate reply' },
      { status: 500 }
    );
  }
}
