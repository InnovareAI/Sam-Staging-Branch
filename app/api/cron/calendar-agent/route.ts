/**
 * Calendar Agent Cron Job
 *
 * POST /api/cron/calendar-agent
 *
 * Responsibilities:
 * 1. Check for prospects needing follow-up (triggers Follow-up Agent)
 *    - SAM sent calendar link but no meeting booked (3 days)
 *    - Meeting was cancelled
 *    - No-show detected
 *    - No response after SAM's reply (5 days)
 *
 * 2. Process prospects who shared their calendar link
 *    - Check our Google Calendar availability
 *    - Queue response with our available times
 *
 * Schedule: Every 2 hours
 * Created: December 20, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  checkFollowUpTriggers,
  triggerFollowUp,
  checkGoogleCalendarAvailability,
} from '@/lib/services/calendar-agent';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  // Security check
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const now = new Date();
  const results = {
    followUpTriggersProcessed: 0,
    prospectCalendarsProcessed: 0,
    calendarClickFollowUps: 0,
    errors: [] as string[],
  };

  try {
    console.log('Calendar Agent starting...');

    // ============================================
    // PHASE 1: Check Follow-up Triggers
    // ============================================
    console.log('Phase 1: Checking follow-up triggers...');

    const triggers = await checkFollowUpTriggers();

    // Process no-booking triggers
    for (const prospectId of triggers.noBooking) {
      try {
        await triggerFollowUp(prospectId, 'no_meeting_booked');
        results.followUpTriggersProcessed++;
        console.log(`Triggered follow-up for ${prospectId}: no_meeting_booked`);
      } catch (err) {
        results.errors.push(`Failed to trigger follow-up for ${prospectId}: ${err}`);
      }
    }

    // Process cancelled triggers
    for (const prospectId of triggers.cancelled) {
      try {
        await triggerFollowUp(prospectId, 'meeting_cancelled');
        results.followUpTriggersProcessed++;
        console.log(`Triggered follow-up for ${prospectId}: meeting_cancelled`);
      } catch (err) {
        results.errors.push(`Failed to trigger follow-up for ${prospectId}: ${err}`);
      }
    }

    // Process no-show triggers
    for (const prospectId of triggers.noShow) {
      try {
        await triggerFollowUp(prospectId, 'meeting_no_show');
        results.followUpTriggersProcessed++;
        console.log(`Triggered follow-up for ${prospectId}: meeting_no_show`);
      } catch (err) {
        results.errors.push(`Failed to trigger follow-up for ${prospectId}: ${err}`);
      }
    }

    // Process no-response triggers
    for (const prospectId of triggers.noResponse) {
      try {
        await triggerFollowUp(prospectId, 'no_response');
        results.followUpTriggersProcessed++;
        console.log(`Triggered follow-up for ${prospectId}: no_response`);
      } catch (err) {
        results.errors.push(`Failed to trigger follow-up for ${prospectId}: ${err}`);
      }
    }

    console.log(`Phase 1 complete: ${results.followUpTriggersProcessed} follow-ups triggered`);

    // ============================================
    // PHASE 2: Process Prospect Calendar Links
    // ============================================
    console.log('Phase 2: Processing prospect calendar links...');

    // Find prospects who shared their calendar and need our availability
    const { data: prospectsWithCalendar } = await supabase
      .from('campaign_prospects')
      .select(`
        id,
        first_name,
        last_name,
        prospect_calendar_link,
        campaign_id,
        campaigns (
          workspace_id
        )
      `)
      .eq('conversation_stage', 'prospect_shared_calendar')
      .not('prospect_calendar_link', 'is', null)
      .limit(10);

    if (prospectsWithCalendar?.length) {
      for (const prospect of prospectsWithCalendar) {
        try {
          const workspaceId = (prospect.campaigns as any)?.workspace_id;
          if (!workspaceId) continue;

          // Check our availability
          const availability = await checkGoogleCalendarAvailability({
            workspaceId,
            daysAhead: 5,
            meetingDurationMinutes: 30,
          });

          if (availability.hasSlots) {
            // Format available slots for AI response
            const formattedSlots = availability.suggestedSlots
              .map(slot => {
                const date = slot.start.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                });
                const time = slot.start.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                });
                return `${date} at ${time}`;
              })
              .join(', or ');

            // Update prospect with our availability
            await supabase
              .from('campaign_prospects')
              .update({
                conversation_stage: 'availability_ready',
                metadata: {
                  our_available_slots: availability.suggestedSlots,
                  availability_checked_at: new Date().toISOString(),
                  formatted_availability: formattedSlots,
                },
                updated_at: new Date().toISOString(),
              })
              .eq('id', prospect.id);

            console.log(`Availability found for ${prospect.first_name}: ${formattedSlots}`);
            results.prospectCalendarsProcessed++;
          } else {
            console.log(`No Google Calendar connected for workspace ${workspaceId}`);
            // Mark as needing manual response
            await supabase
              .from('campaign_prospects')
              .update({
                conversation_stage: 'needs_manual_availability',
                updated_at: new Date().toISOString(),
              })
              .eq('id', prospect.id);
          }
        } catch (err) {
          results.errors.push(`Failed to check availability for ${prospect.id}: ${err}`);
        }
      }
    }

    console.log(`Phase 2 complete: ${results.prospectCalendarsProcessed} calendars processed`);

    // ============================================
    // PHASE 3: Calendar Link Clicks Without Booking
    // ============================================
    console.log('Phase 3: Checking calendar clicks without booking...');

    // Find prospects who clicked calendar but haven't booked (24h passed)
    const { data: calendarClickNoBook } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name')
      .eq('conversation_stage', 'calendar_clicked_pending_booking')
      .lt('calendar_follow_up_due_at', now.toISOString())
      .is('meeting_booked_at', null)
      .limit(20);

    let calendarClickFollowUps = 0;
    if (calendarClickNoBook?.length) {
      for (const prospect of calendarClickNoBook) {
        try {
          // Trigger follow-up - they clicked but didn't book!
          await supabase
            .from('campaign_prospects')
            .update({
              follow_up_trigger: 'calendar_clicked_no_booking',
              follow_up_due_at: new Date().toISOString(),
              conversation_stage: 'follow_up_needed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', prospect.id);

          calendarClickFollowUps++;
          results.calendarClickFollowUps++;
          console.log(`Calendar click follow-up triggered for ${prospect.first_name}`);
        } catch (err) {
          results.errors.push(`Failed to trigger calendar click follow-up for ${prospect.id}: ${err}`);
        }
      }
    }

    console.log(`Phase 3 complete: ${calendarClickFollowUps} calendar click follow-ups triggered`);

    // ============================================
    // PHASE 4: Detect No-Shows (Backup)
    // ============================================
    console.log('Phase 4: Checking for no-shows...');

    // Find meetings that should have happened but weren't marked as completed/no-show
    const gracePeriodMinutes = 15;
    const cutoffTime = new Date(Date.now() - gracePeriodMinutes * 60 * 1000);

    const { data: potentialNoShows } = await supabase
      .from('meetings')
      .select('id, prospect_id')
      .in('status', ['scheduled', 'confirmed'])
      .lt('scheduled_at', cutoffTime.toISOString())
      .is('no_show_detected_at', null)
      .limit(20);

    let noShowsDetected = 0;
    if (potentialNoShows?.length) {
      for (const meeting of potentialNoShows) {
        try {
          // Mark as no-show
          await supabase
            .from('meetings')
            .update({
              status: 'no_show',
              no_show_detected_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', meeting.id);

          // Update prospect
          await supabase
            .from('campaign_prospects')
            .update({
              meeting_status: 'no_show',
              follow_up_trigger: 'meeting_no_show',
              calendar_follow_up_due_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
              conversation_stage: 'no_show_follow_up',
              updated_at: new Date().toISOString(),
            })
            .eq('id', meeting.prospect_id);

          // Cancel pending reminders
          await supabase
            .from('meeting_reminders')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('meeting_id', meeting.id)
            .eq('status', 'pending');

          noShowsDetected++;
          console.log(`No-show detected: meeting ${meeting.id}`);
        } catch (err) {
          results.errors.push(`Failed to process no-show ${meeting.id}: ${err}`);
        }
      }
    }

    console.log(`Phase 4 complete: ${noShowsDetected} no-shows detected`);

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: 'Calendar Agent completed',
      results: {
        ...results,
        noShowsDetected,
      },
      execution_time_ms: duration,
    });

  } catch (error: any) {
    console.error('Calendar Agent error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      results,
    }, { status: 500 });
  }
}

// GET endpoint for health check
export async function GET() {
  return NextResponse.json({
    status: 'Calendar Agent endpoint active',
    responsibilities: [
      'Check follow-up triggers (no booking, cancelled, no-show, no response)',
      'Process prospect calendar links (check our availability)',
      'Detect no-shows for meetings past their scheduled time',
    ],
  });
}
