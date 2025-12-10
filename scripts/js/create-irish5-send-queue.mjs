#!/usr/bin/env node
/**
 * Create send queue for Irish Campaign 5
 * 50 prospects, 10/day, 30-min spacing, starting 8 AM Pacific
 */

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const CAMPAIGN_ID = '987dec20-b23d-465f-a8c7-0b9e8bac4f24';
const CONNECTION_MESSAGE = "Hi {first_name}, came across {company_name} and was curious about what you're building. Always looking to connect with early-stage founders.";

// Schedule: 10/day, 30-min spacing, 8 AM - 12:30 PM Pacific (16:00 - 20:30 UTC)
const DAILY_LIMIT = 10;
const SPACING_MINUTES = 30;
const START_HOUR_UTC = 16; // 8 AM Pacific = 16:00 UTC

async function fetchProspects() {
  const url = `${SUPABASE_URL}/rest/v1/campaign_prospects?campaign_id=eq.${CAMPAIGN_ID}&select=id,first_name,last_name,company_name,linkedin_url,status`;
  const response = await fetch(url, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`
    }
  });
  return await response.json();
}

async function createQueueItem(item) {
  const url = `${SUPABASE_URL}/rest/v1/send_queue`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(item)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create queue item: ${error}`);
  }

  return await response.json();
}

function substituteVariables(message, prospect) {
  return message
    .replace(/\{first_name\}/g, prospect.first_name || '')
    .replace(/\{last_name\}/g, prospect.last_name || '')
    .replace(/\{company_name\}/g, prospect.company_name || '');
}

function extractLinkedInId(url) {
  // Extract vanity from LinkedIn URL
  const match = url?.match(/linkedin\.com\/in\/([^\/\?#]+)/);
  return match ? match[1] : null;
}

function isWeekend(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

function getNextBusinessDay(date) {
  const result = new Date(date);
  while (isWeekend(result)) {
    result.setUTCDate(result.getUTCDate() + 1);
  }
  return result;
}

async function main() {
  console.log('=== Creating Send Queue for Irish Campaign 5 ===\n');

  const prospects = await fetchProspects();
  console.log(`Found ${prospects.length} prospects\n`);

  // Start scheduling from tomorrow 8 AM Pacific (to give time for setup)
  let currentDate = new Date();
  currentDate.setUTCDate(currentDate.getUTCDate() + 1); // Tomorrow
  currentDate.setUTCHours(START_HOUR_UTC, 0, 0, 0); // 8 AM Pacific = 16:00 UTC
  currentDate = getNextBusinessDay(currentDate);

  let dailyCount = 0;
  let totalCreated = 0;
  let errors = [];

  for (const prospect of prospects) {
    // Skip if no LinkedIn URL
    const linkedinId = extractLinkedInId(prospect.linkedin_url);
    if (!linkedinId) {
      console.log(`⚠️ Skipping ${prospect.first_name} ${prospect.last_name} - no valid LinkedIn URL`);
      continue;
    }

    // Generate personalized message
    const message = substituteVariables(CONNECTION_MESSAGE, prospect);

    // Schedule time
    const scheduledFor = new Date(currentDate);
    scheduledFor.setUTCMinutes(dailyCount * SPACING_MINUTES);

    try {
      const queueItem = {
        campaign_id: CAMPAIGN_ID,
        prospect_id: prospect.id,
        linkedin_user_id: linkedinId,
        message: message,
        scheduled_for: scheduledFor.toISOString(),
        status: 'pending'
      };

      await createQueueItem(queueItem);
      totalCreated++;
      console.log(`✅ ${totalCreated}. ${prospect.first_name} ${prospect.last_name} - ${scheduledFor.toISOString()}`);

      dailyCount++;

      // Move to next day if daily limit reached
      if (dailyCount >= DAILY_LIMIT) {
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        currentDate = getNextBusinessDay(currentDate);
        currentDate.setUTCHours(START_HOUR_UTC, 0, 0, 0);
        dailyCount = 0;
      }
    } catch (error) {
      errors.push({ prospect: `${prospect.first_name} ${prospect.last_name}`, error: error.message });
      console.log(`❌ Error for ${prospect.first_name}: ${error.message}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total created: ${totalCreated}`);
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e.prospect}: ${e.error}`));
  }
}

main().catch(console.error);
