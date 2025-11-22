/**
 * Timezone Utilities for Email Campaigns
 * Converts location to timezone, handles business hours, weekend skipping
 * November 22, 2025
 */

// Mapping of common locations to IANA timezone identifiers
const LOCATION_TO_TIMEZONE: Record<string, string> = {
  // North America
  'new york': 'America/New_York',
  'los angeles': 'America/Los_Angeles',
  'chicago': 'America/Chicago',
  'denver': 'America/Denver',
  'phoenix': 'America/Phoenix',
  'toronto': 'America/Toronto',
  'vancouver': 'America/Vancouver',
  'mexico city': 'America/Mexico_City',

  // South America
  'são paulo': 'America/Sao_Paulo',
  'buenos aires': 'America/Argentina/Buenos_Aires',
  'santiago': 'America/Santiago',

  // Europe
  'london': 'Europe/London',
  'paris': 'Europe/Paris',
  'berlin': 'Europe/Berlin',
  'amsterdam': 'Europe/Amsterdam',
  'madrid': 'Europe/Madrid',
  'rome': 'Europe/Rome',
  'zurich': 'Europe/Zurich',
  'stockholm': 'Europe/Stockholm',
  'moscow': 'Europe/Moscow',

  // Middle East
  'dubai': 'Asia/Dubai',
  'tel aviv': 'Asia/Jerusalem',
  'istanbul': 'Europe/Istanbul',

  // Asia
  'delhi': 'Asia/Kolkata',
  'mumbai': 'Asia/Kolkata',
  'bangalore': 'Asia/Kolkata',
  'bangkok': 'Asia/Bangkok',
  'singapore': 'Asia/Singapore',
  'hong kong': 'Asia/Hong_Kong',
  'shanghai': 'Asia/Shanghai',
  'beijing': 'Asia/Shanghai',
  'tokyo': 'Asia/Tokyo',
  'seoul': 'Asia/Seoul',
  'manila': 'Asia/Manila',

  // Oceania
  'sydney': 'Australia/Sydney',
  'melbourne': 'Australia/Melbourne',
  'auckland': 'Pacific/Auckland',

  // Africa
  'johannesburg': 'Africa/Johannesburg',
  'lagos': 'Africa/Lagos',
  'cairo': 'Africa/Cairo',
};

/**
 * Extract timezone from prospect location
 * Supports formats like "City, Country" or just "City"
 * Falls back to UTC if location not found
 */
export function getTimezoneFromLocation(location: string | null | undefined): string {
  if (!location) return 'UTC';

  const normalized = location.toLowerCase().trim();

  // Try exact match first
  if (LOCATION_TO_TIMEZONE[normalized]) {
    return LOCATION_TO_TIMEZONE[normalized];
  }

  // Try first part (before comma) if format is "City, Country"
  const city = normalized.split(',')[0].trim();
  if (LOCATION_TO_TIMEZONE[city]) {
    return LOCATION_TO_TIMEZONE[city];
  }

  // If not found, default to UTC
  console.warn(`⚠️ Could not determine timezone for location: ${location}`);
  return 'UTC';
}

/**
 * Check if a date is a weekend in the given timezone
 */
export function isWeekendInTimezone(date: Date, timezone: string): boolean {
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: timezone
  });

  const dayOfWeek = formatter.format(date);
  return dayOfWeek === 'Sat' || dayOfWeek === 'Fri';
}

/**
 * Check if a time is outside business hours (9 AM - 6 PM) in the given timezone
 */
export function isOutsideBusinessHours(date: Date, timezone: string): boolean {
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hour12: false,
    timeZone: timezone
  });

  const hourString = formatter.format(date);
  const hour = parseInt(hourString, 10);

  // Business hours: 9 AM (09:00) to 6 PM (18:00)
  return hour < 9 || hour >= 18;
}

/**
 * Get next business day at 9 AM in recipient's timezone, converted to UTC
 */
