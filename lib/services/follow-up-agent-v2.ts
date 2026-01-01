/**
 * Follow-Up Agent Service v2.0
 *
 * Enhanced Follow-Up Agent with:
 * - Training document integration
 * - Scenario-specific sequences
 * - Multi-channel support (LinkedIn + Email)
 * - AI-generated contextual messages
 * - HITL approval workflow
 *
 * Updated Dec 11, 2025
 */

import { claudeClient } from '@/lib/llm/claude-client';
import { pool } from '@/lib/db';

// ============================================
// TYPES
// ============================================

export type FollowUpScenario =
  | 'no_reply_to_cr'           // Accepted CR but never replied
  | 'replied_then_silent'       // Showed interest then ghosted
  | 'no_show_to_call'          // Booked call but didn't show
  | 'post_demo_silence'        // Had demo, no response after
  | 'check_back_later'         // They said to follow up later
  | 'trial_no_activity'        // Signed up but not using
  | 'standard';                // Default sequence

export type FollowUpChannel = 'linkedin' | 'email' | 'inmail';

export type FollowUpTone = 'light_bump' | 'value_add' | 'different_angle' | 'breakup';

export type FollowUpStatus =
  | 'pending_generation'    // Needs AI to generate message
  | 'pending_approval'      // Waiting for human approval
  | 'approved'              // Approved, ready to send
  | 'rejected'              // Human rejected, needs edit
  | 'sent'                  // Successfully sent
  | 'failed'                // Failed to send
  | 'archived';             // Sequence complete or stopped

export interface ProspectContext {
  id: string;
  first_name: string;
  last_name: string;
  company_name?: string;
  title?: string;
  industry?: string;
  linkedin_url?: string;
  email?: string;
  timezone?: string;
}

export interface ConversationHistory {
  initial_outreach?: string;
  their_replies?: string[];
  our_replies?: string[];
  last_topic_discussed?: string;
  questions_asked?: string[];
  objections_raised?: string[];
  meeting_scheduled_at?: string;
  demo_notes?: string;
}

export interface FollowUpContext {
  prospect: ProspectContext;
  campaign: {
    id: string;
    name: string;
    workspace_id: string;
  };
  scenario: FollowUpScenario;
  channel: FollowUpChannel;
  touch_number: number;
  max_touches: number;
  days_since_last_contact: number;
  conversation_history: ConversationHistory;
  check_back_date?: string; // For 'check_back_later' scenario
  previous_follow_ups?: string[]; // Messages already sent in this sequence
}

export interface GeneratedFollowUp {
  id?: string;
  message: string;
  subject?: string; // For email only
  tone: FollowUpTone;
  channel: FollowUpChannel;
  confidence_score: number;
  reasoning: string;
  next_follow_up_days?: number; // Days until next follow-up (null if breakup)
  metadata: {
    model: string;
    tokens_used: number;
    generation_time_ms: number;
    scenario: FollowUpScenario;
    touch_number: number;
  };
}

