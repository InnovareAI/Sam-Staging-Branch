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

    // Fetch workspace settings for resources
    const { data: settings } = await supabase
      .from('reply_agent_settings')
      .select('calendar_link, demo_video_link, pdf_overview_link, case_studies_link, landing_page_link, signup_link')
      .eq('workspace_id', draft.workspace_id)
      .single();

    // Resource links from workspace settings (with fallbacks for InnovareAI)
    const calendarLink = settings?.calendar_link || null;
    const demoVideoLink = settings?.demo_video_link || 'https://links.innovareai.com/SamAIDemoVideo';
    const pdfOverviewLink = settings?.pdf_overview_link || null;
    const caseStudiesLink = settings?.case_studies_link || null;
    const landingPageLink = settings?.landing_page_link || 'https://innovareai.com/sam';
    const signupLink = settings?.signup_link || 'https://app.meet-sam.com/signup/innovareai';

    // Generate new reply with instructions
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

    const systemPrompt = `You are a sales rep for SAM AI, an AI-powered LinkedIn outreach automation platform.

You previously wrote this reply to a prospect:
"${draft.draft_text}"

The user has provided additional instructions for how to improve the reply.
Follow their instructions while keeping the message professional and conversational.

## IMPORTANT RESOURCES
- **Demo video:** ${demoVideoLink}
${calendarLink ? `- **Calendar/booking:** ${calendarLink}` : ''}
${pdfOverviewLink ? `- **PDF overview:** ${pdfOverviewLink}` : ''}
${caseStudiesLink ? `- **Case studies:** ${caseStudiesLink}` : ''}
- **Landing page:** ${landingPageLink}
- **Signup link:** ${signupLink}
${contextualGreeting ? `- **Holiday greeting:** ${contextualGreeting}` : ''}

## UNIVERSAL TONE RULES
- Sound human, not templated
- NO corporate buzzwords (leverage, synergy, robust)
- NO fake enthusiasm ("Thanks so much!", "Love what you're doing!")
- Keep it conversational and natural
- Match the appropriate level of formality for their industry

## LINK USAGE
- "demo", "video", "watch" → ${demoVideoLink}
${calendarLink ? `- "calendar", "meeting", "book a call", "schedule" → ${calendarLink}` : ''}
${pdfOverviewLink ? `- "pdf", "overview", "one-pager", "document" → ${pdfOverviewLink}` : ''}
${caseStudiesLink ? `- "case study", "results", "success stories" → ${caseStudiesLink}` : ''}
- "website", "learn more", "landing page" → ${landingPageLink}
- "signup", "sign up", "try", "get started", "trial" → ${signupLink}`;

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
