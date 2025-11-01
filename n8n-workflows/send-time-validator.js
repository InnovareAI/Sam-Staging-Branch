/**
 * N8N Send Time Validator
 * Validates if a message can be sent based on:
 * - Timezone (8am-6pm local time)
 * - Weekends (no Saturday/Sunday sends)
 * - Public holidays (country-specific)
 * - Reply status (stop if prospect replied)
 *
 * Usage in N8N Code node:
 * const validator = new SendTimeValidator($input.item.json);
 * const result = await validator.canSendNow();
 * if (!result.can_send) {
 *   return [{ json: { ...result, action: 'reschedule' } }];
 * }
 */

class SendTimeValidator {
  constructor(prospectData) {
    this.prospect = prospectData.prospect || {};
    this.timezone = prospectData.prospect?.timezone || 'America/New_York'; // Default
    this.country = prospectData.prospect?.country || 'US';
    this.status = prospectData.prospect?.status;

    // Business hours configuration
    this.BUSINESS_HOURS = {
      start: 8,  // 8am
      end: 18    // 6pm
    };

    // Public holidays by country (2025)
    this.HOLIDAYS = {
      US: [
        '2025-01-01', // New Year's Day
        '2025-01-20', // MLK Day
        '2025-02-17', // Presidents Day
        '2025-05-26', // Memorial Day
        '2025-07-04', // Independence Day
        '2025-09-01', // Labor Day
        '2025-11-27', // Thanksgiving
        '2025-12-25', // Christmas
      ],
      FR: [ // France
        '2025-01-01', // New Year's Day
        '2025-04-21', // Easter Monday
        '2025-05-01', // Labor Day
        '2025-05-08', // Victory Day
        '2025-05-29', // Ascension Day
        '2025-06-09', // Whit Monday
        '2025-07-14', // Bastille Day
        '2025-08-15', // Assumption
        '2025-11-01', // All Saints
        '2025-11-11', // Armistice Day
        '2025-12-25', // Christmas
      ],
      GB: [ // United Kingdom
        '2025-01-01', // New Year's Day
        '2025-04-18', // Good Friday
        '2025-04-21', // Easter Monday
        '2025-05-05', // Early May Bank Holiday
        '2025-05-26', // Spring Bank Holiday
        '2025-08-25', // Summer Bank Holiday
        '2025-12-25', // Christmas
        '2025-12-26', // Boxing Day
      ],
      DE: [ // Germany
        '2025-01-01', // New Year's Day
        '2025-04-18', // Good Friday
        '2025-04-21', // Easter Monday
        '2025-05-01', // Labor Day
        '2025-05-29', // Ascension Day
        '2025-06-09', // Whit Monday
        '2025-10-03', // German Unity Day
        '2025-12-25', // Christmas
        '2025-12-26', // Boxing Day
      ],
      CA: [ // Canada
        '2025-01-01', // New Year's Day
        '2025-02-17', // Family Day
        '2025-04-18', // Good Friday
        '2025-05-19', // Victoria Day
        '2025-07-01', // Canada Day
        '2025-08-04', // Civic Holiday
        '2025-09-01', // Labor Day
        '2025-10-13', // Thanksgiving
        '2025-12-25', // Christmas
        '2025-12-26', // Boxing Day
      ]
    };
  }

  /**
   * Main validation method
   */
  async canSendNow() {
    // 1. Check if prospect has replied
    if (this.status === 'replied') {
      return {
        can_send: false,
        reason: 'prospect_replied',
        next_action: 'end_sequence',
        message: 'Prospect has replied - stopping follow-up sequence'
      };
    }

    // 2. Get current time in prospect's timezone
    const now = new Date();
    const localTime = this.getLocalTime(now, this.timezone);

    // 3. Check if weekend
    if (this.isWeekend(localTime)) {
      const nextBusinessDay = this.getNextBusinessDay(localTime);
      return {
        can_send: false,
        reason: 'weekend',
        next_action: 'reschedule',
        reschedule_to: nextBusinessDay.toISOString(),
        message: `Weekend in ${this.timezone} - rescheduling to next business day`
      };
    }

    // 4. Check if public holiday
    if (this.isPublicHoliday(localTime, this.country)) {
      const nextBusinessDay = this.getNextBusinessDay(localTime);
      return {
        can_send: false,
        reason: 'public_holiday',
        next_action: 'reschedule',
        reschedule_to: nextBusinessDay.toISOString(),
        message: `Public holiday in ${this.country} - rescheduling to next business day`
      };
    }

    // 5. Check if within business hours
    const hour = localTime.getHours();
    if (hour < this.BUSINESS_HOURS.start || hour >= this.BUSINESS_HOURS.end) {
      const nextBusinessHour = this.getNextBusinessHour(localTime);
      return {
        can_send: false,
        reason: 'outside_business_hours',
        next_action: 'reschedule',
        reschedule_to: nextBusinessHour.toISOString(),
        message: `Outside business hours (${hour}:00 local) - rescheduling to ${this.BUSINESS_HOURS.start}:00`
      };
    }

    // All checks passed!
    return {
      can_send: true,
      reason: 'valid_send_time',
      next_action: 'send',
      local_time: localTime.toISOString(),
      message: `Valid send time in ${this.timezone} (${hour}:00 local)`
    };
  }