export interface FollowUpDraft {
  id: string;
  prospect_id: string;
  campaign_id: string;
  workspace_id: string;
  message: string;
  subject?: string;
  channel: FollowUpChannel;
  tone: FollowUpTone;
  touch_number: number;
  scenario: FollowUpScenario;
  status: FollowUpStatus;
  confidence_score: number;
  reasoning: string;
  scheduled_for?: string;
  sent_at?: string;
  approved_by?: string;
  approved_at?: string;
  rejected_reason?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// CADENCE CONFIGURATION
// ============================================

const SCENARIO_CADENCES: Record<FollowUpScenario, { days: number[]; maxTouches: number }> = {
  no_reply_to_cr: { days: [3, 7, 14, 30], maxTouches: 4 },
  replied_then_silent: { days: [3, 7, 14], maxTouches: 3 },
  no_show_to_call: { days: [0, 2, 7], maxTouches: 3 }, // 0 = same day
  post_demo_silence: { days: [2, 5, 10], maxTouches: 3 },
  check_back_later: { days: [0, 3], maxTouches: 2 }, // 0 = on specified date
  trial_no_activity: { days: [2, 5, 10], maxTouches: 3 },
  standard: { days: [3, 7, 14, 30], maxTouches: 4 }
};

const TONE_BY_TOUCH: Record<number, FollowUpTone> = {
  1: 'light_bump',
  2: 'value_add',
  3: 'different_angle',
  4: 'breakup'
};

// ============================================
// TRAINING DOCUMENT (Embedded for AI context)
// ============================================

const FOLLOW_UP_TRAINING = `
## SAM Follow-Up Agent Training

### Core Philosophy
Silence ≠ Rejection. People get busy, emails get buried, priorities shift.
Follow-ups are about strategic re-engagement with new context.

### Key Principles
1. Add value or context — don't just "bump" or "circle back"
2. Vary the angle — each follow-up should feel different
3. Respect the silence — 3-4 touches max, then archive
4. Make it easy to say no — permission to close reduces friction
5. Keep it short — shorter than original outreach
6. Strategic timing — never same-day follow-ups

### Tone by Touch
- Touch 1 (Light Bump): Simple reminder without pressure
- Touch 2 (Value Add): New context or value that justifies follow-up
- Touch 3 (Different Angle): Try completely different approach
- Touch 4 (Breakup): Close loop gracefully, leave door open

### Channel Guidelines
- LinkedIn: Conversational, 1-3 sentences max, no heavy formatting
- Email: Slightly more formal, under 75 words, keep thread (Re:)
- InMail: Professional, under 150 words, use sparingly

### What to NEVER Do
- "Just bumping this" (adds no value)
- "Circling back" (overused)
- "I know you're busy, but..." (apologetic)
- "Did you get my last message?" (confrontational)
- Re-sending the same message
- Following up same day
- Guilt-tripping or desperation

### What to ALWAYS Do
- Add new context or value
- Reference previous touchpoint
- Offer alternative path (trial, defer, different contact)
- Keep it short
- Clear next step
- Permission to close loop (on final touch)
`;

// ============================================
// AI MESSAGE GENERATION
// ============================================

export async function generateFollowUpMessage(
  context: FollowUpContext
): Promise<GeneratedFollowUp> {
  const startTime = Date.now();

  // Determine tone based on touch number
  const tone = TONE_BY_TOUCH[Math.min(context.touch_number, 4)] || 'light_bump';

  console.log('🔄 Generating follow-up:', {
    prospect: `${context.prospect.first_name} ${context.prospect.last_name}`,
    scenario: context.scenario,
    touch: context.touch_number,
    channel: context.channel,
    tone
  });

  const systemPrompt = buildSystemPrompt(context, tone);
  const userPrompt = buildUserPrompt(context, tone);

  const response = await claudeClient.chat({
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    max_tokens: 500,
    temperature: 0.7
  });

  const generationTime = Date.now() - startTime;
  const parsed = parseAIResponse(response.content, context.channel);

  // Calculate next follow-up timing
  const cadence = SCENARIO_CADENCES[context.scenario];
  const nextDays = context.touch_number < cadence.maxTouches
    ? cadence.days[context.touch_number]
    : undefined;

  console.log('✅ Follow-up generated:', {
    length: parsed.message.length,
    tone,
    nextDays,
    time_ms: generationTime
  });

  return {
    message: parsed.message,
    subject: parsed.subject,
    tone,
    channel: context.channel,
    confidence_score: calculateConfidence(context, tone),
    reasoning: parsed.reasoning || `Touch ${context.touch_number} - ${tone} follow-up`,
    next_follow_up_days: nextDays,
    metadata: {
      model: 'claude-3.5-sonnet',
      tokens_used: response.usage?.total_tokens || 0,
      generation_time_ms: generationTime,
      scenario: context.scenario,
      touch_number: context.touch_number
    }
  };
}

function buildSystemPrompt(context: FollowUpContext, tone: FollowUpTone): string {
  const prospect = context.prospect;
  const channelGuidance = getChannelGuidance(context.channel);
  const scenarioGuidance = getScenarioGuidance(context.scenario);
  const toneGuidance = getToneGuidance(tone, context.touch_number);

  return `You are SAM, a B2B sales assistant generating a follow-up message.

${FOLLOW_UP_TRAINING}

## This Follow-Up Context

**Prospect:** ${prospect.first_name} ${prospect.last_name}
${prospect.title ? `**Title:** ${prospect.title}` : ''}
${prospect.company_name ? `**Company:** ${prospect.company_name}` : ''}
${prospect.industry ? `**Industry:** ${prospect.industry}` : ''}

**Scenario:** ${context.scenario.replace(/_/g, ' ')}
**Touch Number:** ${context.touch_number} of ${context.max_touches}
**Days Since Last Contact:** ${context.days_since_last_contact}
**Channel:** ${context.channel}

${scenarioGuidance}

${channelGuidance}

${toneGuidance}

## Previous Messages in This Sequence
${context.previous_follow_ups?.length
  ? context.previous_follow_ups.map((m, i) => `Touch ${i + 1}: "${m}"`).join('\n')
  : 'None yet - this is the first follow-up'}

## Conversation History
${formatConversationHistory(context.conversation_history)}

## Output Format
Return your response in this exact format:
${context.channel === 'email' ? 'SUBJECT: [subject line]\n' : ''}MESSAGE: [your follow-up message]
REASONING: [brief explanation of your approach]

## Critical Rules
- Keep it SHORT (${context.channel === 'linkedin' ? '1-3 sentences' : 'under 75 words'})
- DO NOT repeat previous follow-up messages
- Reference something specific if possible
- Make the next step crystal clear
- ${tone === 'breakup' ? 'This is the FINAL message - close gracefully, leave door open' : ''}`;
}

function buildUserPrompt(context: FollowUpContext, tone: FollowUpTone): string {
  return `Generate a ${tone.replace(/_/g, ' ')} follow-up for ${context.prospect.first_name} from ${context.prospect.company_name || 'their company'}.

This is touch ${context.touch_number} of ${context.max_touches}. It's been ${context.days_since_last_contact} days since last contact.

${context.scenario === 'check_back_later' && context.check_back_date
  ? `They asked to check back on ${context.check_back_date}.`
  : ''}

${context.conversation_history.last_topic_discussed
  ? `Last topic discussed: ${context.conversation_history.last_topic_discussed}`
  : ''}

Generate the follow-up message now:`;
}

function getChannelGuidance(channel: FollowUpChannel): string {
  switch (channel) {
    case 'linkedin':
      return `## LinkedIn DM Guidelines
- Tone: Conversational, casual
- Length: 1-3 sentences MAX
- Greeting: Optional ("Hey [Name]" or jump straight in)
- No bullets or heavy formatting
- Links: Use sparingly`;

    case 'email':
      return `## Email Guidelines
- Subject: Keep thread (Re: original) or short/curious (max 6 words)
- Tone: Slightly more formal than LinkedIn
- Length: Under 75 words
- Light formatting OK
- Must reference previous conversation`;

    case 'inmail':
      return `## InMail Guidelines
- Tone: Professional
- Length: Under 150 words
- Use sparingly — expensive credits
- More formal than regular LinkedIn DM`;
  }
}

function getScenarioGuidance(scenario: FollowUpScenario): string {
  const guidance: Record<FollowUpScenario, string> = {
    no_reply_to_cr: `## Scenario: No Reply to Connection Request
They accepted the connection but never replied to your note.
- Touch 1: Thank them for connecting, brief restate of value
- Touch 2: Observation about their profile/company
- Touch 3: Offer alternative (free trial)
- Touch 4: Close the loop gracefully`,

    replied_then_silent: `## Scenario: Replied Then Went Silent
They showed interest but stopped responding. HIGHER PRIORITY.
- Reference what they asked about or discussed
- Touch 1: Pick up where you left off
- Touch 2: Offer to close the loop
- Touch 3: Final permission to close`,

    no_show_to_call: `## Scenario: No-Show to Booked Call
They booked but didn't show. Assume good intent — things happen.
- NO guilt or "I waited for you"
- Touch 1 (same day): Quick reschedule offer
- Touch 2: Another gentle reschedule
- Touch 3: Offer trial as alternative to call`,

    post_demo_silence: `## Scenario: Post-Demo Silence
They attended demo but haven't responded.
- Reference specific things from the demo
- Touch 1: Ask about questions on what you covered
- Touch 2: Check if specific feature makes sense
- Touch 3: Final check — moving forward or timing off?`,

    check_back_later: `## Scenario: "Check Back Later"
They explicitly said to follow up at a later time.
- HONOR their timeline exactly
- Touch 1: "You mentioned checking back [timeframe]"
- Touch 2: Brief follow-up if no response`,

    trial_no_activity: `## Scenario: Trial Signup, No Activity
They signed up but haven't used the product.
- Touch 1: Offer help getting started
- Touch 2: Quick tip on where to start
- Touch 3: Offer call to ensure value`,

    standard: `## Standard Follow-Up
Default sequence for general follow-ups.
- Touch 1: Light bump, check if still relevant
- Touch 2: Add value or new context
- Touch 3: Try different angle
- Touch 4: Close the loop`
  };

  return guidance[scenario];
}

function getToneGuidance(tone: FollowUpTone, touchNumber: number): string {
  const guidance: Record<FollowUpTone, string> = {
    light_bump: `## Tone: Light Bump (Touch ${touchNumber})
- Simple reminder without pressure
- Acknowledge they may have missed it
- Templates: "Wanted to make sure this didn't get buried", "Quick follow-up"
- Keep extremely short`,

    value_add: `## Tone: Value Add (Touch ${touchNumber})
- Provide NEW value that justifies the follow-up
- Reference something relevant to them
- Options: industry news, case study, tip, observation
- Still keep it short`,

    different_angle: `## Tone: Different Angle (Touch ${touchNumber})
- Try completely different approach
- Offer alternative paths: trial, defer timing, different contact
- "Different approach — instead of a call, want to just try it?"
- Ask about timing or decision maker`,

    breakup: `## Tone: Breakup (Touch ${touchNumber})
- FINAL message — close gracefully
- No pressure, leave door open
- "Last ping on this", "Closing the loop"
- Don't ask for anything — just close cleanly`
  };

  return guidance[tone];
}

function formatConversationHistory(history: ConversationHistory): string {
  const parts = [];

  if (history.initial_outreach) {
    parts.push(`Initial outreach: "${history.initial_outreach.substring(0, 150)}..."`);
  }

  if (history.their_replies?.length) {
    parts.push(`Their replies: ${history.their_replies.map(r => `"${r.substring(0, 100)}..."`).join(', ')}`);
  }

  if (history.last_topic_discussed) {
    parts.push(`Last topic: ${history.last_topic_discussed}`);
  }

  if (history.questions_asked?.length) {
    parts.push(`Questions they asked: ${history.questions_asked.join(', ')}`);
  }

  if (history.objections_raised?.length) {
    parts.push(`Objections: ${history.objections_raised.join(', ')}`);
  }

  if (history.demo_notes) {
    parts.push(`Demo notes: ${history.demo_notes}`);
  }

  return parts.length ? parts.join('\n') : 'No conversation history available';
}

function parseAIResponse(content: string, channel: FollowUpChannel): {
  message: string;
  subject?: string;
  reasoning?: string;
} {
  let subject: string | undefined;
  let message = content;
  let reasoning: string | undefined;

  // Extract subject for email
  if (channel === 'email') {
    const subjectMatch = content.match(/SUBJECT:\s*(.+?)(?:\n|MESSAGE:)/i);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
    }
  }

