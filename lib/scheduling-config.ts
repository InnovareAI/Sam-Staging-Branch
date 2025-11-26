/**
 * Centralized Scheduling Configuration
 *
 * Contains all timezone, business hours, and holiday settings
 * used across campaign execution and cron jobs.
 */

import moment from 'moment-timezone';

// Type definitions
export interface ScheduleSettings {
  timezone?: string;
  working_hours_start?: number;
  working_hours_end?: number;
  skip_weekends?: boolean;
  skip_holidays?: boolean;
}

export interface BusinessHours {
  start: number;
  end: number;
}

// Default timezone (can be overridden per workspace)
export const DEFAULT_TIMEZONE = 'America/New_York';

// Business hours configuration
export const BUSINESS_HOURS = {
  start: 8,  // 8 AM
  end: 17,   // 5 PM (exclusive)
};

// Follow-up business hours (slightly wider)
export const FOLLOW_UP_HOURS = {
  start: 7,  // 7 AM
  end: 18,   // 6 PM (exclusive)
};

// US Public Holidays (2025-2026)
export const PUBLIC_HOLIDAYS = [
  '2025-01-01', // New Year's Day
  '2025-01-20', // MLK Jr. Day
  '2025-02-17', // Presidents' Day
  '2025-05-26', // Memorial Day
  '2025-06-19', // Juneteenth
  '2025-07-04', // Independence Day
  '2025-09-01', // Labor Day
  '2025-10-13', // Columbus Day
  '2025-11-11', // Veterans Day
  '2025-11-27', // Thanksgiving
  '2025-12-25', // Christmas
  '2026-01-01', // New Year's Day
  '2026-01-19', // MLK Jr. Day
  '2026-02-16', // Presidents' Day
];

// Email sending limits
export const EMAIL_LIMITS = {
  dailyMax: 40,
  intervalMinutes: 13.5, // 40 emails over 9 hours
};

// LinkedIn sending limits
export const LINKEDIN_LIMITS = {
  dailyConnectionRequests: 20,
  weeklyConnectionRequests: 100,
  intervalMinutes: 30,
};

/**
 * Check if current time is during business hours
 */
export function isBusinessHours(
  timezone: string = DEFAULT_TIMEZONE,
  hours: { start: number; end: number } = BUSINESS_HOURS
): boolean {
  const now = moment().tz(timezone);
  const hour = now.hour();
  return hour >= hours.start && hour < hours.end;
}

/**
 * Check if current day is a weekend
 */
export function isWeekend(timezone: string = DEFAULT_TIMEZONE): boolean {
  const now = moment().tz(timezone);
  const day = now.day(); // 0=Sun, 6=Sat
  return day === 0 || day === 6;
}

/**
 * Check if current day is a public holiday
 */
export function isHoliday(timezone: string = DEFAULT_TIMEZONE): boolean {
  const now = moment().tz(timezone);
  const dateStr = now.format('YYYY-MM-DD');
  return PUBLIC_HOLIDAYS.includes(dateStr);
}

/**
 * Check if we can send messages now (business hours, not weekend/holiday)
 */
export function canSendNow(
  timezone: string = DEFAULT_TIMEZONE,
  hours: { start: number; end: number } = BUSINESS_HOURS
): { canSend: boolean; reason?: string } {
  const now = moment().tz(timezone);

  // Check weekend
  if (isWeekend(timezone)) {
    return {
      canSend: false,
      reason: `Weekend - no messages sent (${now.format('llll')})`
    };
  }

  // Check holiday
  if (isHoliday(timezone)) {
    return {
      canSend: false,
      reason: `Holiday (${now.format('YYYY-MM-DD')}) - no messages sent`
    };
  }

  // Check business hours
  if (!isBusinessHours(timezone, hours)) {
    return {
      canSend: false,
      reason: `Outside business hours (${now.hour()}:00) - no messages sent`
    };
  }

  return { canSend: true };
}

/**
 * Get next available business day at specified hour
 */
export function getNextBusinessDay(
  daysToAdd: number = 1,
  targetHour: number = BUSINESS_HOURS.start,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  let nextDay = moment().tz(timezone);
  nextDay.add(daysToAdd, 'days');
  nextDay.hour(targetHour).minute(0).second(0).millisecond(0);

  // Keep advancing until we find a business day
  while (true) {
    const dayOfWeek = nextDay.day();
    const dateStr = nextDay.format('YYYY-MM-DD');

    // Check if weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      nextDay.add(1, 'day');
      continue;
    }

    // Check if public holiday
    if (PUBLIC_HOLIDAYS.includes(dateStr)) {
      nextDay.add(1, 'day');
      continue;
    }

    // Found a business day!
    break;
  }

  return nextDay.toDate();
}

/**
 * Calculate scheduled send time for a prospect in a queue
 * Spaces messages at the specified interval, respecting business hours
 */
export function calculateScheduledTime(
  baseTime: Date,
  prospectIndex: number,
  intervalMinutes: number = EMAIL_LIMITS.intervalMinutes,
  timezone: string = DEFAULT_TIMEZONE,
  hours: { start: number; end: number } = BUSINESS_HOURS
): Date {
  let scheduledTime = moment(baseTime).tz(timezone);

  // Set to start of business hours if before
  if (scheduledTime.hour() < hours.start) {
    scheduledTime.hour(hours.start).minute(0).second(0);
  }

  // Add interval for this prospect
  scheduledTime.add(prospectIndex * intervalMinutes, 'minutes');

  // Skip weekends and holidays, respect business hours
  while (true) {
    const dayOfWeek = scheduledTime.day();
    const dateStr = scheduledTime.format('YYYY-MM-DD');

    // Check weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 2;
      scheduledTime.add(daysUntilMonday, 'days').hour(hours.start).minute(0).second(0);
      continue;
    }

    // Check holiday
    if (PUBLIC_HOLIDAYS.includes(dateStr)) {
      scheduledTime.add(1, 'day').hour(hours.start).minute(0).second(0);
      continue;
    }

    // Check if past business hours
    if (scheduledTime.hour() >= hours.end) {
      scheduledTime.add(1, 'day').hour(hours.start).minute(0).second(0);
      continue;
    }

    // Valid time found
    break;
  }

  return scheduledTime.toDate();
}

/**
 * Get smart first follow-up time (1-2hrs if in business hours, else next business day)
 */
export function getSmartFollowUpTime(
  timezone: string = DEFAULT_TIMEZONE,
  hours: { start: number; end: number } = FOLLOW_UP_HOURS
): Date {
  const now = moment().tz(timezone);
  const { canSend } = canSendNow(timezone, hours);

  if (canSend) {
    // We're in business hours - send in 1-2 hours
    const followUpTime = moment().tz(timezone);
    const randomMinutes = 60 + Math.floor(Math.random() * 60); // 60-120 minutes
    followUpTime.add(randomMinutes, 'minutes');

    // But don't go past business hours - if we would, schedule for next business day
    if (followUpTime.hour() >= hours.end) {
      return getNextBusinessDay(1, hours.start, timezone);
    }

    return followUpTime.toDate();
  } else {
    // Outside business hours - next business day
    return getNextBusinessDay(1, hours.start, timezone);
  }
}
