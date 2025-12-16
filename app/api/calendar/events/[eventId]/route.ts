/**
 * Calendar API - Single Event Operations
 *
 * GET /api/calendar/events/[eventId]?calendar_id=xxx
 * PATCH /api/calendar/events/[eventId] - Update event
 * DELETE /api/calendar/events/[eventId] - Delete event
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEvent, updateEvent, deleteEvent } from '@/lib/unipile/calendar-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const calendarId = req.nextUrl.searchParams.get('calendar_id');

    if (!calendarId) {
      return NextResponse.json({ error: 'calendar_id is required' }, { status: 400 });
    }

    const result = await getEvent(calendarId, eventId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      event: result.data,
    });
  } catch (error: any) {
    console.error('Get event error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const body = await req.json();
    const { calendar_id, ...updates } = body;

    if (!calendar_id) {
      return NextResponse.json({ error: 'calendar_id is required' }, { status: 400 });
    }

    const result = await updateEvent(calendar_id, eventId, updates);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      event: result.data,
    });
  } catch (error: any) {
    console.error('Update event error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const calendarId = req.nextUrl.searchParams.get('calendar_id');

    if (!calendarId) {
      return NextResponse.json({ error: 'calendar_id is required' }, { status: 400 });
    }

    const result = await deleteEvent(calendarId, eventId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted: true,
    });
  } catch (error: any) {
    console.error('Delete event error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
