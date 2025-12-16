/**
 * Calendly Scraper Service
 * Scrapes available slots from Calendly pages and submits bookings
 *
 * Uses Bright Data Scraping Browser (same as LinkedIn hashtag scraper)
 *
 * Created: December 16, 2025
 */

import puppeteer from 'puppeteer-core';

// ============================================
// TYPES
// ============================================

export interface CalendlySlot {
  date: string;           // "2025-12-18"
  time: string;           // "10:00"
  datetime: Date;
  duration_minutes: number;
  timezone: string;
  spots_available?: number;
}

export interface CalendlyEventInfo {
  event_name: string;     // "30 Minute Meeting"
  host_name: string;      // "John Smith"
  duration_minutes: number;
  description?: string;
  location_type?: string; // "zoom", "google_meet", "phone"
  timezone: string;
}

export interface CalendlyBookingResult {
  success: boolean;
  confirmation_id?: string;
  scheduled_at?: Date;
  meeting_link?: string;
  error?: string;
}

// ============================================
// BRIGHT DATA CONFIGURATION
// ============================================

const BRIGHT_DATA_AUTH = process.env.BRIGHT_DATA_AUTH || 'brd-customer-hl_4e98ded8-zone-sam_scraping_browser:9pdlxe2o4fhi';
const BRIGHT_DATA_HOST = 'brd.superproxy.io:9222';

async function getBrowser() {
  return puppeteer.connect({
    browserWSEndpoint: `wss://${BRIGHT_DATA_AUTH}@${BRIGHT_DATA_HOST}`,
  });
}

// ============================================
// SLOT SCRAPING
// ============================================

/**
 * Scrape available slots from a Calendly link
 */
