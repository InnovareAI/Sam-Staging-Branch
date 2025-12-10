#!/usr/bin/env node

/**
 * Reschedule Asphericon queue - spread 30 messages/day over business hours
 *
 * Strategy: 30 CRs/day, 11 hours of business hours (7am-6pm) = 1 CR every 22 minutes
 * Actually using 20 min spacing for buffer
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const CAMPAIGN_ID = 'd7ced167-e7e7-42f2-ba12-dc3bb2d29cfc';
const SPACING_MINUTES = 20; // 20 minutes between CRs
const BUSINESS_START = 7;   // 7 AM Berlin
const BUSINESS_END = 17;    // 5 PM Berlin (allows last CR at 5pm, done by 5:20)
const MESSAGES_PER_DAY = 30;

// German holidays 2024-2025 (dates in YYYY-MM-DD format)
const HOLIDAYS = new Set([
  '2024-12-25', '2024-12-26', // Christmas
  '2025-01-01',               // New Year
  '2025-04-18', '2025-04-21', // Easter
  '2025-05-01',               // Labor Day
  '2025-05-29',               // Ascension
  '2025-06-09',               // Whit Monday
  '2025-10-03',               // German Unity Day
  '2025-12-25', '2025-12-26', // Christmas 2025
]);

function isHoliday(dateStr) {
  return HOLIDAYS.has(dateStr);
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function formatDateYYYYMMDD(date) {
  return date.toISOString().split('T')[0];
}

// Get Berlin time from UTC
function getBerlinHour(utcDate) {
  // Berlin is UTC+1 in winter, UTC+2 in summer (simplified: use +1 for now)
  const berlinOffset = 1; // hours
  return (utcDate.getUTCHours() + berlinOffset) % 24;
}

// Create a UTC time that corresponds to Berlin business hours
function createBerlinBusinessTime(year, month, day, hour, minute = 0) {
  // Berlin is UTC+1, so subtract 1 hour to get UTC
  const utcHour = hour - 1;
  return new Date(Date.UTC(year, month, day, utcHour, minute, 0, 0));
}

async function main() {
  console.log('🗓️ Rescheduling Asphericon queue with 20-minute spacing (30/day)...\n');

  // Get all pending queue items
  const { data: queueItems, error } = await supabase
    .from('send_queue')
    .select('id, scheduled_for')
    .eq('campaign_id', CAMPAIGN_ID)
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: true });

  if (error) {
    console.error('Error fetching queue:', error);
    return;
  }

  console.log(`📊 Found ${queueItems.length} pending messages to reschedule\n`);

  // Start scheduling from tomorrow morning Berlin time
  const now = new Date();
  let currentDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Start from today if we're still within business hours, otherwise tomorrow
  const berlinHourNow = getBerlinHour(now);
  if (berlinHourNow >= BUSINESS_END || isWeekend(currentDate) || isHoliday(formatDateYYYYMMDD(currentDate))) {
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  // Skip to next business day
  while (isWeekend(currentDate) || isHoliday(formatDateYYYYMMDD(currentDate))) {
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  const updates = [];
  let messagesThisDay = 0;
  let currentHour = BUSINESS_START;
  let currentMinute = 0;

  // If starting today and within business hours, start from current time
  if (formatDateYYYYMMDD(currentDate) === formatDateYYYYMMDD(now)) {
    currentHour = Math.max(BUSINESS_START, berlinHourNow);
    currentMinute = now.getUTCMinutes();
  }

  for (const item of queueItems) {
    // Check if we need to move to next day
    if (messagesThisDay >= MESSAGES_PER_DAY || currentHour >= BUSINESS_END) {
      // Move to next day
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);

      // Skip weekends and holidays
      while (isWeekend(currentDate) || isHoliday(formatDateYYYYMMDD(currentDate))) {
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }

      messagesThisDay = 0;
      currentHour = BUSINESS_START;
      currentMinute = 0;
    }

    // Create the scheduled time
    const scheduledTime = createBerlinBusinessTime(
      currentDate.getUTCFullYear(),
      currentDate.getUTCMonth(),
      currentDate.getUTCDate(),
      currentHour,
      currentMinute
    );

    updates.push({
      id: item.id,
      scheduled_for: scheduledTime.toISOString()
    });

    // Advance time
    currentMinute += SPACING_MINUTES;
    while (currentMinute >= 60) {
      currentMinute -= 60;
      currentHour++;
    }
    messagesThisDay++;
  }

  console.log(`📅 Schedule Summary:`);
  console.log(`   First message: ${updates[0]?.scheduled_for}`);
  console.log(`   Last message: ${updates[updates.length - 1]?.scheduled_for}`);

  // Count messages per day
  const perDay = {};
  updates.forEach(u => {
    const day = u.scheduled_for.split('T')[0];
    perDay[day] = (perDay[day] || 0) + 1;
  });

  console.log(`\n📊 Messages per day:`);
  Object.entries(perDay).sort().forEach(([day, count]) => {
    const d = new Date(day);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    console.log(`   ${day} (${dayName}): ${count} messages`);
  });

  // Update in batches
  console.log(`\n🔄 Updating ${updates.length} queue entries...`);

  const BATCH_SIZE = 50;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);

    for (const update of batch) {
      const { error: updateError } = await supabase
        .from('send_queue')
        .update({ scheduled_for: update.scheduled_for })
        .eq('id', update.id);

      if (updateError) {
        console.error(`Error updating ${update.id}:`, updateError);
      }
    }

    console.log(`   Updated ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length}`);
  }

  console.log(`\n✅ Queue rescheduled!`);
  console.log(`   Total: ${updates.length} messages`);
  console.log(`   Spacing: ${SPACING_MINUTES} minutes`);
  console.log(`   Daily limit: ${MESSAGES_PER_DAY}`);
  console.log(`   Business hours: ${BUSINESS_START}:00 - ${BUSINESS_END}:00 Berlin time`);
}

main().catch(console.error);
