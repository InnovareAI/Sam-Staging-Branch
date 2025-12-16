/**
 * Calendar API - Events
 *
 * GET /api/calendar/events?calendar_id=xxx&start=xxx&end=xxx
 * POST /api/calendar/events - Create new event
 *
 * List events and create new calendar events
 */

import { NextRequest, NextResponse } from 'next/server';
import { listEvents, createEvent, checkAvailability, findAvailableSlots } from '@/lib/unipile/calendar-service';

export async function GET(req: NextRequest) {
  try {
    const calendarId = req.nextUrl.searchParams.get('calendar_id');
    const start = req.nextUrl.searchParams.get('start');
    const end = req.nextUrl.searchParams.get('end');
    const action = req.nextUrl.searchParams.get('action'); // 'list', 'availability', 'find_slots'

    if (!calendarId) {
      return NextResponse.json({ error: 'calendar_id is required' }, { status: 400 });
    }

    // Check availability
    if (action === 'availability' && start && end) {
      const result = await checkAvailability(calendarId, start, end);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        ...result.data,
      });
    }

    // Find available slots
    if (action === 'find_slots' && start && end) {
      const duration = parseInt(req.nextUrl.searchParams.get('duration') || '30');
      const result = await findAvailableSlots(calendarId, start, end, duration);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        availableSlots: result.data,
      });
    }

    // Default: list events
    const result = await listEvents(calendarId, {
      start: start || undefined,
      end: end || undefined,
      limit: parseInt(req.nextUrl.searchParams.get('limit') || '50'),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      events: result.data,
    });
  } catch (error: any) {
    console.error('List events error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { calendar_id, title, description, start, end, timezone, location, attendees, reminders, conference } = body;

    if (!calendar_id) {
      return NextResponse.json({ error: 'calendar_id is required' }, { status: 400 });
    }

    if (!title || !start || !end) {
      return NextResponse.json({ error: 'title, start, and end are required' }, { status: 400 });
    }

    const result = await createEvent(calendar_id, {
      title,
      description,
      start,
      end,
      timezone,
      location,
      attendees,
      reminders,
      conference,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      event: result.data,
    });
  } catch (error: any) {
    console.error('Create event error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
