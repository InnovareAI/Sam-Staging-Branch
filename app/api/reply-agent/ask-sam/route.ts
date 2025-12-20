import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';
import { getClaudeClient } from '@/lib/llm/claude-client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/reply-agent/ask-sam
 * Ask SAM for advice on how to respond to a prospect
 */
export async function POST(request: NextRequest) {
  try {
    const { draftId, token, question, currentDraft } = await request.json();

    if (!draftId || !token || !question) {
      return NextResponse.json(
        { error: 'Missing draftId, token, or question' },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    // Verify the draft exists and token is valid
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

    // Fetch workspace settings for calendar link
    const { data: settings } = await supabase
      .from('reply_agent_settings')
      .select('calendar_link')
      .eq('workspace_id', draft.workspace_id)
      .single();

    const calendarLink = settings?.calendar_link || null;
    // Demo video link - separate from calendar link
    // TODO: Add demo_video_link column to reply_agent_settings for per-workspace config
    const demoVideoLink = 'https://links.innovareai.com/SamAIDemoVideo';

    // Build context for SAM
    const claude = getClaudeClient();

    // Get contextual greeting based on date
    const now = new Date();
    const month = now.getMonth();
    const date = now.getDate();
    let contextualGreeting = '';
    if (month === 11 && date >= 20) {
      if (date >= 26) contextualGreeting = "Hope you're enjoying the holiday week!";
      else if (date >= 24) contextualGreeting = "Merry Christmas!";
      else contextualGreeting = "Merry Christmas and happy holidays!";
    } else if (month === 0 && date <= 7) {
      contextualGreeting = "Happy New Year!";
    }

    const systemPrompt = `You are SAM, an AI sales advisor helping a user craft the perfect response to a LinkedIn prospect.

Your role is to give brief, actionable advice. Be direct and specific - the user is on mobile and needs quick guidance.

## Context About This Conversation
- **Prospect**: ${draft.prospect_name} (${draft.prospect_title || 'Unknown title'} at ${draft.prospect_company || 'Unknown company'})
- **Their message**: "${draft.inbound_message_text}"
- **Detected intent**: ${draft.intent_detected || 'UNCLEAR'}
- **Current draft reply**: "${currentDraft || draft.draft_text}"

## Important Resources to Reference
- **Demo video link:** ${demoVideoLink}
${calendarLink ? `- **Calendar booking link:** ${calendarLink}` : ''}
${contextualGreeting ? `- **Holiday greeting to use:** ${contextualGreeting}` : ''}

## Research on this prospect
${draft.research_linkedin_profile ? `LinkedIn: ${JSON.stringify(draft.research_linkedin_profile)}` : 'No LinkedIn data'}
${draft.research_company_profile ? `Company: ${JSON.stringify(draft.research_company_profile)}` : 'No company data'}

## Guidelines
- Give 2-3 sentences of advice max
- Be specific to THIS prospect and message
- If they ask for a rewrite, provide the text directly
- No corporate buzzwords or fake enthusiasm
- If they ask about demo/video links, provide: ${demoVideoLink}
${calendarLink ? `- If they ask about calendar/booking links, provide: ${calendarLink}` : ''}`;

    const userPrompt = question;

    const response = await claude.complete(userPrompt, {
      system: systemPrompt,
      maxTokens: 300,
      temperature: 0.7,
    });

    return NextResponse.json({
      success: true,
      response: response.trim(),
    });
  } catch (error) {
    console.error('Ask SAM error:', error);
    return NextResponse.json(
      { error: 'Failed to get response from SAM' },
      { status: 500 }
    );
  }
}