  // Extract message
  const messageMatch = content.match(/MESSAGE:\s*([\s\S]+?)(?:REASONING:|$)/i);
  if (messageMatch) {
    message = messageMatch[1].trim();
  }

  // Extract reasoning
  const reasoningMatch = content.match(/REASONING:\s*([\s\S]+)$/i);
  if (reasoningMatch) {
    reasoning = reasoningMatch[1].trim();
  }

  // Clean up message
  message = message
    .replace(/^MESSAGE:\s*/i, '')
    .replace(/REASONING:[\s\S]*$/i, '')
    .trim();

  return { message, subject, reasoning };
}

function calculateConfidence(context: FollowUpContext, tone: FollowUpTone): number {
  let score = 0.7;

  // Higher confidence if we have conversation history
  if (context.conversation_history.their_replies?.length) {
    score += 0.1;
  }

  // Higher confidence for earlier touches
  if (context.touch_number <= 2) {
    score += 0.1;
  }

  // Lower confidence for breakup messages
  if (tone === 'breakup') {
    score -= 0.1;
  }

  // Higher confidence for high-priority scenarios
  if (['replied_then_silent', 'no_show_to_call'].includes(context.scenario)) {
    score += 0.05;
  }

  return Math.max(0.4, Math.min(1.0, score));
}

