/**
 * Meeting Agent - Book Meeting API
 *
 * POST /api/meeting-agent/book
 *
 * Called when a booking link is detected in prospect's message.
 * Can be triggered by:
 * 1. Reply Agent when it detects a Calendly/Cal.com link
 * 2. Manual trigger from UI
 * 3. Webhook from external systems
 *
 * Flow:
 * 1. Detect booking platform from URL
 * 2. Scrape available slots
 * 3. Check our calendar for conflicts (via Unipile)
 * 4. Book the first available slot (or let user choose)
 * 5. Create meeting record and schedule reminders
 *
 * Created: December 16, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  detectBookingLinks,
  createMeeting,
  BookingLink,
} from '@/lib/services/meeting-agent';
import {
  scrapeBookingSlots,
  bookSlot,
  CalendlySlot,
} from '@/lib/services/calendly-scraper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

interface BookMeetingRequest {
  prospect_id: string;
  workspace_id: string;
  campaign_id?: string;
  booking_url?: string;          // If URL already known
  message_text?: string;         // If URL needs to be detected from message
  auto_book?: boolean;           // Auto-book first available slot
  preferred_slot?: CalendlySlot; // Specific slot to book
  booker?: {
    name: string;
    email: string;
    phone?: string;
    notes?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: BookMeetingRequest = await req.json();

    console.log('📅 Meeting Agent - Book request:', {
      prospect_id: body.prospect_id,
      auto_book: body.auto_book,
    });

    // ============================================
    // 1. DETECT BOOKING LINK
    // ============================================

    let bookingLink: BookingLink | null = null;

    if (body.booking_url) {
      // URL provided directly
      const links = detectBookingLinks(body.booking_url);
      bookingLink = links[0] || null;
    } else if (body.message_text) {
      // Detect from message text
      const links = detectBookingLinks(body.message_text);
      bookingLink = links[0] || null;
    }

    if (!bookingLink) {
      return NextResponse.json({
        success: false,
        error: 'No booking link detected',
      }, { status: 400 });
    }

    console.log(`🔗 Detected booking link: ${bookingLink.platform} - ${bookingLink.url}`);

    // ============================================
    // 2. GET PROSPECT AND WORKSPACE INFO
    // ============================================

    const { data: prospect, error: prospectError } = await supabase
      .from('campaign_prospects')
      .select('*, campaigns(id, workspace_id)')
      .eq('id', body.prospect_id)
      .single();

    if (prospectError || !prospect) {
      return NextResponse.json({
        success: false,
        error: 'Prospect not found',
      }, { status: 404 });
    }

    const workspaceId = body.workspace_id || prospect.campaigns?.workspace_id;

    // ============================================
    // 3. SCRAPE AVAILABLE SLOTS
    // ============================================

    console.log('🔍 Scraping available slots...');

    let eventInfo;
    let availableSlots: CalendlySlot[] = [];

    try {
      const scrapeResult = await scrapeBookingSlots(bookingLink.url, {
        days_ahead: 14,
      });
      eventInfo = scrapeResult.event_info;
      availableSlots = scrapeResult.slots;
    } catch (scrapeError: any) {
      console.error('Scraping failed:', scrapeError);
      return NextResponse.json({
        success: false,
        error: `Failed to scrape booking page: ${scrapeError.message}`,
        booking_url: bookingLink.url,
        platform: bookingLink.platform,
      }, { status: 500 });
    }

    if (availableSlots.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No available slots found',
        booking_url: bookingLink.url,
        event_info: eventInfo,
      }, { status: 404 });
    }

    console.log(`✅ Found ${availableSlots.length} available slots`);

    // ============================================
    // 4. CHECK OUR CALENDAR FOR CONFLICTS
    // ============================================

    let filteredSlots = availableSlots;

    if (UNIPILE_API_KEY) {
      try {
        // Get calendar account for workspace
        const { data: calendarAccount } = await supabase
          .from('workspace_accounts')
          .select('unipile_account_id')
          .eq('workspace_id', workspaceId)
          .in('account_type', ['google', 'microsoft', 'email'])
          .eq('connection_status', 'connected')
          .limit(1)
          .single();

        if (calendarAccount?.unipile_account_id) {
          // Get our calendar events for the slot period
          const startDate = availableSlots[0].datetime;
          const endDate = availableSlots[availableSlots.length - 1].datetime;

          const calendarResponse = await fetch(
            `https://${UNIPILE_DSN}/api/v1/calendar/events?account_id=${calendarAccount.unipile_account_id}&start=${startDate.toISOString()}&end=${endDate.toISOString()}`,
            {
              headers: {
                'X-API-KEY': UNIPILE_API_KEY,
                'Accept': 'application/json',
              },
            }
          );

          if (calendarResponse.ok) {
            const calendarData = await calendarResponse.json();
            const ourEvents = calendarData.items || [];

            // Filter out slots that conflict with our events
            filteredSlots = availableSlots.filter(slot => {
              const slotStart = slot.datetime.getTime();
              const slotEnd = slotStart + slot.duration_minutes * 60 * 1000;

              return !ourEvents.some((event: any) => {
                const eventStart = new Date(event.start).getTime();
                const eventEnd = new Date(event.end).getTime();
                // Check for overlap
                return slotStart < eventEnd && slotEnd > eventStart;
              });
            });

            console.log(`📊 ${filteredSlots.length} slots available after conflict check`);
          }
        }
      } catch (calendarError) {
        console.warn('Calendar conflict check failed:', calendarError);
        // Continue with unfiltered slots
      }
    }

    // ============================================
    // 5. BOOK THE SLOT (IF AUTO-BOOK ENABLED)
    // ============================================

    if (body.auto_book || body.preferred_slot) {
      const slotToBook = body.preferred_slot || filteredSlots[0];

      if (!slotToBook) {
        return NextResponse.json({
          success: false,
          error: 'No slots available to book',
        }, { status: 404 });
      }

      // Get booker info
      const booker = body.booker || await getWorkspaceBookerInfo(workspaceId);

      if (!booker) {
        return NextResponse.json({
          success: false,
          error: 'No booker information available',
          available_slots: filteredSlots.slice(0, 5),
        }, { status: 400 });
      }

      console.log(`📅 Booking slot: ${slotToBook.date} ${slotToBook.time}`);

      // Book via Calendly
      const bookingResult = await bookSlot(bookingLink.url, slotToBook, booker);

      if (!bookingResult.success) {
        return NextResponse.json({
          success: false,
          error: bookingResult.error,
          available_slots: filteredSlots.slice(0, 5),
        }, { status: 500 });
      }

      // Create meeting record in our system
      const meetingResult = await createMeeting({
        prospect_id: body.prospect_id,
        workspace_id: workspaceId,
        campaign_id: body.campaign_id || prospect.campaign_id,
        booking_url: bookingLink.url,
        booking_platform: bookingLink.platform,
        scheduled_at: slotToBook.datetime,
        duration_minutes: slotToBook.duration_minutes,
        meeting_link: bookingResult.meeting_link,
        our_attendee_email: booker.email,
        our_attendee_name: booker.name,
      });

      // Sync to our calendar via Unipile (if available)
      if (UNIPILE_API_KEY) {
        await syncToOurCalendar(workspaceId, {
          title: `Call with ${prospect.first_name} ${prospect.last_name}`,
          scheduled_at: slotToBook.datetime,
          duration_minutes: slotToBook.duration_minutes,
          meeting_link: bookingResult.meeting_link,
          attendee_email: prospect.email,
        });
      }

      return NextResponse.json({
        success: true,
        meeting_id: meetingResult.meeting_id,
        scheduled_at: slotToBook.datetime.toISOString(),
        confirmation_id: bookingResult.confirmation_id,
        meeting_link: bookingResult.meeting_link,
        reminders_scheduled: meetingResult.reminders_scheduled,
      });
    }

    // ============================================
    // 6. RETURN AVAILABLE SLOTS (IF NOT AUTO-BOOKING)
    // ============================================

    return NextResponse.json({
      success: true,
      booking_url: bookingLink.url,
      platform: bookingLink.platform,
      event_info: eventInfo,
      available_slots: filteredSlots.slice(0, 10), // Return top 10 slots
      total_slots: filteredSlots.length,
    });

  } catch (error: any) {
    console.error('❌ Meeting Agent book error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getWorkspaceBookerInfo(workspaceId: string): Promise<{ name: string; email: string } | null> {
  // Get workspace owner's info
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role, users(email, raw_user_meta_data)')
    .eq('workspace_id', workspaceId)
    .eq('role', 'owner')
    .limit(1);

  if (!members || members.length === 0) return null;

  const owner = members[0];
  const email = (owner.users as any)?.email;
  const name = (owner.users as any)?.raw_user_meta_data?.full_name ||
               (owner.users as any)?.raw_user_meta_data?.name ||
               email?.split('@')[0] ||
               'SAM User';

  if (!email) return null;

  return { name, email };
}

async function syncToOurCalendar(workspaceId: string, event: {
  title: string;
  scheduled_at: Date;
  duration_minutes: number;
  meeting_link?: string;
  attendee_email?: string;
}): Promise<void> {
  try {
    // Get calendar account
    const { data: calendarAccount } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id')
      .eq('workspace_id', workspaceId)
      .in('account_type', ['google', 'microsoft'])
      .eq('connection_status', 'connected')
      .limit(1)
      .single();

    if (!calendarAccount?.unipile_account_id || !UNIPILE_API_KEY) return;

    const endTime = new Date(event.scheduled_at.getTime() + event.duration_minutes * 60 * 1000);

    await fetch(`https://${UNIPILE_DSN}/api/v1/calendar/events`, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        account_id: calendarAccount.unipile_account_id,
        title: event.title,
        start: event.scheduled_at.toISOString(),
        end: endTime.toISOString(),
        description: event.meeting_link ? `Meeting Link: ${event.meeting_link}` : undefined,
        attendees: event.attendee_email ? [{ email: event.attendee_email }] : undefined,
      }),
    });

    console.log('📅 Event synced to our calendar');

  } catch (error) {
    console.warn('Failed to sync to calendar:', error);
  }
}
