/**
 * Unipile Calendar Service
 *
 * Full CRUD operations for Google Calendar and Outlook Calendar via Unipile API
 *
 * API Reference: https://developer.unipile.com/docs/calendars-and-events
 *
 * Created: December 16, 2025
 */

const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

interface UnipileCalendar {
  id: string;
  account_id: string;
  name: string;
  description?: string;
  timezone?: string;
  is_primary?: boolean;
  can_edit?: boolean;
  provider?: string;
}

interface UnipileAttendee {
  email: string;
  name?: string;
  response_status?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  is_organizer?: boolean;
}

interface UnipileEvent {
  id: string;
  calendar_id: string;
  title: string;
  description?: string;
  start: string; // ISO 8601
  end: string; // ISO 8601
  timezone?: string;
  location?: string;
  attendees?: UnipileAttendee[];
  status?: 'confirmed' | 'tentative' | 'cancelled';
  visibility?: 'public' | 'private';
  html_link?: string;
  hangout_link?: string;
  conference_data?: {
    type: string;
    uri: string;
  };
  reminders?: {
    method: 'email' | 'popup';
    minutes: number;
  }[];
  recurrence?: string[];
  created_at?: string;
  updated_at?: string;
}

interface CreateEventInput {
  title: string;
  description?: string;
  start: string; // ISO 8601 datetime
  end: string; // ISO 8601 datetime
  timezone?: string;
  location?: string;
  attendees?: { email: string; name?: string }[];
  reminders?: { method: 'email' | 'popup'; minutes: number }[];
  conference?: boolean; // Auto-create Google Meet / Teams link
}

interface ListEventsOptions {
  start?: string; // ISO 8601
  end?: string; // ISO 8601
  limit?: number;
  cursor?: string;
}

interface CalendarServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * List all calendars for an account
 */
