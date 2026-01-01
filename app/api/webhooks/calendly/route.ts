/**
 * Calendly Webhook Handler
 * Receives booking and cancellation events from Calendly
 *
 * POST /api/webhooks/calendly
 *
 * Events handled:
 * - invitee.created: New meeting booked
 * - invitee.canceled: Meeting cancelled
 * - invitee_no_show: No-show reported
 * - routing_form_submission.created: Form submitted
 *
 * Created: December 20, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createHmac } from 'crypto';

const CALENDLY_WEBHOOK_SIGNING_KEY = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;

// ============================================
// TYPES
// ============================================

interface CalendlyWebhookPayload {
  event: string;
  created_at: string;
  created_by: string;
  payload: {
    cancel_url?: string;
    created_at: string;
    email: string;
    event: string; // URI to the event type
    first_name?: string;
    last_name?: string;
    name: string;
    new_invitee?: string;
    no_show?: {
      uri: string;
      created_at: string;
    };
    old_invitee?: string;
    payment?: unknown;
    questions_and_answers?: Array<{
      answer: string;
      position: number;
      question: string;
    }>;
    reconfirmation?: unknown;
    reschedule_url?: string;
    rescheduled: boolean;
    routing_form_submission?: string;
    scheduled_event: {
      uri: string;
      name: string;
      status: string;
      start_time: string;
      end_time: string;
      event_type: string;
      location?: {
        join_url?: string;
        type: string;
      };
      invitees_counter: {
        total: number;
        active: number;
        limit: number;
      };
      created_at: string;
      updated_at: string;
      event_memberships: Array<{
        user: string;
        user_email: string;
        user_name: string;
      }>;
    };
    status: string;
    text_reminder_number?: string;
    timezone: string;
    tracking?: {
      utm_campaign?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_content?: string;
      utm_term?: string;
      salesforce_uuid?: string;
    };
    updated_at: string;
    uri: string;
    canceled?: boolean;
    cancellation?: {
      canceled_by: string;
      reason?: string;
      canceler_type: string;
    };
  };
}

// ============================================
// SIGNATURE VERIFICATION
// ============================================

function verifyCalendlySignature(
  payload: string,
  signature: string,
  signingKey: string
): boolean {
  if (!signingKey) {
    console.log('No Calendly signing key configured, skipping verification');
    return true;
  }

  const computedSignature = createHmac('sha256', signingKey)
    .update(payload)
    .digest('hex');

  // Calendly signature format: t=timestamp,v1=signature
  const signatureValue = signature.split(',').find(s => s.startsWith('v1='))?.split('=')[1];

  return signatureValue === computedSignature;
}

// ============================================
// MAIN HANDLER
// ============================================

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('Calendly-Webhook-Signature') || '';

    // Verify signature if signing key is configured
    if (CALENDLY_WEBHOOK_SIGNING_KEY && !verifyCalendlySignature(rawBody, signature, CALENDLY_WEBHOOK_SIGNING_KEY)) {
      console.error('Calendly webhook signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload: CalendlyWebhookPayload = JSON.parse(rawBody);

    console.log('Calendly webhook received:', {
      event: payload.event,
      email: payload.payload.email,
      scheduled_event: payload.payload.scheduled_event?.uri,
    });

    switch (payload.event) {
      case 'invitee.created':
        await handleInviteeCreated(payload);
        break;

      case 'invitee.canceled':
        await handleInviteeCanceled(payload);
        break;

      case 'invitee_no_show':
        await handleNoShow(payload);
        break;

      default:
        console.log(`Unhandled Calendly event: ${payload.event}`);
    }

    return NextResponse.json({ success: true, event: payload.event });

  } catch (error: any) {
    console.error('Calendly webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Handle new meeting booking
 */
