/**
 * Follow-up Agent Service
 * Re-engages prospects who went silent after Reply Agent
 */

import { enrichProspectContext, ProspectEnrichmentData } from './reply-agent-enrichment';

export interface FollowUpContext {
  follow_up_id: string;
  prospect: {
    id: string;
    name: string;
    email?: string;
    company?: string;
    title?: string;
    linkedin_url?: string;
    company_website?: string;
  };
  campaign: {
    id: string;
    name: string;
    channel: 'email' | 'linkedin' | 'both';
  };
  conversation_history: {
    initial_message?: string;
    our_reply?: string;
    their_reply?: string;
  };
  follow_up_attempt: number; // 1, 2, or 3
  days_since_last_contact: number;
  enrichment_data?: ProspectEnrichmentData;
}

export interface GeneratedFollowUp {
  subject: string;
  message: string;
  tone: 'gentle' | 'value-add' | 'final-attempt';
  confidence_score: number;
  metadata: {
    model: string;
    tokens_used: number;
    generation_time_ms: number;
    template_used?: string;
  };
}

/**
 * Generate intelligent follow-up message
 */
export async function generateFollowUpMessage(
  context: FollowUpContext
): Promise<GeneratedFollowUp> {
  const startTime = Date.now();

  console.log('🔄 Generating follow-up message:', {
    prospect: context.prospect.name,
    attempt: context.follow_up_attempt,
    days_since: context.days_since_last_contact
  });

  // Determine tone based on attempt number
  const tone = getFollowUpTone(context.follow_up_attempt);

  // Build context-aware prompt
  const systemPrompt = buildFollowUpSystemPrompt(context, tone);
  const userPrompt = buildFollowUpUserPrompt(context);

  // Generate with Claude
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com',
      'X-Title': 'SAM AI - Follow-up Generation'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 400,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`);
  }

  const data = await response.json();
  const fullMessage = data.choices[0].message.content;

  // Extract subject and body
  const { subject, message } = extractSubjectAndBody(fullMessage);

  const generationTime = Date.now() - startTime;

  console.log('✅ Follow-up generated:', {
    attempt: context.follow_up_attempt,
    tone,
    subject_length: subject.length,
    message_length: message.length,
    time_ms: generationTime
  });

  return {
    subject,
    message,
    tone,
    confidence_score: calculateConfidenceScore(context, tone),
    metadata: {
      model: 'claude-3.5-sonnet',
      tokens_used: data.usage?.total_tokens || 0,
      generation_time_ms: generationTime
    }
  };
}

/**
 * Determine follow-up tone based on attempt number
 */
function getFollowUpTone(attempt: number): 'gentle' | 'value-add' | 'final-attempt' {
  switch (attempt) {
    case 1:
      return 'gentle'; // Soft nudge, assume they're busy
    case 2:
      return 'value-add'; // Provide additional value/resource
    case 3:
      return 'final-attempt'; // Last chance, permission to close
    default:
      return 'gentle';
  }
}

/**
 * Build system prompt for follow-up generation
 */
function buildFollowUpSystemPrompt(
  context: FollowUpContext,
  tone: 'gentle' | 'value-add' | 'final-attempt'
): string {
  let basePrompt = `You are SAM, a B2B sales assistant. Generate a follow-up message for a prospect who hasn't replied to our last message.

## Context
- Prospect: ${context.prospect.name}${context.prospect.title ? `, ${context.prospect.title}` : ''} at ${context.prospect.company}
- Days since last contact: ${context.days_since_last_contact}
- Follow-up attempt: ${context.follow_up_attempt} of 3
- Campaign: ${context.campaign.name}

## Previous Conversation`;

  if (context.conversation_history.their_reply) {
    basePrompt += `\n- Their question: "${context.conversation_history.their_reply}"`;
  }

  if (context.conversation_history.our_reply) {
    basePrompt += `\n- Our response: "${context.conversation_history.our_reply?.substring(0, 200)}..."`;
  }

  // Add enrichment data if available
  if (context.enrichment_data?.company_website_content) {
    const website = context.enrichment_data.company_website_content;
    basePrompt += `\n\n## Company Intel
- Products/Services: ${website.products_services.slice(0, 3).join(', ')}
- Key Initiatives: ${website.key_initiatives.slice(0, 2).join(', ')}`;
  }

  // Tone-specific guidelines
  basePrompt += `\n\n## Follow-up Guidelines (Attempt ${context.follow_up_attempt})`;

  switch (tone) {
    case 'gentle':
      basePrompt += `
Tone: Gentle, understanding, non-pushy

Approach:
- Acknowledge they're likely busy
- Quick reminder of your previous conversation
- Low-pressure check-in
- Single specific question or offer

Format:
Subject: [Brief, curious subject - max 6 words]
Body: 2-3 short sentences maximum

Example structure:
"Hi [Name], I know things get busy! Just wanted to quickly follow up on [specific topic]. [One specific offer or question]. Let me know if you'd like to connect."`;
      break;

    case 'value-add':
      basePrompt += `
Tone: Helpful, value-focused, consultative

Approach:
- Lead with NEW value (resource, insight, case study)
- Reference their specific situation/challenge
- No pressure, just helping
- Permission-based ask

Format:
Subject: [Value-focused - mention the resource/insight]
Body: 3-4 short sentences

Example structure:
"Hi [Name], I came across [relevant resource/insight] and thought of you given [their situation]. [Brief explanation of value]. Happy to share if helpful. Worth a quick call?"`;
      break;

    case 'final-attempt':
      basePrompt += `
Tone: Respectful, assumptive close, permission to end

Approach:
- Acknowledge the silence professionally
- Assume timing isn't right (not interested)
- Ask permission to close the conversation
- Leave door open for future

Format:
Subject: [Direct but respectful - mention "closing the loop"]
Body: 2-3 sentences

Example structure:
"Hi [Name], I haven't heard back so I'm guessing timing isn't right. Totally understand - I'll close this on my end. Feel free to reach out anytime if things change."`;
      break;
  }

  basePrompt += `\n\n## Critical Rules
- Keep it SHORT (${tone === 'gentle' ? '50' : '75'} words max)
- No desperation or pressure
- Reference specific context from previous conversation
- Make it easy to respond (yes/no question)
- Professional but warm
- Return in format: Subject: [subject]\\n\\n[body]`;

  return basePrompt;
}