export function getNextBusinessDayAt9AM(currentDate: Date, timezone: string): Date {
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: timezone
  });

  const parts = formatter.formatToParts(currentDate);
  const partsMap = Object.fromEntries(parts.map(p => [p.type, p.value]));

  // Start with tomorrow at 9 AM in recipient's timezone
  let nextDay = new Date(currentDate);
  nextDay.setDate(nextDay.getDate() + 1);

  // Convert to recipient's timezone representation
  let nextDayLocal = new Date(nextDay);

  // Keep moving forward until we find a weekday
  while (isWeekendInTimezone(nextDayLocal, timezone)) {
    nextDayLocal.setDate(nextDayLocal.getDate() + 1);
  }

  // Set to 9 AM in recipient's timezone
  return setTimeInTimezone(nextDayLocal, 9, 0, 0, timezone);
}

/**
 * Get next Monday at 9 AM in recipient's timezone, converted to UTC
 */
export function getNextMonday9AM(currentDate: Date, timezone: string): Date {
  const nextDay = new Date(currentDate);

  // Find next Monday
  while (true) {
    nextDay.setDate(nextDay.getDate() + 1);
    if (!isWeekendInTimezone(nextDay, timezone)) {
      break;
    }
  }

  return setTimeInTimezone(nextDay, 9, 0, 0, timezone);
}

/**
 * Set a specific time in a timezone (returns UTC equivalent)
 * This is tricky because we need to set local time in a timezone then convert to UTC
 */
export function setTimeInTimezone(
  date: Date,
  hours: number,
  minutes: number,
  seconds: number,
  timezone: string
): Date {
  // Create a formatter to get the current offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: timezone
  });

  // Get parts in the target timezone
  const parts = formatter.formatToParts(date);
  const partsMap = Object.fromEntries(parts.map(p => [p.type, p.value]));

  // Create a local date with the timezone's current date
  const localYear = parseInt(partsMap.year);
  const localMonth = parseInt(partsMap.month) - 1; // JS months are 0-indexed
  const localDay = parseInt(partsMap.day);

  // Create UTC date that represents the local time in the timezone
  const baseDate = new Date(Date.UTC(localYear, localMonth, localDay, hours, minutes, seconds));

  // Get the offset by comparing UTC with timezone
  const utcFormatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC'
  });

  const tzFormatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone
  });

  const utcParts = Object.fromEntries(utcFormatter.formatToParts(baseDate).map(p => [p.type, p.value]));
  const tzParts = Object.fromEntries(tzFormatter.formatToParts(baseDate).map(p => [p.type, p.value]));

  const utcHours = parseInt(utcParts.hour);
  const tzHours = parseInt(tzParts.hour);
  const hourDiff = utcHours - tzHours;

  const result = new Date(baseDate);
  result.setHours(result.getHours() + hourDiff);

  return result;
}

/**
 * Calculate optimal scheduling for emails in recipient's timezone
 * Spreads N emails across 9 AM - 6 PM business hours
 */
export function calculateEmailSchedules(
  startTime: Date,
  recipientCount: number,
  recipientTimezones: string[],
  emailsPerDay: number = 40
): Array<{ index: number; scheduledFor: Date; timezone: string }> {
  const businessHoursPerDay = 9; // 9 AM to 6 PM = 9 hours
  const minutesBetweenEmails = (businessHoursPerDay * 60) / emailsPerDay;

  const schedules = recipientTimezones.map((timezone, index) => {
    let scheduled = new Date(startTime);
    scheduled.setMinutes(scheduled.getMinutes() + index * minutesBetweenEmails);

    // Adjust for timezone and business hours
    if (isWeekendInTimezone(scheduled, timezone)) {
      scheduled = getNextMonday9AM(scheduled, timezone);
    } else if (isOutsideBusinessHours(scheduled, timezone)) {
      scheduled = getNextBusinessDayAt9AM(scheduled, timezone);
    }

    return {
      index,
      scheduledFor: scheduled,
      timezone
    };
  });

  return schedules;
}

/**
 * Format a date in a specific timezone for display
 */
export function formatDateInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: timezone
  });

  return formatter.format(date);
}