export async function listCalendars(accountId: string): Promise<CalendarServiceResult<UnipileCalendar[]>> {
  if (!UNIPILE_API_KEY) {
    return { success: false, error: 'Unipile API key not configured' };
  }

  try {
    const url = new URL(`https://${UNIPILE_DSN}/api/v1/calendars`);
    url.searchParams.set('account_id', accountId);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Unipile listCalendars error:', errorText);
      return { success: false, error: `Failed to list calendars: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, data: data.items || data };
  } catch (error: any) {
    console.error('listCalendars error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get a specific calendar by ID
 */
export async function getCalendar(calendarId: string): Promise<CalendarServiceResult<UnipileCalendar>> {
  if (!UNIPILE_API_KEY) {
    return { success: false, error: 'Unipile API key not configured' };
  }

  try {
    const response = await fetch(`https://${UNIPILE_DSN}/api/v1/calendars/${calendarId}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Unipile getCalendar error:', errorText);
      return { success: false, error: `Failed to get calendar: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    console.error('getCalendar error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * List events from a calendar (for checking availability)
 */
export async function listEvents(
  calendarId: string,
  options: ListEventsOptions = {}
): Promise<CalendarServiceResult<UnipileEvent[]>> {
  if (!UNIPILE_API_KEY) {
    return { success: false, error: 'Unipile API key not configured' };
  }

  try {
    const url = new URL(`https://${UNIPILE_DSN}/api/v1/calendars/${calendarId}/events`);

    if (options.start) url.searchParams.set('start', options.start);
    if (options.end) url.searchParams.set('end', options.end);
    if (options.limit) url.searchParams.set('limit', options.limit.toString());
    if (options.cursor) url.searchParams.set('cursor', options.cursor);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Unipile listEvents error:', errorText);
      return { success: false, error: `Failed to list events: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, data: data.items || data };
  } catch (error: any) {
    console.error('listEvents error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check availability for a time range
 * Returns busy slots within the specified range
 */
export async function checkAvailability(
  calendarId: string,
  start: string,
  end: string
): Promise<CalendarServiceResult<{ busySlots: { start: string; end: string; title: string }[]; isBusy: boolean }>> {
  const eventsResult = await listEvents(calendarId, { start, end });

  if (!eventsResult.success) {
    return { success: false, error: eventsResult.error };
  }

  const events = eventsResult.data || [];
  const busySlots = events
    .filter(e => e.status !== 'cancelled')
    .map(e => ({
      start: e.start,
      end: e.end,
      title: e.title,
    }));

  return {
    success: true,
    data: {
      busySlots,
      isBusy: busySlots.length > 0,
    },
  };
}

/**
 * Create a new calendar event
 */
export async function createEvent(
  calendarId: string,
  event: CreateEventInput
): Promise<CalendarServiceResult<UnipileEvent>> {
  if (!UNIPILE_API_KEY) {
    return { success: false, error: 'Unipile API key not configured' };
  }

  try {
    const body: any = {
      title: event.title,
      start: event.start,
      end: event.end,
    };

    if (event.description) body.description = event.description;
    if (event.timezone) body.timezone = event.timezone;
    if (event.location) body.location = event.location;
    if (event.attendees) body.attendees = event.attendees;
    if (event.reminders) body.reminders = event.reminders;
    if (event.conference) body.conference = { create_request: true };

    const response = await fetch(`https://${UNIPILE_DSN}/api/v1/calendars/${calendarId}/events`, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Unipile createEvent error:', errorText);
      return { success: false, error: `Failed to create event: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    console.error('createEvent error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get a specific event
 */
export async function getEvent(
  calendarId: string,
  eventId: string
): Promise<CalendarServiceResult<UnipileEvent>> {
  if (!UNIPILE_API_KEY) {
    return { success: false, error: 'Unipile API key not configured' };
  }

  try {
    const response = await fetch(
      `https://${UNIPILE_DSN}/api/v1/calendars/${calendarId}/events/${eventId}`,
      {
        method: 'GET',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Unipile getEvent error:', errorText);
      return { success: false, error: `Failed to get event: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    console.error('getEvent error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update an existing event
 */
export async function updateEvent(
  calendarId: string,
  eventId: string,
  updates: Partial<CreateEventInput>
): Promise<CalendarServiceResult<UnipileEvent>> {
  if (!UNIPILE_API_KEY) {
    return { success: false, error: 'Unipile API key not configured' };
  }

  try {
    const response = await fetch(
      `https://${UNIPILE_DSN}/api/v1/calendars/${calendarId}/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Unipile updateEvent error:', errorText);
      return { success: false, error: `Failed to update event: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    console.error('updateEvent error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete/cancel an event
 */
export async function deleteEvent(
  calendarId: string,
  eventId: string
): Promise<CalendarServiceResult<{ deleted: boolean }>> {
  if (!UNIPILE_API_KEY) {
    return { success: false, error: 'Unipile API key not configured' };
  }

  try {
    const response = await fetch(
      `https://${UNIPILE_DSN}/api/v1/calendars/${calendarId}/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Unipile deleteEvent error:', errorText);
      return { success: false, error: `Failed to delete event: ${response.status}` };
    }

    return { success: true, data: { deleted: true } };
  } catch (error: any) {
    console.error('deleteEvent error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Find available time slots within a range
 * Useful for suggesting meeting times
 */
export async function findAvailableSlots(
  calendarId: string,
  start: string,
  end: string,
  durationMinutes: number = 30,
  workingHoursStart: number = 9, // 9 AM
  workingHoursEnd: number = 17 // 5 PM
): Promise<CalendarServiceResult<{ start: string; end: string }[]>> {
  const eventsResult = await listEvents(calendarId, { start, end });

  if (!eventsResult.success) {
    return { success: false, error: eventsResult.error };
  }

  const events = eventsResult.data || [];
  const busyTimes = events
    .filter(e => e.status !== 'cancelled')
    .map(e => ({ start: new Date(e.start), end: new Date(e.end) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const availableSlots: { start: string; end: string }[] = [];
  const startDate = new Date(start);
  const endDate = new Date(end);
  const durationMs = durationMinutes * 60 * 1000;

  let currentDay = new Date(startDate);
  currentDay.setHours(workingHoursStart, 0, 0, 0);

  while (currentDay < endDate) {
    // Skip weekends
    if (currentDay.getDay() === 0 || currentDay.getDay() === 6) {
      currentDay.setDate(currentDay.getDate() + 1);
      currentDay.setHours(workingHoursStart, 0, 0, 0);
      continue;
    }

    const dayEnd = new Date(currentDay);
    dayEnd.setHours(workingHoursEnd, 0, 0, 0);

    let slotStart = new Date(currentDay);

    while (slotStart.getTime() + durationMs <= dayEnd.getTime()) {
      const slotEnd = new Date(slotStart.getTime() + durationMs);

      // Check if slot overlaps with any busy time
      const hasConflict = busyTimes.some(busy =>
        (slotStart < busy.end && slotEnd > busy.start)
      );

      if (!hasConflict) {
        availableSlots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
        });
      }

      // Move to next slot (30 min intervals)
      slotStart = new Date(slotStart.getTime() + 30 * 60 * 1000);
    }

    // Move to next day
    currentDay.setDate(currentDay.getDate() + 1);
    currentDay.setHours(workingHoursStart, 0, 0, 0);
  }

  return { success: true, data: availableSlots };
}
