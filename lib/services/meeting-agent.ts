/**
 * Meeting Agent Service
 * Full lifecycle management: booking, reminders, no-show handling, follow-ups
 *
 * Created: December 16, 2025
 */

import { createClient } from '@supabase/supabase-js';
import { claudeClient } from '@/lib/llm/claude-client';

// ============================================
// TYPES
// ============================================

export interface BookingLink {
  url: string;
  platform: 'calendly' | 'cal.com' | 'hubspot' | 'google' | 'microsoft' | 'unknown';
  slug: string;        // e.g., "john/30min"
  eventType?: string;  // e.g., "30min", "discovery-call"
}

export interface AvailableSlot {
  start: Date;
  end: Date;
  duration_minutes: number;
  timezone: string;
}

export interface MeetingContext {
  meeting_id: string;
  prospect: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    company_name?: string;
    title?: string;
    linkedin_url?: string;
  };
  workspace_id: string;
  meeting: {
    scheduled_at: Date;
    duration_minutes: number;
    title?: string;
    meeting_link?: string;
    status: string;
  };
  conversation_history?: {
    last_message?: string;
    our_last_reply?: string;
  };
}

export interface MeetingFollowUp {
  type: 'no_show' | 'cancelled' | 'post_meeting' | 'reschedule' | 'reminder';
  subject: string;
  message: string;
  channel: 'email' | 'linkedin';
  tone: 'warm' | 'professional' | 'urgent' | 'apologetic';
  confidence_score: number;
  metadata: {
    model: string;
    tokens_used: number;
    generation_time_ms: number;
  };
}

// ============================================
// BOOKING LINK DETECTION
// ============================================

const BOOKING_PATTERNS: Record<string, RegExp> = {
  calendly: /calendly\.com\/([^\/\s]+\/[^\/\s?]+)/i,
  'cal.com': /cal\.com\/([^\/\s]+\/[^\/\s?]+)/i,
  hubspot: /meetings\.hubspot\.com\/([^\/\s?]+)/i,
  google: /calendar\.google\.com\/calendar\/appointments\/([^\/\s?]+)/i,
  microsoft: /outlook\.office365\.com\/owa\/calendar\/([^\/\s?]+)/i,
};

/**
 * Detect booking links in a message
 */
export function detectBookingLinks(message: string): BookingLink[] {
  const links: BookingLink[] = [];

  for (const [platform, pattern] of Object.entries(BOOKING_PATTERNS)) {
    const match = message.match(pattern);
    if (match) {
      // Get full URL
      const urlPattern = new RegExp(`https?://[^\\s]*${pattern.source}`, 'i');
      const urlMatch = message.match(urlPattern);

      links.push({
        url: urlMatch ? urlMatch[0] : `https://${platform === 'calendly' ? 'calendly.com' : platform}/${match[1]}`,
        platform: platform as BookingLink['platform'],
        slug: match[1],
        eventType: match[1].split('/')[1] || undefined,
      });
    }
  }

  return links;
}

/**
 * Check if message contains meeting intent (without explicit link)
 */
export function detectMeetingIntent(message: string): boolean {
  const intentPatterns = [
    /let'?s\s+(schedule|book|set\s+up)\s+(a\s+)?(call|meeting|chat)/i,
    /can\s+we\s+(schedule|book|hop\s+on)\s+(a\s+)?(call|meeting)/i,
    /want\s+to\s+(schedule|book|set\s+up)\s+(a\s+)?(call|meeting)/i,
    /how\s+about\s+(next|this)\s+(week|monday|tuesday|wednesday|thursday|friday)/i,
    /are\s+you\s+(free|available)\s+(on|next|this)/i,
    /pick\s+a\s+time/i,
    /when\s+(works|are\s+you\s+free)/i,
    /grab\s+(a\s+)?(quick\s+)?(call|coffee|chat)/i,
  ];

  return intentPatterns.some(pattern => pattern.test(message));
}

// ============================================
// MEETING CREATION & BOOKING
// ============================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Create a meeting record when booking is detected
 */
