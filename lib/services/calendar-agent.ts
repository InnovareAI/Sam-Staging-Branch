/**
 * Calendar Agent Service
 * Handles:
 * 1. Detecting prospect calendar links in messages
 * 2. Checking our availability when prospect sends their calendar
 * 3. Triggering follow-up agent when no booking detected
 *
 * Created: December 20, 2025
 */

import { createClient } from '@supabase/supabase-js';

// ============================================
// TYPES
// ============================================

export interface DetectedCalendarLink {
  url: string;
  platform: 'calendly' | 'cal.com' | 'hubspot' | 'acuity' | 'google' | 'microsoft' | 'unknown';
  rawMatch: string;
}

export interface CalendarAvailability {
  hasSlots: boolean;
  nextAvailable?: Date;
  suggestedSlots: Array<{
    start: Date;
    end: Date;
  }>;
}

// ============================================
// CALENDAR LINK PATTERNS
// ============================================

const CALENDAR_LINK_PATTERNS: Array<{
  platform: DetectedCalendarLink['platform'];
  pattern: RegExp;
}> = [
  {
    platform: 'calendly',
    pattern: /https?:\/\/(?:www\.)?calendly\.com\/([^\s"<>\)]+)/gi,
  },
  {
    platform: 'cal.com',
    pattern: /https?:\/\/(?:www\.)?cal\.com\/([^\s"<>\)]+)/gi,
  },
  {
    platform: 'hubspot',
    pattern: /https?:\/\/(?:meetings\.)?hubspot\.com\/meetings\/([^\s"<>\)]+)/gi,
  },
  {
    platform: 'acuity',
    pattern: /https?:\/\/(?:www\.)?acuityscheduling\.com\/([^\s"<>\)]+)/gi,
  },
  {
    platform: 'google',
    pattern: /https?:\/\/calendar\.google\.com\/calendar\/appointments\/([^\s"<>\)]+)/gi,
  },
  {
    platform: 'microsoft',
    pattern: /https?:\/\/outlook\.office365\.com\/owa\/calendar\/([^\s"<>\)]+)/gi,
  },
  {
    platform: 'microsoft',
    pattern: /https?:\/\/outlook\.office\.com\/bookwithme\/([^\s"<>\)]+)/gi,
  },
];

// ============================================
// CALENDAR LINK DETECTION
// ============================================

/**
 * Detect calendar booking links in a message
 * Returns all detected links with their platforms
 */
export function detectCalendarLinks(message: string): DetectedCalendarLink[] {
  const links: DetectedCalendarLink[] = [];
  const seenUrls = new Set<string>();

  for (const { platform, pattern } of CALENDAR_LINK_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(message)) !== null) {
      const url = match[0].replace(/[.,;:!?'")\]}>]+$/, ''); // Clean trailing punctuation

      // Deduplicate
      if (!seenUrls.has(url.toLowerCase())) {
        seenUrls.add(url.toLowerCase());
        links.push({
          url,
          platform,
          rawMatch: match[0],
        });
      }
    }
  }

  return links;
}

/**
 * Check if a message contains any calendar link
 */
export function hasCalendarLink(message: string): boolean {
  return detectCalendarLinks(message).length > 0;
}

// ============================================
// PROSPECT CALENDAR LINK HANDLING
// ============================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Store detected prospect calendar link and update conversation stage
 * Called when we detect a prospect's calendar link in their message
 */
export async function handleProspectCalendarLink(
  prospectId: string,
  calendarLink: DetectedCalendarLink
): Promise<void> {
  console.log(`Calendar link detected from prospect ${prospectId}: ${calendarLink.url}`);

  await supabase
    .from('campaign_prospects')
    .update({
      prospect_calendar_link: calendarLink.url,
      conversation_stage: 'prospect_shared_calendar',
      updated_at: new Date().toISOString(),
    })
    .eq('id', prospectId);

  // TODO: Trigger calendar availability check to auto-respond with our available times
  // This will be done via a cron job that checks for prospects with stage='prospect_shared_calendar'
}

/**
 * Update reply_agent_drafts with detected prospect calendar link
 */
export async function updateDraftWithProspectCalendarLink(
  draftId: string,
  calendarLink: string
): Promise<void> {
  await supabase
    .from('reply_agent_drafts')
    .update({
      prospect_sent_calendar_link: calendarLink,
      updated_at: new Date().toISOString(),
    })
    .eq('id', draftId);
}

// ============================================
// GOOGLE CALENDAR AVAILABILITY CHECKING
// ============================================

/**
 * Check our Google Calendar availability for the next N days
 * Uses Unipile's calendar API
 */
export async function checkGoogleCalendarAvailability(params: {
  workspaceId: string;
  daysAhead?: number;
  preferredTimes?: { start: number; end: number }[]; // Hours in local time
  meetingDurationMinutes?: number;
}): Promise<CalendarAvailability> {
  const { workspaceId, daysAhead = 7, meetingDurationMinutes = 30 } = params;

  // Get Google Calendar account for this workspace
  const { data: calendarAccount } = await supabase
    .from('workspace_accounts')
    .select('unipile_account_id, account_metadata')
    .eq('workspace_id', workspaceId)
    .eq('account_type', 'google_calendar')
    .eq('connection_status', 'connected')
    .single();

  if (!calendarAccount?.unipile_account_id) {
    console.log(`No Google Calendar connected for workspace ${workspaceId}`);
    return { hasSlots: false, suggestedSlots: [] };
  }

  // Fetch busy times from Unipile
  const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
  const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + daysAhead);

  try {
    const response = await fetch(
      `https://${UNIPILE_DSN}/api/v1/calendar/freebusy?account_id=${calendarAccount.unipile_account_id}&start_time=${startDate.toISOString()}&end_time=${endDate.toISOString()}`,
      {
        method: 'GET',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY!,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch calendar availability:', await response.text());
      return { hasSlots: false, suggestedSlots: [] };
    }

    const data = await response.json();
    const busyPeriods = data.calendars?.[0]?.busy || [];

    // Find available slots
    const suggestedSlots = findAvailableSlots({
      busyPeriods,
      startDate,
      endDate,
      meetingDurationMinutes,
      preferredTimes: params.preferredTimes || [
        { start: 9, end: 12 },  // Morning: 9 AM - 12 PM
        { start: 14, end: 17 }, // Afternoon: 2 PM - 5 PM
      ],
    });

    return {
      hasSlots: suggestedSlots.length > 0,
      nextAvailable: suggestedSlots[0]?.start,
      suggestedSlots: suggestedSlots.slice(0, 3), // Top 3 suggestions
    };
  } catch (error) {
    console.error('Error checking calendar availability:', error);
    return { hasSlots: false, suggestedSlots: [] };
  }
}

/**
 * Find available slots given busy periods
 */
function findAvailableSlots(params: {
  busyPeriods: Array<{ start: string; end: string }>;
  startDate: Date;
  endDate: Date;
  meetingDurationMinutes: number;
  preferredTimes: Array<{ start: number; end: number }>;
}): Array<{ start: Date; end: Date }> {
  const { busyPeriods, startDate, endDate, meetingDurationMinutes, preferredTimes } = params;
  const slots: Array<{ start: Date; end: Date }> = [];

  // Convert busy periods to timestamps for easy comparison
  const busyTimestamps = busyPeriods.map(p => ({
    start: new Date(p.start).getTime(),
    end: new Date(p.end).getTime(),
  }));

  // Check each day
  const currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);

  while (currentDate <= endDate && slots.length < 10) {
    // Skip weekends
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Check preferred time blocks for this day
      for (const timeBlock of preferredTimes) {
        const slotStart = new Date(currentDate);
        slotStart.setHours(timeBlock.start, 0, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + meetingDurationMinutes);

        // Check if slot is in the past
        if (slotStart <= new Date()) continue;

        // Check if slot conflicts with busy periods
        const slotStartTs = slotStart.getTime();
        const slotEndTs = slotEnd.getTime();

        const hasConflict = busyTimestamps.some(busy =>
          (slotStartTs >= busy.start && slotStartTs < busy.end) ||
          (slotEndTs > busy.start && slotEndTs <= busy.end) ||
          (slotStartTs <= busy.start && slotEndTs >= busy.end)
        );

        if (!hasConflict) {
          slots.push({ start: slotStart, end: slotEnd });
        }
      }
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return slots;
}

// ============================================
// FOLLOW-UP TRIGGER CHECKS
// ============================================

/**
 * Check prospects who need follow-up because:
 * 1. SAM sent a calendar link but no meeting was booked (3 days passed)
 * 2. Meeting was cancelled
 * 3. No-show detected
 * 4. No response after SAM's reply (5 days passed)
 *
 * This is meant to be called by a cron job
 */
export async function checkFollowUpTriggers(): Promise<{
  noBooking: string[];
  cancelled: string[];
  noShow: string[];
  noResponse: string[];
}> {
  const now = new Date();

  // 1. SAM sent calendar link but no meeting booked (check calendar_follow_up_due_at)
  const { data: noBookingProspects } = await supabase
    .from('campaign_prospects')
    .select('id')
    .eq('sam_reply_included_calendar', true)
    .eq('conversation_stage', 'awaiting_booking')
    .lt('calendar_follow_up_due_at', now.toISOString())
    .is('meeting_booked_at', null);

  // 2. Meeting was cancelled (check for follow_up_trigger = 'meeting_cancelled')
  const { data: cancelledProspects } = await supabase
    .from('campaign_prospects')
    .select('id')
    .eq('follow_up_trigger', 'meeting_cancelled')
    .lt('calendar_follow_up_due_at', now.toISOString());

  // 3. No-show (check for follow_up_trigger = 'meeting_no_show')
  const { data: noShowProspects } = await supabase
    .from('campaign_prospects')
    .select('id')
    .eq('follow_up_trigger', 'meeting_no_show')
    .lt('calendar_follow_up_due_at', now.toISOString());

  // 4. No response after SAM's reply (5 days)
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const { data: noResponseProspects } = await supabase
    .from('campaign_prospects')
    .select('id')
    .eq('conversation_stage', 'awaiting_response')
    .lt('sam_reply_sent_at', fiveDaysAgo.toISOString())
    .is('responded_at', null);

  return {
    noBooking: noBookingProspects?.map(p => p.id) || [],
    cancelled: cancelledProspects?.map(p => p.id) || [],
    noShow: noShowProspects?.map(p => p.id) || [],
    noResponse: noResponseProspects?.map(p => p.id) || [],
  };
}

/**
 * Mark prospects as needing follow-up
 * Sets follow_up_trigger and queues for Follow-up Agent
 */
export async function triggerFollowUp(
  prospectId: string,
  trigger: 'no_meeting_booked' | 'meeting_cancelled' | 'meeting_no_show' | 'no_response'
): Promise<void> {
  await supabase
    .from('campaign_prospects')
    .update({
      follow_up_trigger: trigger,
      follow_up_due_at: new Date().toISOString(), // Follow-up Agent will pick this up
      conversation_stage: trigger === 'no_meeting_booked' ? 'follow_up_needed' :
                          trigger === 'meeting_cancelled' ? 'reschedule_needed' :
                          trigger === 'meeting_no_show' ? 'no_show_follow_up' :
                          'follow_up_needed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', prospectId);

  console.log(`Follow-up triggered for prospect ${prospectId}: ${trigger}`);
}

// ============================================
// EXPORTS
// ============================================

export default {
  detectCalendarLinks,
  hasCalendarLink,
  handleProspectCalendarLink,
  updateDraftWithProspectCalendarLink,
  checkGoogleCalendarAvailability,
  checkFollowUpTriggers,
  triggerFollowUp,
};