async function handleInviteeCreated(payload: CalendlyWebhookPayload) {
  const { email, name, first_name, last_name, scheduled_event, timezone } = payload.payload;

  console.log('New booking received:', {
    email,
    name,
    start_time: scheduled_event.start_time,
    event_name: scheduled_event.name,
  });

  // Try to match with existing prospect
  const prospect = await findProspectByEmail(email);

  if (!prospect) {
    console.log(`No matching prospect found for: ${email}`);
    // Store booking info for later matching
    await storeUnmatchedBooking(payload);
    return;
  }

  console.log(`Matched prospect: ${prospect.id} (${prospect.first_name} ${prospect.last_name})`);

  // Get workspace from prospect's campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('workspace_id')
    .eq('id', prospect.campaign_id)
    .single();

  if (!campaign) {
    console.error('No campaign found for prospect:', prospect.id);
    return;
  }

  // Extract meeting link
  const meetingLink = scheduled_event.location?.join_url;

  // Calculate duration
  const startTime = new Date(scheduled_event.start_time);
  const endTime = new Date(scheduled_event.end_time);
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

  // Get host info
  const host = scheduled_event.event_memberships?.[0];

  // Create or update meeting record
  const { data: existingMeeting } = await supabase
    .from('meetings')
    .select('id')
    .eq('prospect_id', prospect.id)
    .eq('booking_platform', 'calendly')
    .in('status', ['scheduled', 'confirmed'])
    .single();

  if (existingMeeting) {
    // Update existing meeting (might be a reschedule)
    await supabase
      .from('meetings')
      .update({
        scheduled_at: startTime.toISOString(),
        duration_minutes: durationMinutes,
        meeting_link: meetingLink,
        timezone,
        their_calendar_event_id: scheduled_event.uri,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          calendly_event_uri: scheduled_event.uri,
          calendly_invitee_uri: payload.payload.uri,
          host_email: host?.user_email,
          host_name: host?.user_name,
        },
      })
      .eq('id', existingMeeting.id);

    console.log(`Updated existing meeting: ${existingMeeting.id}`);
  } else {
    // Create new meeting
    const { data: meeting, error } = await supabase
      .from('meetings')
      .insert({
        prospect_id: prospect.id,
        workspace_id: campaign.workspace_id,
        campaign_id: prospect.campaign_id,
        booking_url: payload.payload.reschedule_url,
        booking_platform: 'calendly',
        booking_event_type: scheduled_event.name,
        title: `${scheduled_event.name} with ${first_name || name}`,
        scheduled_at: startTime.toISOString(),
        duration_minutes: durationMinutes,
        meeting_link: meetingLink,
        meeting_platform: getMeetingPlatform(scheduled_event.location?.type),
        timezone,
        our_attendee_email: host?.user_email,
        our_attendee_name: host?.user_name,
        prospect_email: email,
        prospect_name: name,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        their_calendar_event_id: scheduled_event.uri,
        metadata: {
          calendly_event_uri: scheduled_event.uri,
          calendly_invitee_uri: payload.payload.uri,
          tracking: payload.payload.tracking,
          questions_and_answers: payload.payload.questions_and_answers,
        },
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create meeting:', error);
      return;
    }

    console.log(`Created new meeting: ${meeting.id}`);

    // Schedule reminders
    await scheduleMeetingReminders(meeting.id, campaign.workspace_id, startTime);
  }

  // Update prospect status - CRITICAL for agent integration
  await supabase
    .from('campaign_prospects')
    .update({
      meeting_booked_at: new Date().toISOString(),
      meeting_scheduled_at: startTime.toISOString(),
      meeting_status: 'confirmed',
      conversation_stage: 'meeting_scheduled',
      calendar_follow_up_due_at: null, // Clear follow-up since meeting is booked
      follow_up_trigger: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', prospect.id);

  console.log(`Updated prospect ${prospect.id} with meeting booking`);
}

/**
 * Handle meeting cancellation
 */
async function handleInviteeCanceled(payload: CalendlyWebhookPayload) {
  const { email, scheduled_event, cancellation } = payload.payload;

  console.log('Cancellation received:', {
    email,
    event_uri: scheduled_event.uri,
    canceled_by: cancellation?.canceled_by,
    reason: cancellation?.reason,
  });

  // Find the meeting
  const { data: meeting } = await supabase
    .from('meetings')
    .select('id, prospect_id, workspace_id')
    .eq('their_calendar_event_id', scheduled_event.uri)
    .single();

  if (!meeting) {
    console.log('No matching meeting found for cancellation');
    return;
  }

  // Update meeting status
  await supabase
    .from('meetings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: cancellation?.canceler_type === 'host' ? 'us' : 'prospect',
      cancellation_reason: cancellation?.reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', meeting.id);

  // Cancel pending reminders
  await supabase
    .from('meeting_reminders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('meeting_id', meeting.id)
    .eq('status', 'pending');

  // Update prospect - trigger follow-up agent
  await supabase
    .from('campaign_prospects')
    .update({
      meeting_status: 'cancelled',
      conversation_stage: 'meeting_cancelled',
      follow_up_trigger: 'meeting_cancelled',
      // Set follow-up for next day to give them time to reschedule on their own
      calendar_follow_up_due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', meeting.prospect_id);

  console.log(`Meeting ${meeting.id} marked as cancelled, follow-up agent triggered`);
}

/**
 * Handle no-show notification
 */
async function handleNoShow(payload: CalendlyWebhookPayload) {
  const { email, scheduled_event, no_show } = payload.payload;

  console.log('No-show received:', {
    email,
    event_uri: scheduled_event.uri,
    no_show_created: no_show?.created_at,
  });

  // Find the meeting
  const { data: meeting } = await supabase
    .from('meetings')
    .select('id, prospect_id, workspace_id, reschedule_attempts, max_reschedule_attempts')
    .eq('their_calendar_event_id', scheduled_event.uri)
    .single();

  if (!meeting) {
    console.log('No matching meeting found for no-show');
    return;
  }

  const canReschedule = (meeting.reschedule_attempts || 0) < (meeting.max_reschedule_attempts || 3);

  // Update meeting status
  await supabase
    .from('meetings')
    .update({
      status: 'no_show',
      no_show_detected_at: new Date().toISOString(),
      reschedule_attempts: (meeting.reschedule_attempts || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', meeting.id);

  // Cancel pending reminders
  await supabase
    .from('meeting_reminders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('meeting_id', meeting.id)
    .eq('status', 'pending');

  // Update prospect - trigger follow-up agent
  await supabase
    .from('campaign_prospects')
    .update({
      meeting_status: 'no_show',
      conversation_stage: canReschedule ? 'no_show_follow_up' : 'closed_lost',
      follow_up_trigger: 'meeting_no_show',
      // Follow up same day for no-shows
      calendar_follow_up_due_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
      updated_at: new Date().toISOString(),
    })
    .eq('id', meeting.prospect_id);

  console.log(`Meeting ${meeting.id} marked as no-show, follow-up scheduled in 2 hours`);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Find prospect by email across all workspaces
 */
async function findProspectByEmail(email: string): Promise<any> {
  // First try campaign_prospects (most common)
  const { data: prospect } = await supabase
    .from('campaign_prospects')
    .select('id, campaign_id, first_name, last_name, email')
    .eq('email', email.toLowerCase())
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (prospect) return prospect;

  // Also try workspace_prospects if no campaign prospect found
  const { data: wsProspect } = await supabase
    .from('workspace_prospects')
    .select('id, email, name')
    .eq('email', email.toLowerCase())
    .limit(1)
    .single();

  return wsProspect;
}

/**
 * Store unmatched booking for later matching
 */
async function storeUnmatchedBooking(payload: CalendlyWebhookPayload) {
  const { email, name, scheduled_event } = payload.payload;

  await supabase.from('unmatched_calendar_bookings').insert({
    email,
    name,
    platform: 'calendly',
    event_uri: scheduled_event.uri,
    scheduled_at: scheduled_event.start_time,
    raw_payload: payload,
    created_at: new Date().toISOString(),
  });

  console.log(`Stored unmatched booking for: ${email}`);
}

/**
 * Schedule meeting reminders
 */
async function scheduleMeetingReminders(
  meeting_id: string,
  workspace_id: string,
  scheduled_at: Date
): Promise<void> {
  const reminders = [
    { type: '24h', offset_hours: 24 },
    { type: '1h', offset_hours: 1 },
    { type: '15m', offset_hours: 0.25 },
  ];

  const now = new Date();
  const toInsert = [];

  for (const reminder of reminders) {
    const reminderTime = new Date(scheduled_at.getTime() - reminder.offset_hours * 60 * 60 * 1000);

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
    console.log(`Scheduled ${toInsert.length} reminders for meeting ${meeting_id}`);
  }
}

/**
 * Determine meeting platform from Calendly location type
 */
function getMeetingPlatform(locationType?: string): string {
  if (!locationType) return 'unknown';

  const platformMap: Record<string, string> = {
    zoom: 'zoom',
    google_meet: 'google_meet',
    microsoft_teams: 'teams',
    webex: 'webex',
    phone_call: 'phone',
    in_person: 'in_person',
  };

  return platformMap[locationType.toLowerCase()] || 'other';
}

// ============================================
// VERIFICATION ENDPOINT
// ============================================

export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'Calendly webhook endpoint active',
    supported_events: [
      'invitee.created',
      'invitee.canceled',
      'invitee_no_show',
    ],
  });
}