export async function createMeeting(params: {
  prospect_id: string;
  workspace_id: string;
  campaign_id?: string;
  booking_url: string;
  booking_platform: string;
  scheduled_at: Date;
  duration_minutes?: number;
  meeting_link?: string;
  our_attendee_email?: string;
  our_attendee_name?: string;
}): Promise<{ meeting_id: string; reminders_scheduled: number }> {
  const { data: prospect } = await supabase
    .from('campaign_prospects')
    .select('first_name, last_name, email')
    .eq('id', params.prospect_id)
    .single();

  // Create meeting
  const { data: meeting, error } = await supabase
    .from('meetings')
    .insert({
      prospect_id: params.prospect_id,
      workspace_id: params.workspace_id,
      campaign_id: params.campaign_id,
      booking_url: params.booking_url,
      booking_platform: params.booking_platform,
      scheduled_at: params.scheduled_at.toISOString(),
      duration_minutes: params.duration_minutes || 30,
      meeting_link: params.meeting_link,
      title: `Call with ${prospect?.first_name || 'Prospect'} ${prospect?.last_name || ''}`.trim(),
      our_attendee_email: params.our_attendee_email,
      our_attendee_name: params.our_attendee_name,
      prospect_email: prospect?.email,
      prospect_name: `${prospect?.first_name || ''} ${prospect?.last_name || ''}`.trim(),
      status: 'scheduled',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create meeting: ${error.message}`);

  // Schedule reminders
  const reminders = await scheduleMeetingReminders(meeting.id, params.workspace_id, params.scheduled_at);

  // Update prospect with meeting info
  await supabase
    .from('campaign_prospects')
    .update({
      meeting_id: meeting.id,
      meeting_scheduled_at: params.scheduled_at.toISOString(),
      meeting_status: 'scheduled',
      status: 'meeting_scheduled',
      follow_up_due_at: null, // Stop follow-ups while meeting is scheduled
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.prospect_id);

  console.log(`📅 Meeting created: ${meeting.id} for ${params.scheduled_at.toISOString()}`);

  return {
    meeting_id: meeting.id,
    reminders_scheduled: reminders,
  };
}

/**
 * Schedule meeting reminders (24h, 1h, 15m before)
 */
async function scheduleMeetingReminders(
  meeting_id: string,
  workspace_id: string,
  scheduled_at: Date
): Promise<number> {
  const reminders = [
    { type: '24h', offset_hours: 24 },
    { type: '1h', offset_hours: 1 },
    { type: '15m', offset_hours: 0.25 },
  ];

  const now = new Date();
  const toInsert = [];

  for (const reminder of reminders) {
    const reminderTime = new Date(scheduled_at.getTime() - reminder.offset_hours * 60 * 60 * 1000);

    // Only schedule if in the future
    if (reminderTime > now) {
      toInsert.push({
        meeting_id,
        workspace_id,
        reminder_type: reminder.type,
        scheduled_for: reminderTime.toISOString(),
        status: 'pending',
        channel: 'email',
      });
    }
  }

  if (toInsert.length > 0) {
    await supabase.from('meeting_reminders').insert(toInsert);
  }

  return toInsert.length;
}

// ============================================
// MEETING STATUS MANAGEMENT
// ============================================

/**
 * Update meeting status
 */
export async function updateMeetingStatus(
  meeting_id: string,
  status: 'confirmed' | 'cancelled' | 'no_show' | 'completed' | 'rescheduled',
  details?: {
    cancelled_by?: 'prospect' | 'us' | 'system';
    cancellation_reason?: string;
    outcome?: string;
    notes?: string;
    rescheduled_to?: string;
  }
): Promise<void> {
  const update: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };

  switch (status) {
    case 'confirmed':
      update.confirmed_at = new Date().toISOString();
      break;
    case 'cancelled':
      update.cancelled_at = new Date().toISOString();
      update.cancelled_by = details?.cancelled_by;
      update.cancellation_reason = details?.cancellation_reason;
      break;
    case 'no_show':
      update.no_show_detected_at = new Date().toISOString();
      break;
    case 'completed':
      update.completed_at = new Date().toISOString();
      update.outcome = details?.outcome;
      update.notes = details?.notes;
      break;
    case 'rescheduled':
      update.rescheduled_to = details?.rescheduled_to;
      break;
  }

  await supabase
    .from('meetings')
    .update(update)
    .eq('id', meeting_id);

  // Cancel pending reminders if meeting is cancelled/no-show
  if (['cancelled', 'no_show', 'rescheduled'].includes(status)) {
    await supabase
      .from('meeting_reminders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('meeting_id', meeting_id)
      .eq('status', 'pending');
  }

  // Update prospect status
  const { data: meeting } = await supabase
    .from('meetings')
    .select('prospect_id')
    .eq('id', meeting_id)
    .single();

  if (meeting) {
    await supabase
      .from('campaign_prospects')
      .update({
        meeting_status: status,
        status: status === 'completed' ? 'meeting_completed' :
                status === 'cancelled' ? 'meeting_cancelled' :
                status === 'no_show' ? 'no_show' : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', meeting.prospect_id);
  }

  console.log(`📊 Meeting ${meeting_id} status updated to: ${status}`);
}

/**
 * Detect no-shows (meetings past scheduled time with no completion)
 */
export async function detectNoShows(): Promise<string[]> {
  const bufferMinutes = 15; // Wait 15 minutes past meeting time
  const cutoffTime = new Date(Date.now() - bufferMinutes * 60 * 1000);

  const { data: noShows } = await supabase
    .from('meetings')
    .select('id, prospect_id, scheduled_at')
    .in('status', ['scheduled', 'confirmed'])
    .lt('scheduled_at', cutoffTime.toISOString())
    .is('no_show_detected_at', null);

  const noShowIds: string[] = [];

  for (const meeting of noShows || []) {
    await updateMeetingStatus(meeting.id, 'no_show');
    noShowIds.push(meeting.id);
    console.log(`⚠️ No-show detected: Meeting ${meeting.id}`);
  }

  return noShowIds;
}

// ============================================
// AI MESSAGE GENERATION
// ============================================

/**
 * Generate AI-powered meeting follow-up message
 */
export async function generateMeetingFollowUp(
  context: MeetingContext,
  followUpType: 'no_show' | 'cancelled' | 'post_meeting' | 'reschedule'
): Promise<MeetingFollowUp> {
  const startTime = Date.now();

  const systemPrompt = buildMeetingFollowUpPrompt(context, followUpType);
  const userPrompt = `Generate a ${followUpType.replace('_', ' ')} follow-up message for ${context.prospect.first_name} ${context.prospect.last_name}${context.prospect.company_name ? ` from ${context.prospect.company_name}` : ''}.`;

  const response = await claudeClient.chat({
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    max_tokens: 400,
    temperature: 0.7,
  });

  const fullMessage = response.content;
  const { subject, message } = extractSubjectAndBody(fullMessage);

  const generationTime = Date.now() - startTime;

  return {
    type: followUpType,
    subject,
    message,
    channel: context.prospect.email ? 'email' : 'linkedin',
    tone: getToneForFollowUpType(followUpType),
    confidence_score: 0.85,
    metadata: {
      model: 'claude-sonnet-4-20250514',
      tokens_used: response.usage.total_tokens,
      generation_time_ms: generationTime,
    },
  };
}

function buildMeetingFollowUpPrompt(
  context: MeetingContext,
  followUpType: 'no_show' | 'cancelled' | 'post_meeting' | 'reschedule'
): string {
  const baseContext = `You are SAM, an AI sales assistant. Generate a follow-up message for a meeting scenario.

## Prospect
- Name: ${context.prospect.first_name} ${context.prospect.last_name}
- Company: ${context.prospect.company_name || 'Unknown'}
- Title: ${context.prospect.title || 'Unknown'}

## Meeting Details
- Originally scheduled: ${context.meeting.scheduled_at}
- Duration: ${context.meeting.duration_minutes} minutes
- Status: ${context.meeting.status}
`;

  const typeInstructions: Record<string, string> = {
    no_show: `
## Scenario: No-Show
The prospect didn't join the scheduled meeting.

## Guidelines:
- Be understanding, not accusatory (things happen!)
- Acknowledge they might have had a conflict
- Offer to reschedule with easy options
- Keep it brief and low-pressure
- Don't make them feel guilty

## Tone: Warm and understanding

## Format:
Subject: [Brief, non-judgmental subject - 5 words max]
Body: 3-4 sentences max`,

    cancelled: `
## Scenario: Cancellation
The prospect cancelled the meeting.

## Guidelines:
- Thank them for letting you know (if they did)
- Be completely understanding
- Offer to reschedule when convenient
- Leave the door open
- No pressure

## Tone: Professional and accommodating

## Format:
Subject: [Brief subject - 5 words max]
Body: 2-3 sentences max`,

    post_meeting: `
## Scenario: Post-Meeting Follow-up
The meeting was completed successfully.

## Guidelines:
- Thank them for their time
- Briefly recap key points discussed
- Confirm any next steps agreed upon
- Make it easy to move forward
- Be warm but professional

## Tone: Warm and action-oriented

## Format:
Subject: [Reference the meeting - 5 words max]
Body: 4-5 sentences max`,

    reschedule: `
## Scenario: Reschedule Request
We need to offer new meeting times.

## Guidelines:
- Apologize briefly if we initiated
- Offer 2-3 specific alternative times
- Make it easy to pick a new slot
- Keep momentum going

## Tone: Professional and efficient

## Format:
Subject: [Brief subject - 5 words max]
Body: 3-4 sentences with time options`,
  };

  return baseContext + typeInstructions[followUpType] + `

## Rules:
- Keep it SHORT
- Be genuine, not salesy
- Return in format: Subject: [subject]\\n\\n[body]`;
}

function getToneForFollowUpType(type: string): 'warm' | 'professional' | 'urgent' | 'apologetic' {
  switch (type) {
    case 'no_show':
      return 'warm';
    case 'cancelled':
      return 'professional';
    case 'post_meeting':
      return 'warm';
    case 'reschedule':
      return 'apologetic';
    default:
      return 'professional';
  }
}

function extractSubjectAndBody(fullMessage: string): { subject: string; message: string } {
  const subjectMatch = fullMessage.match(/Subject:\s*(.+?)(?:\n|$)/i);
  let subject = subjectMatch ? subjectMatch[1].trim() : 'Following up on our meeting';

  let message = fullMessage.replace(/Subject:\s*.+?(?:\n|$)/i, '').trim();
  message = message.replace(/^[\n\r]+/, '').trim();

  return { subject, message };
}

// ============================================
// FOLLOW-UP DRAFT CREATION
// ============================================

/**
 * Create a meeting follow-up draft for HITL approval
 */
export async function createMeetingFollowUpDraft(
  context: MeetingContext,
  followUp: MeetingFollowUp
): Promise<{ draft_id: string }> {
  // Generate approval token
  const approvalToken = `mfu_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const { data: draft, error } = await supabase
    .from('meeting_follow_up_drafts')
    .insert({
      meeting_id: context.meeting_id,
      prospect_id: context.prospect.id,
      workspace_id: context.workspace_id,
      follow_up_type: followUp.type,
      subject: followUp.subject,
      message: followUp.message,
      channel: followUp.channel,
      status: 'pending_approval',
      approval_token: approvalToken,
      ai_model: followUp.metadata.model,
      ai_tokens_used: followUp.metadata.tokens_used,
      generation_time_ms: followUp.metadata.generation_time_ms,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create follow-up draft: ${error.message}`);

  console.log(`📝 Meeting follow-up draft created: ${draft.id} (${followUp.type})`);

  return { draft_id: draft.id };
}

// ============================================
// REMINDER MESSAGE GENERATION
// ============================================

/**
 * Generate meeting reminder message
 */
export async function generateReminderMessage(
  context: MeetingContext,
  reminderType: '24h' | '1h' | '15m'
): Promise<{ subject: string; message: string }> {
  const meetingTime = new Date(context.meeting.scheduled_at);
  const formattedTime = meetingTime.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const timeframeText: Record<string, string> = {
    '24h': 'tomorrow',
    '1h': 'in 1 hour',
    '15m': 'in 15 minutes',
  };

  const subject = reminderType === '24h'
    ? `Reminder: Our call tomorrow`
    : reminderType === '1h'
    ? `Our call starts in 1 hour`
    : `Starting in 15 minutes`;

  const message = `Hi ${context.prospect.first_name},

Just a friendly reminder about our call ${timeframeText[reminderType]}:

📅 ${formattedTime}
${context.meeting.meeting_link ? `🔗 Join here: ${context.meeting.meeting_link}` : ''}

Looking forward to speaking with you!

Best,
${context.meeting.title?.split(' with ')[0] || 'The Team'}`;

  return { subject, message };
}

// ============================================
// EXPORTS
// ============================================

export default {
  detectBookingLinks,
  detectMeetingIntent,
  createMeeting,
  updateMeetingStatus,
  detectNoShows,
  generateMeetingFollowUp,
  createMeetingFollowUpDraft,
  generateReminderMessage,
};