export async function scrapeCalendlySlots(
  calendlyUrl: string,
  options?: {
    days_ahead?: number;  // How many days to look ahead (default: 14)
    timezone?: string;    // Desired timezone
  }
): Promise<{ event_info: CalendlyEventInfo; slots: CalendlySlot[] }> {
  console.log(`🔍 Scraping Calendly slots from: ${calendlyUrl}`);

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Navigate to Calendly page
    await page.goto(calendlyUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for calendar to load
    await page.waitForSelector('[data-container="calendar"]', { timeout: 10000 }).catch(() => {
      // Try alternative selector
      return page.waitForSelector('.calendar-table', { timeout: 5000 });
    });

    // Extract event info
    const eventInfo = await page.evaluate(() => {
      const nameEl = document.querySelector('[data-component="event-type-name"]') ||
                     document.querySelector('h1') ||
                     document.querySelector('[class*="event-name"]');
      const hostEl = document.querySelector('[data-component="avatar-with-name"]') ||
                     document.querySelector('[class*="host-name"]');
      const durationEl = document.querySelector('[data-component="duration"]') ||
                         document.querySelector('[class*="duration"]');
      const descEl = document.querySelector('[data-component="description"]');
      const locationEl = document.querySelector('[data-component="location"]');

      // Parse duration from text like "30 min"
      const durationText = durationEl?.textContent || '30 min';
      const durationMatch = durationText.match(/(\d+)/);
      const duration = durationMatch ? parseInt(durationMatch[1]) : 30;

      return {
        event_name: nameEl?.textContent?.trim() || 'Meeting',
        host_name: hostEl?.textContent?.trim() || 'Host',
        duration_minutes: duration,
        description: descEl?.textContent?.trim(),
        location_type: locationEl?.textContent?.toLowerCase().includes('zoom') ? 'zoom' :
                       locationEl?.textContent?.toLowerCase().includes('meet') ? 'google_meet' :
                       locationEl?.textContent?.toLowerCase().includes('phone') ? 'phone' : undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    });

    // Extract available slots
    const slots: CalendlySlot[] = [];
    const daysAhead = options?.days_ahead || 14;

    // Click through days to get slots
    for (let i = 0; i < daysAhead; i++) {
      // Find available day buttons
      const availableDays = await page.$$('[data-container="calendar"] button:not([disabled])');

      for (const dayButton of availableDays) {
        try {
          // Get date from button
          const dateAttr = await dayButton.evaluate(el => el.getAttribute('data-date') || el.getAttribute('aria-label'));
          if (!dateAttr) continue;

          // Click to reveal time slots
          await dayButton.click();
          await page.waitForTimeout(500);

          // Get time slots
          const timeSlots = await page.$$('[data-container="time-button"], [data-start-time], .time-button');

          for (const timeSlot of timeSlots) {
            const timeText = await timeSlot.evaluate(el => {
              return el.getAttribute('data-start-time') ||
                     el.textContent?.trim() ||
                     '';
            });

            if (timeText) {
              // Parse time (format: "10:00am" or "10:00")
              const timeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
              if (timeMatch) {
                let hours = parseInt(timeMatch[1]);
                const minutes = parseInt(timeMatch[2]);
                const ampm = timeMatch[3]?.toLowerCase();

                if (ampm === 'pm' && hours !== 12) hours += 12;
                if (ampm === 'am' && hours === 12) hours = 0;

                // Parse date
                const dateMatch = dateAttr.match(/(\d{4})-(\d{2})-(\d{2})/) ||
                                  dateAttr.match(/(\w+)\s+(\d+)/);

                if (dateMatch) {
                  const slotDate = dateMatch[0].includes('-')
                    ? dateMatch[0]
                    : new Date().toISOString().split('T')[0]; // Fallback to today

                  const datetime = new Date(`${slotDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);

                  slots.push({
                    date: slotDate,
                    time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
                    datetime,
                    duration_minutes: eventInfo.duration_minutes,
                    timezone: options?.timezone || eventInfo.timezone,
                  });
                }
              }
            }
          }
        } catch (e) {
          // Continue to next day
        }
      }

      // Try to go to next week if needed
      const nextButton = await page.$('[data-container="next-month-button"], .next-month, [aria-label*="Next"]');
      if (nextButton && i % 7 === 6) {
        await nextButton.click();
        await page.waitForTimeout(1000);
      }
    }

    // Deduplicate slots
    const uniqueSlots = slots.filter((slot, index, self) =>
      index === self.findIndex(s => s.datetime.getTime() === slot.datetime.getTime())
    );

    console.log(`✅ Found ${uniqueSlots.length} available slots`);

    return {
      event_info: eventInfo,
      slots: uniqueSlots.sort((a, b) => a.datetime.getTime() - b.datetime.getTime()),
    };

  } finally {
    await page.close();
    await browser.close();
  }
}

// ============================================
// BOOKING SUBMISSION
// ============================================

/**
 * Book a slot on Calendly
 */
export async function bookCalendlySlot(
  calendlyUrl: string,
  slot: CalendlySlot,
  booker: {
    name: string;
    email: string;
    phone?: string;
    notes?: string;
  }
): Promise<CalendlyBookingResult> {
  console.log(`📅 Booking Calendly slot: ${slot.date} ${slot.time} for ${booker.name}`);

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Navigate to Calendly page
    await page.goto(calendlyUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for calendar
    await page.waitForSelector('[data-container="calendar"]', { timeout: 10000 });

    // Find and click the date
    const dateSelector = `[data-date="${slot.date}"], [aria-label*="${slot.date}"]`;
    await page.waitForSelector(dateSelector, { timeout: 5000 });
    await page.click(dateSelector);
    await page.waitForTimeout(500);

    // Find and click the time slot
    const timeSelector = `[data-start-time="${slot.time}"], [data-start-time="${slot.time}:00"]`;
    const timeButton = await page.$(timeSelector) ||
                       await page.$(`button:has-text("${slot.time}")`);

    if (!timeButton) {
      throw new Error(`Time slot ${slot.time} not found`);
    }

    await timeButton.click();
    await page.waitForTimeout(500);

    // Click "Confirm" or "Next" button
    const confirmButton = await page.$('[data-container="confirm-button"], button[type="submit"], .confirm-button');
    if (confirmButton) {
      await confirmButton.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
    }

    // Fill in booking form
    await page.waitForSelector('input[name="name"], input[name="full_name"], #name', { timeout: 5000 });

    // Name field
    const nameInput = await page.$('input[name="name"], input[name="full_name"], #name');
    if (nameInput) {
      await nameInput.type(booker.name, { delay: 50 });
    }

    // Email field
    const emailInput = await page.$('input[name="email"], input[type="email"], #email');
    if (emailInput) {
      await emailInput.type(booker.email, { delay: 50 });
    }

    // Phone field (if exists and provided)
    if (booker.phone) {
      const phoneInput = await page.$('input[name="phone"], input[type="tel"], #phone');
      if (phoneInput) {
        await phoneInput.type(booker.phone, { delay: 50 });
      }
    }

    // Notes field (if exists and provided)
    if (booker.notes) {
      const notesInput = await page.$('textarea[name="notes"], textarea[name="message"], #notes, textarea');
      if (notesInput) {
        await notesInput.type(booker.notes, { delay: 30 });
      }
    }

    // Submit the form
    const submitButton = await page.$('button[type="submit"], [data-container="submit-button"], .submit-button');
    if (submitButton) {
      await submitButton.click();
    }

    // Wait for confirmation page
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Check for success
    const currentUrl = page.url();
    const pageContent = await page.content();

    const isSuccess = currentUrl.includes('confirmation') ||
                      currentUrl.includes('confirmed') ||
                      currentUrl.includes('scheduled') ||
                      pageContent.includes('confirmed') ||
                      pageContent.includes('You are scheduled') ||
                      pageContent.includes('Booking confirmed');

    if (isSuccess) {
      // Try to extract meeting link
      const meetingLink = await page.evaluate(() => {
        const linkEl = document.querySelector('a[href*="zoom"], a[href*="meet.google"], a[href*="teams"]');
        return linkEl?.getAttribute('href') || null;
      });

      // Try to extract confirmation ID from URL or page
      const confirmationId = currentUrl.match(/confirmation[_-]?id[=\/]([^&\/]+)/i)?.[1] ||
                             `cal_${Date.now()}`;

      console.log(`✅ Booking successful! Confirmation: ${confirmationId}`);

      return {
        success: true,
        confirmation_id: confirmationId,
        scheduled_at: slot.datetime,
        meeting_link: meetingLink || undefined,
      };
    } else {
      // Check for error messages
      const errorMessage = await page.evaluate(() => {
        const errorEl = document.querySelector('[role="alert"], .error, .error-message');
        return errorEl?.textContent?.trim() || null;
      });

      throw new Error(errorMessage || 'Booking submission failed - no confirmation received');
    }

  } catch (error: any) {
    console.error(`❌ Booking failed:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  } finally {
    await page.close();
    await browser.close();
  }
}

// ============================================
// CAL.COM SUPPORT
// ============================================

/**
 * Scrape available slots from Cal.com
 * Cal.com has a similar structure to Calendly
 */
export async function scrapeCalComSlots(
  calcomUrl: string,
  options?: { days_ahead?: number; timezone?: string }
): Promise<{ event_info: CalendlyEventInfo; slots: CalendlySlot[] }> {
  // Cal.com uses similar DOM structure, reuse Calendly logic with minor adjustments
  console.log(`🔍 Scraping Cal.com slots from: ${calcomUrl}`);

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(calcomUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Cal.com specific selectors
    await page.waitForSelector('[data-testid="calendar"]', { timeout: 10000 }).catch(() => {
      return page.waitForSelector('.react-calendar', { timeout: 5000 });
    });

    // Extract event info
    const eventInfo = await page.evaluate(() => {
      const titleEl = document.querySelector('h1, [data-testid="event-title"]');
      const durationEl = document.querySelector('[data-testid="event-duration"]');

      const durationText = durationEl?.textContent || '30';
      const duration = parseInt(durationText.match(/\d+/)?.[0] || '30');

      return {
        event_name: titleEl?.textContent?.trim() || 'Meeting',
        host_name: 'Host',
        duration_minutes: duration,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    });

    // Extract slots (Cal.com shows them differently)
    const slots: CalendlySlot[] = [];

    // Get available dates
    const availableDates = await page.$$('[data-testid="day"]:not([data-disabled="true"])');

    for (const dateEl of availableDates.slice(0, options?.days_ahead || 14)) {
      try {
        await dateEl.click();
        await page.waitForTimeout(500);

        // Get time slots
        const timeButtons = await page.$$('[data-testid="time"]');

        for (const timeBtn of timeButtons) {
          const timeText = await timeBtn.evaluate(el => el.textContent?.trim());
          const dateText = await page.$eval('[data-testid="selected-date"]', el => el.textContent?.trim()).catch(() => '');

          if (timeText && dateText) {
            // Parse and add slot
            const timeMatch = timeText.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) {
              const datetime = new Date(); // Would need proper date parsing
              slots.push({
                date: dateText,
                time: timeText,
                datetime,
                duration_minutes: eventInfo.duration_minutes,
                timezone: eventInfo.timezone,
              });
            }
          }
        }
      } catch (e) {
        continue;
      }
    }

    return { event_info: eventInfo, slots };

  } finally {
    await page.close();
    await browser.close();
  }
}

// ============================================
// UNIFIED INTERFACE
// ============================================

/**
 * Scrape slots from any supported booking platform
 */
export async function scrapeBookingSlots(
  bookingUrl: string,
  options?: { days_ahead?: number; timezone?: string }
): Promise<{ event_info: CalendlyEventInfo; slots: CalendlySlot[] }> {
  if (bookingUrl.includes('calendly.com')) {
    return scrapeCalendlySlots(bookingUrl, options);
  } else if (bookingUrl.includes('cal.com')) {
    return scrapeCalComSlots(bookingUrl, options);
  } else {
    throw new Error(`Unsupported booking platform: ${bookingUrl}`);
  }
}

/**
 * Book a slot on any supported platform
 */
export async function bookSlot(
  bookingUrl: string,
  slot: CalendlySlot,
  booker: { name: string; email: string; phone?: string; notes?: string }
): Promise<CalendlyBookingResult> {
  if (bookingUrl.includes('calendly.com')) {
    return bookCalendlySlot(bookingUrl, slot, booker);
  } else {
    // For other platforms, return error for now
    return {
      success: false,
      error: 'Automatic booking not supported for this platform. Please book manually.',
    };
  }
}

export default {
  scrapeCalendlySlots,
  scrapeCalComSlots,
  scrapeBookingSlots,
  bookCalendlySlot,
  bookSlot,
};