/**
 * Build user prompt
 */
function buildFollowUpUserPrompt(context: FollowUpContext): string {
  return `Generate a follow-up message for ${context.prospect.name} from ${context.prospect.company}.

Days since last contact: ${context.days_since_last_contact}
Follow-up attempt: ${context.follow_up_attempt}

Generate the follow-up now:`;
}

/**
 * Extract subject and body from AI response
 */
function extractSubjectAndBody(fullMessage: string): { subject: string; message: string } {
  const subjectMatch = fullMessage.match(/Subject:\s*(.+?)(?:\n|$)/i);
  let subject = subjectMatch ? subjectMatch[1].trim() : 'Following up';

  // Remove "Subject:" line from body
  let message = fullMessage.replace(/Subject:\s*.+?(?:\n|$)/i, '').trim();

  // Clean up any markdown or formatting
  message = message.replace(/^[\n\r]+/, '').trim();

  return { subject, message };
}

/**
 * Calculate confidence score for follow-up
 */
function calculateConfidenceScore(
  context: FollowUpContext,
  tone: 'gentle' | 'value-add' | 'final-attempt'
): number {
  let score = 0.7; // Base score

  // Higher confidence if we have conversation history
  if (context.conversation_history.their_reply) {
    score += 0.1;
  }

  // Higher confidence if we have enrichment data
  if (context.enrichment_data) {
    score += 0.1;
  }

  // Decrease confidence with each attempt
  score -= (context.follow_up_attempt - 1) * 0.1;

  // Gentle tone is safer (higher confidence)
  if (tone === 'gentle') {
    score += 0.05;
  }

  return Math.max(0.4, Math.min(1.0, score));
}

/**
 * Create follow-up with enrichment (optional, for high-value prospects)
 */
export async function generateEnrichedFollowUp(
  context: FollowUpContext
): Promise<GeneratedFollowUp> {
  console.log('🔍 Generating enriched follow-up with fresh context...');

  // Re-scrape for latest context (optional, for VIP prospects)
  const enrichmentData = await enrichProspectContext({
    linkedin_url: context.prospect.linkedin_url,
    company_website: context.prospect.company_website,
    company: context.prospect.company
  });

  const enrichedContext = {
    ...context,
    enrichment_data: enrichmentData
  };

  return await generateFollowUpMessage(enrichedContext);
}

/**
 * Batch generate follow-ups for multiple prospects
 */
export async function batchGenerateFollowUps(
  contexts: FollowUpContext[]
): Promise<Array<{ follow_up_id: string; result: GeneratedFollowUp; error?: string }>> {
  const results = [];

  for (const context of contexts) {
    try {
      const result = await generateFollowUpMessage(context);
      results.push({
        follow_up_id: context.follow_up_id,
        result,
        error: undefined
      });
    } catch (error) {
      results.push({
        follow_up_id: context.follow_up_id,
        result: {} as GeneratedFollowUp,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Rate limiting: Wait 500ms between generations
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

/**
 * Check if prospect should receive follow-up (validation rules)
 */
export function shouldSendFollowUp(context: FollowUpContext): {
  should_send: boolean;
  reason?: string;
} {
  // Rule 1: Don't exceed max attempts
  if (context.follow_up_attempt > 3) {
    return { should_send: false, reason: 'Max attempts reached' };
  }

  // Rule 2: Wait minimum days
  if (context.days_since_last_contact < 2) {
    return { should_send: false, reason: 'Too soon (< 2 days)' };
  }

  // Rule 3: Don't send if no initial contact
  if (!context.conversation_history.our_reply) {
    return { should_send: false, reason: 'No initial message sent' };
  }

  // Rule 4: Business hours check (optional)
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  // Skip weekends
  if (day === 0 || day === 6) {
    return { should_send: false, reason: 'Weekend - wait for Monday' };
  }

  // Skip late night / early morning
  if (hour < 8 || hour > 18) {
    return { should_send: false, reason: 'Outside business hours' };
  }

  return { should_send: true };
}