// ============================================
// HITL APPROVAL WORKFLOW
// ============================================

export async function createFollowUpDraft(
  context: FollowUpContext,
  generated: GeneratedFollowUp
): Promise<FollowUpDraft> {
  const draft: Partial<FollowUpDraft> = {
    prospect_id: context.prospect.id,
    campaign_id: context.campaign.id,
    workspace_id: context.campaign.workspace_id,
    message: generated.message,
    subject: generated.subject,
    channel: generated.channel,
    tone: generated.tone,
    touch_number: context.touch_number,
    scenario: context.scenario,
    status: 'pending_approval',
    confidence_score: generated.confidence_score,
    reasoning: generated.reasoning,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('follow_up_drafts')
    .insert(draft)
    .select()
    .single();

  if (error) {
    console.error('Failed to create follow-up draft:', error);
    throw error;
  }

  console.log('📝 Created follow-up draft:', data.id);
  return data as FollowUpDraft;
}

export async function approveFollowUpDraft(
  draftId: string,
  approvedBy: string,
  scheduledFor?: Date
): Promise<FollowUpDraft> {
  const { data, error } = await supabase
    .from('follow_up_drafts')
    .update({
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      scheduled_for: scheduledFor?.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', draftId)
    .select()
    .single();

  if (error) throw error;

  console.log('✅ Follow-up draft approved:', draftId);
  return data as FollowUpDraft;
}

export async function rejectFollowUpDraft(
  draftId: string,
  reason: string
): Promise<FollowUpDraft> {
  const { data, error } = await supabase
    .from('follow_up_drafts')
    .update({
      status: 'rejected',
      rejected_reason: reason,
      updated_at: new Date().toISOString()
    })
    .eq('id', draftId)
    .select()
    .single();

  if (error) throw error;

  console.log('❌ Follow-up draft rejected:', draftId, reason);
  return data as FollowUpDraft;
}

export async function editAndApproveFollowUpDraft(
  draftId: string,
  newMessage: string,
  newSubject: string | undefined,
  approvedBy: string,
  scheduledFor?: Date
): Promise<FollowUpDraft> {
  const { data, error } = await supabase
    .from('follow_up_drafts')
    .update({
      message: newMessage,
      subject: newSubject,
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      scheduled_for: scheduledFor?.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', draftId)
    .select()
    .single();

  if (error) throw error;

  console.log('✏️ Follow-up draft edited and approved:', draftId);
  return data as FollowUpDraft;
}

// ============================================
// SCENARIO DETECTION
// ============================================

export function detectScenario(prospect: {
  status: string;
  responded_at?: string;
  connection_accepted_at?: string;
  meeting_scheduled_at?: string;
  demo_completed_at?: string;
  check_back_date?: string;
  trial_started_at?: string;
  trial_last_activity_at?: string;
}): FollowUpScenario {
  // No-show to call
  if (prospect.meeting_scheduled_at && !prospect.demo_completed_at) {
    const meetingDate = new Date(prospect.meeting_scheduled_at);
    if (meetingDate < new Date()) {
      return 'no_show_to_call';
    }
  }

  // Post-demo silence
  if (prospect.demo_completed_at && !prospect.responded_at) {
    return 'post_demo_silence';
  }

  // Check back later
  if (prospect.check_back_date) {
    return 'check_back_later';
  }

  // Trial no activity
  if (prospect.trial_started_at && !prospect.trial_last_activity_at) {
    return 'trial_no_activity';
  }

  // Replied then silent
  if (prospect.responded_at) {
    return 'replied_then_silent';
  }

  // Accepted CR but no reply
  if (prospect.connection_accepted_at && !prospect.responded_at) {
    return 'no_reply_to_cr';
  }

  return 'standard';
}

// ============================================
// MULTI-CHANNEL SUPPORT
// ============================================

export function determineChannel(prospect: ProspectContext, touchNumber: number, originalChannel: FollowUpChannel): FollowUpChannel {
  // If we have email and LinkedIn is not responding, try email on touch 3
  if (touchNumber >= 3 && prospect.email && originalChannel === 'linkedin') {
    return 'email';
  }

  // If we have LinkedIn and email is not responding, try LinkedIn on touch 3
  if (touchNumber >= 3 && prospect.linkedin_url && originalChannel === 'email') {
    return 'linkedin';
  }

  return originalChannel;
}

export function getCrossChannelPrefix(currentChannel: FollowUpChannel, previousChannel: FollowUpChannel): string {
  if (currentChannel === previousChannel) return '';

  if (currentChannel === 'email' && previousChannel === 'linkedin') {
    return 'Also sent you a note on LinkedIn — trying both channels in case one works better. ';
  }

  if (currentChannel === 'linkedin' && previousChannel === 'email') {
    return 'Sent you an email last week — figured I\'d try here in case it got buried. ';
  }

  return '';
}

// ============================================
// TIMING HELPERS
// ============================================

export function calculateNextFollowUpDate(
  scenario: FollowUpScenario,
  currentTouch: number,
  checkBackDate?: string
): Date | null {
  const cadence = SCENARIO_CADENCES[scenario];

  if (currentTouch >= cadence.maxTouches) {
    return null; // Sequence complete
  }

  // For check_back_later, use the specified date for first touch
  if (scenario === 'check_back_later' && currentTouch === 0 && checkBackDate) {
    return new Date(checkBackDate);
  }

  const daysUntilNext = cadence.days[currentTouch];
  if (daysUntilNext === undefined) {
    return null;
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + daysUntilNext);

  // Skip weekends
  const day = nextDate.getDay();
  if (day === 0) nextDate.setDate(nextDate.getDate() + 1); // Sunday -> Monday
  if (day === 6) nextDate.setDate(nextDate.getDate() + 2); // Saturday -> Monday

  return nextDate;
}

export function isOptimalSendTime(timezone: string = 'America/New_York'): boolean {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    hour: 'numeric',
    weekday: 'short'
  };
  const formatted = new Intl.DateTimeFormat('en-US', options).formatToParts(now);

  const hour = parseInt(formatted.find(p => p.type === 'hour')?.value || '0');
  const weekday = formatted.find(p => p.type === 'weekday')?.value || '';

  // Skip weekends
  if (['Sat', 'Sun'].includes(weekday)) return false;

  // Best times: 9-11 AM Tue-Thu, after 10 AM Mon, before 2 PM Fri
  if (weekday === 'Mon' && hour < 10) return false;
  if (weekday === 'Fri' && hour >= 14) return false;
  if (hour < 9 || hour >= 17) return false;

  return true;
}

// ============================================
// BATCH PROCESSING
// ============================================

export async function batchGenerateFollowUps(
  contexts: FollowUpContext[]
): Promise<Array<{ context: FollowUpContext; result?: GeneratedFollowUp; error?: string }>> {
  const results = [];

  for (const context of contexts) {
    try {
      const result = await generateFollowUpMessage(context);
      results.push({ context, result });
    } catch (error) {
      results.push({
        context,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

// ============================================
// LIFECYCLE MANAGEMENT
// ============================================

export function shouldArchive(prospect: {
  touch_number: number;
  max_touches: number;
  status: string;
  do_not_contact?: boolean;
  unsubscribed?: boolean;
}): { archive: boolean; reason?: string } {
  if (prospect.do_not_contact || prospect.unsubscribed) {
    return { archive: true, reason: 'do_not_contact' };
  }

  if (prospect.status === 'hostile_response') {
    return { archive: true, reason: 'hostile_response' };
  }

  if (prospect.touch_number >= prospect.max_touches) {
    return { archive: true, reason: 'max_touches_reached' };
  }

  return { archive: false };
}

export function shouldNurture(prospect: {
  status: string;
  objections?: string[];
}): { nurture: boolean; nextTouchDays?: number } {
  // Using competitor -> 90 day nurture
  if (prospect.objections?.includes('using_competitor')) {
    return { nurture: true, nextTouchDays: 90 };
  }

  // Budget constraints -> 90 day nurture
  if (prospect.objections?.includes('budget')) {
    return { nurture: true, nextTouchDays: 90 };
  }

  // Pre-launch -> nurture until launch
  if (prospect.status === 'pre_launch') {
    return { nurture: true, nextTouchDays: 60 };
  }

  return { nurture: false };
}