  /**
   * Get local time in prospect's timezone
   */
  getLocalTime(date, timezone) {
    return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  }

  /**
   * Check if date is weekend
   */
  isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  /**
   * Check if date is public holiday
   */
  isPublicHoliday(date, country) {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const holidays = this.HOLIDAYS[country] || [];
    return holidays.includes(dateStr);
  }

  /**
   * Get next business day (skip weekends and holidays)
   */
  getNextBusinessDay(fromDate) {
    let nextDay = new Date(fromDate);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(this.BUSINESS_HOURS.start, 0, 0, 0);

    // Keep incrementing until we find a valid business day
    let attempts = 0;
    while (attempts < 14) { // Max 2 weeks ahead
      if (!this.isWeekend(nextDay) && !this.isPublicHoliday(nextDay, this.country)) {
        return nextDay;
      }
      nextDay.setDate(nextDay.getDate() + 1);
      attempts++;
    }

    return nextDay; // Fallback if we can't find a business day
  }

  /**
   * Get next business hour on same day or next business day
   */
  getNextBusinessHour(fromDate) {
    const hour = fromDate.getHours();

    // If before business hours today, schedule for start of business hours
    if (hour < this.BUSINESS_HOURS.start) {
      const today = new Date(fromDate);
      today.setHours(this.BUSINESS_HOURS.start, 0, 0, 0);

      // Check if today is valid business day
      if (!this.isWeekend(today) && !this.isPublicHoliday(today, this.country)) {
        return today;
      }
    }

    // Otherwise, schedule for next business day at start of business hours
    return this.getNextBusinessDay(fromDate);
  }

  /**
   * Calculate delay in milliseconds until next valid send time
   */
  getDelayUntilNextSend(nextSendTime) {
    const now = new Date();
    const delay = new Date(nextSendTime) - now;
    return Math.max(0, delay);
  }

  /**
   * Convert delay to N8N wait format
   */
  getN8NWaitAmount(delayMs) {
    const hours = Math.ceil(delayMs / (1000 * 60 * 60));
    return {
      amount: hours,
      unit: 'hours'
    };
  }
}

// ============================================================================
// N8N Usage Example
// ============================================================================

/*
// In N8N Code Node before sending message:

const prospectData = {
  prospect: {
    id: $json.prospect.id,
    status: $json.prospect.status,
    timezone: $json.prospect.timezone || 'America/New_York',
    country: $json.prospect.country || 'US'
  }
};

const validator = new SendTimeValidator(prospectData);
const validation = await validator.canSendNow();

console.log('✓ Send time validation:', validation);

if (!validation.can_send) {
  console.log(`⏸️ Cannot send: ${validation.reason}`);
  console.log(`   Action: ${validation.next_action}`);

  if (validation.next_action === 'reschedule') {
    console.log(`   Reschedule to: ${validation.reschedule_to}`);
    const delay = validator.getDelayUntilNextSend(validation.reschedule_to);
    const waitConfig = validator.getN8NWaitAmount(delay);
    console.log(`   Wait ${waitConfig.amount} ${waitConfig.unit}`);
  }

  return [{
    json: {
      ...validation,
      prospect_id: $json.prospect.id,
      should_wait: true
    }
  }];
}

// Validation passed - proceed with sending
return [{
  json: {
    ...validation,
    prospect_id: $json.prospect.id,
    should_wait: false
  }
}];
*/

// Export for N8N
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SendTimeValidator };
}
