/**
 * Calendar API - List Calendars
 *
 * GET /api/calendar/list?account_id=xxx
 *
 * Lists all calendars for a connected Google/Outlook account
 */

import { NextRequest, NextResponse } from 'next/server';
import { listCalendars } from '@/lib/unipile/calendar-service';

export async function GET(req: NextRequest) {
  try {
    const accountId = req.nextUrl.searchParams.get('account_id');

    if (!accountId) {
      return NextResponse.json({ error: 'account_id is required' }, { status: 400 });
    }

    const result = await listCalendars(accountId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      calendars: result.data,
    });
  } catch (error: any) {
    console.error('List calendars error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
