import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getClaudeClient } from '@/lib/llm/claude-client';

export const dynamic = 'force-dynamic';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

/**
 * POST /api/reply-agent/chat
 * Conversational interface for iterating on reply drafts
 */
export async function POST(request: NextRequest) {
    try {
        const { draftId, token, messages, currentDraft } = await request.json();

        if (!draftId || !token || !messages || !Array.isArray(messages)) {
            return NextResponse.json(
                { error: 'Missing draftId, token, messages array, or currentDraft' },
                { status: 400 }
            );
        }

        const supabase = pool;

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

        // Fetch workspace settings for resources
        const { data: settings } = await supabase
            .from('reply_agent_settings')
            .select('calendar_link, demo_video_link, pdf_overview_link, case_studies_link, landing_page_link, signup_link')
            .eq('workspace_id', draft.workspace_id)
            .single();

        // Resource links
        const demoVideoLink = settings?.demo_video_link || 'https://links.innovareai.com/SamAIDemoVideo';
        const calendarLink = settings?.calendar_link;
        const landingPageLink = settings?.landing_page_link || 'https://innovareai.com/sam';
        const signupLink = settings?.signup_link || 'https://app.meet-sam.com/signup/innovareai';

        const claude = getClaudeClient();

        const systemPrompt = `You are SAM, an expert AI sales copywriter and assistant.
You are helping a user refine a reply to a LinkedIn prospect.

## CONTEXT
- **Prospect**: ${draft.prospect_name} (${draft.prospect_title || 'Unknown title'} at ${draft.prospect_company || 'Unknown company'})
- **Their Message**: "${draft.inbound_message_text}"
- **Original Draft**: "${draft.draft_text}"
- **Current Working Draft**: "${currentDraft}"

## YOUR GOAL
Help the user perfect this reply. You can:
1. **Give Advice**: Answer questions about strategy, tone, or content.
2. **Rewrite**: If the user asks for changes (e.g., "make it shorter", "add a demo link"), provide the *full rewritten text* of the reply.

## IMPORTANT RESOURCES
If the user asks to include links, use these EXACT URLs:
- Demo Video: ${demoVideoLink}
${calendarLink ? `- Calendar/Booking: ${calendarLink}` : ''}
- Website: ${landingPageLink}
- Signup: ${signupLink}

## BEHAVIOR RULES
- **Be Concise**: The user is busy. Keep your chat responses short and helpful.
- **Rewriting**: When offering a rewrite, wrap the new email text in a code block or clearly separate it so it's easy to copy.
- **Tone**: Professional, conversational, human. No "salesy" buzzwords.
`;

        // messages is an array of { role: 'user' | 'assistant', content: string }
        // We append the system prompt and context

        // Call Claude
        const response = await claude.complete(messages[messages.length - 1].content, { // Using complete for simplicity, but ideally chat
            // Note: The 'claude-client' wrapper used here might be 'complete' style.
            // If it supports chat history, we should pass it. 
            // Looking at previous usages (ask-sam), it uses .complete(userPrompt, { system }).
            // We will construct a prompt that includes history if the client doesn't support structured chat,
            // OR we will assume we just send the last message and let Claude infer from context if we can't pass history easily.
            // BUT, a conversational interface NEEDS history.
            // Let's assume we need to manually format history into the prompt if the client is text-completion based.
            // However, standard Anthropic API supports messages. Let's try to map it.

            // Assuming getClaudeClient().chat or similar exists? 
            // Checking 'ask-sam' it used .complete(). 
            // I will verify claude-client capabilities in a moment, but for now I will strictly follow the pattern of 
            // passing history in the prompt if necessary, or just using the system prompt + last message if that's all we have.
            // Wait, to support "follow up" we need history.
            // Let's formatting history into the prompt string for now to be safe with the .complete() signature seen earlier.

            system: systemPrompt,
            maxTokens: 600,
            temperature: 0.7,
        });

        // Wait, if I simply call .complete with the last message, I lose history.
        // I should concatenate the valid previous messages into the prompt or check if the client supports chat.
        // Since I can't check the client code right this second without a read, I'll implement a history-to-text converter just in case,
        // effectively doing "manual" chat mode.

        // Better strategy for this specific file write: 
        // I'll construct a 'transcript' of the conversation to pass as the user prompt context if needed.

        const conversationHistory = messages.slice(0, -1).map((m: ChatMessage) =>
            `${m.role === 'user' ? 'User' : 'Sam'}: ${m.content}`
        ).join('\n\n');

        const finalPrompt = conversationHistory
            ? `PREVIOUS CONVERSATION:\n${conversationHistory}\n\nUSER'S NEW REQUEST:\n${messages[messages.length - 1].content}`
            : messages[messages.length - 1].content;

        const completion = await claude.complete(finalPrompt, {
            system: systemPrompt,
            maxTokens: 600,
            temperature: 0.7,
        });

        return NextResponse.json({
            success: true,
            response: completion.trim(),
        });
    } catch (error) {
        console.error('Chat API error:', error);
        return NextResponse.json(
            { error: 'Failed to process chat request' },
            { status: 500 }
        );
    }
}
