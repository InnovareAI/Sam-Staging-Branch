/**
 * Polling-based Connection Acceptance Checker
 *
 * Polls for accepted LinkedIn connections using network_distance
 * This is a BACKUP to the webhook system (primary method)
 *
 * STRATEGY (Nov 23, 2025):
 * - PRIMARY: Unipile webhook (/api/webhooks/unipile) - up to 8-hour delay but no detection risk
 * - BACKUP: This polling cron - 3-4 times/day catches missed webhooks
 * - PROTECTION: Optimistic locking (connection_accepted_at IS NULL) prevents duplicates
 *
 * Schedule: 3-4 times per day with random delays (per Unipile recommendations)
 *
 * Best practices from Unipile:
 * - Space out checks only few times per day with random delay
 * - Check network_distance === 'FIRST_DEGREE' for acceptance
 * - Avoid fixed timing to prevent anti-automation detection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 300; // 5 minutes

// Unipile REST API configuration
const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

async function unipileRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${UNIPILE_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.title || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Calculate next business day at 9 AM local time
 * Skips weekends and public holidays
 */
function getNextBusinessDay(daysToAdd: number = 1): Date {
  const PUBLIC_HOLIDAYS = [
    '2025-01-01', '2025-01-20', '2025-02-17', '2025-03-17',
    '2025-05-26', '2025-06-19', '2025-07-04', '2025-09-01',
    '2025-10-13', '2025-11-11', '2025-11-27', '2025-12-25',
    '2026-01-01', '2026-01-19'
  ];

  let nextDay = new Date();
  nextDay.setDate(nextDay.getDate() + daysToAdd);
  nextDay.setHours(9, 0, 0, 0); // Set to 9 AM

  // Keep advancing until we find a business day
  while (true) {
    const dayOfWeek = nextDay.getDay(); // 0 = Sunday, 6 = Saturday
    const dateStr = nextDay.toISOString().split('T')[0];

    // Check if weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      nextDay.setDate(nextDay.getDate() + 1);
      continue;
    }

    // Check if public holiday
    if (PUBLIC_HOLIDAYS.includes(dateStr)) {
      nextDay.setDate(nextDay.getDate() + 1);
      continue;
    }

    // Found a business day!
    break;
  }

  return nextDay;
}

/**
 * Calculate first follow-up time with smart scheduling:
 * - If currently in business hours (9 AM - 5 PM, Mon-Fri): Send in 1-2 hours
 * - If outside business hours or weekend: Next business day at 9 AM
 */
function getFirstFollowUpTime(): Date {
  const now = new Date();
  const currentHour = now.getHours();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  const dateStr = now.toISOString().split('T')[0];

  const PUBLIC_HOLIDAYS = [
    '2025-01-01', '2025-01-20', '2025-02-17', '2025-03-17',
    '2025-05-26', '2025-06-19', '2025-07-04', '2025-09-01',
    '2025-10-13', '2025-11-11', '2025-11-27', '2025-12-25',
    '2026-01-01', '2026-01-19'
  ];

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isHoliday = PUBLIC_HOLIDAYS.includes(dateStr);
  const inBusinessHours = currentHour >= 9 && currentHour < 17; // 9 AM - 5 PM

  if (!isWeekend && !isHoliday && inBusinessHours) {
    // We're in business hours - send in 1-2 hours
    const followUpTime = new Date();
    const randomMinutes = 60 + Math.floor(Math.random() * 60); // 60-120 minutes
    followUpTime.setMinutes(followUpTime.getMinutes() + randomMinutes);

    // But don't go past 5 PM - if we would, schedule for next business day 9 AM
    if (followUpTime.getHours() >= 17) {
      return getNextBusinessDay(1);
    }

    return followUpTime;
  } else {
    // Outside business hours, weekend, or holiday - next business day at 9 AM
    return getNextBusinessDay(1);
  }
}

/**
 * Follow-up sequence timing:
 * FU1: Next business day after acceptance
 * FU2: 3 days after FU1
 * FU3: 5 days after FU2
 * FU4: 5 days after FU3
 * FU5: 3 days after FU4
 * GB:  3 days after FU5 (goodbye message)
 */
function getFollowUpSchedule(): Date[] {
  return [
    getNextBusinessDay(1),          // FU1: Next business day
    getNextBusinessDay(1 + 3),      // FU2: 3 days later
    getNextBusinessDay(1 + 3 + 5),  // FU3: 5 days later
    getNextBusinessDay(1 + 3 + 5 + 5),      // FU4: 5 days later
    getNextBusinessDay(1 + 3 + 5 + 5 + 3),  // FU5: 3 days later
    getNextBusinessDay(1 + 3 + 5 + 5 + 3 + 3) // GB: 3 days later
  ];
}

export async function POST(req: NextRequest) {
  try {
    // Security check - verify cron secret
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      console.warn('⚠️  Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Polling for accepted LinkedIn connections...');

    // Add random delay (0-10 minutes) to avoid fixed timing
    const randomDelay = Math.floor(Math.random() * 10 * 60 * 1000);
    console.log(`⏱️  Adding ${Math.floor(randomDelay / 1000)}s random delay...`);
    await new Promise(resolve => setTimeout(resolve, randomDelay));

    // Find prospects with pending connection requests
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select(`
        *,
        campaigns!inner (
          id,
          campaign_name,
          linkedin_account_id,
          workspace_accounts!linkedin_account_id (
            unipile_account_id,
            account_name
          )
        )
      `)
      .eq('status', 'connection_request_sent')
      .is('connection_accepted_at', null)
      .not('linkedin_user_id', 'is', null)
      .order('contacted_at', { ascending: true })
      .limit(30); // Check 30 at a time to avoid rate limits

    if (prospectsError) {
      console.error('Error fetching prospects:', prospectsError);
      return NextResponse.json({ error: 'Failed to fetch prospects' }, { status: 500 });
    }

    if (!prospects || prospects.length === 0) {
      console.log('✅ No pending connections to check');
      return NextResponse.json({
        success: true,
        checked: 0,
        message: 'No pending connections'
      });
    }

    console.log(`📊 Checking ${prospects.length} pending connections`);

    const results = {
      checked: 0,
      accepted: 0,
      still_pending: 0,
      errors: []
    };

    // Group by LinkedIn account to minimize API calls
    const accountGroups = new Map<string, typeof prospects>();

    for (const prospect of prospects) {
      const campaign = prospect.campaigns as any;
      const account = campaign.workspace_accounts as any;
      const accountId = account.unipile_account_id;

      if (!accountGroups.has(accountId)) {
        accountGroups.set(accountId, []);
      }
      accountGroups.get(accountId)!.push(prospect);
    }

    // Process each account group
    for (const [accountId, accountProspects] of accountGroups) {
      console.log(`\n🔍 Checking ${accountProspects.length} prospects for account ${accountId}`);

      for (const prospect of accountProspects) {
        try {
          results.checked++;

          // Get the prospect's profile to check network_distance
          let profile: any;

          // CRITICAL BUG FIX (Nov 22): profile?identifier= returns WRONG profiles for vanities with numbers
          if (prospect.linkedin_user_id) {
            // PRIMARY: Use stored provider_id
            profile = await unipileRequest(
              `/api/v1/users/profile?account_id=${accountId}&provider_id=${prospect.linkedin_user_id}`
            );
          } else {
            // FALLBACK: Use legacy /users/{vanity} endpoint ONLY (reliable)
            // DO NOT use profile?identifier= - it returns wrong profiles (e.g., noah-ottmar-b59478295 returns Jamshaid Ali)
            const vanityMatch = prospect.linkedin_url.match(/linkedin\.com\/in\/([^\/\?#]+)/);
            if (!vanityMatch) throw new Error(`Cannot extract LinkedIn vanity identifier from ${prospect.linkedin_url}`);

            const vanityId = vanityMatch[1];
            // ALWAYS use legacy endpoint - profile?identifier= returns wrong profiles
            profile = await unipileRequest(`/api/v1/users/${vanityId}?account_id=${accountId}`);
          }

          if (profile.network_distance === 'FIRST_DEGREE') {
            console.log(`✅ Connection accepted: ${prospect.first_name} ${prospect.last_name}`);

            // Calculate first follow-up time (smart scheduling: 1-2hrs if in business hours, else next business day)
            const firstFollowUpAt = getFirstFollowUpTime();

            // Calculate remaining follow-up schedule
            const followUpSchedule = getFollowUpSchedule();

            console.log(`   📅 Follow-up schedule:`);
            console.log(`      FU1: ${firstFollowUpAt.toLocaleString()} (next business day)`);
            console.log(`      FU2: ${followUpSchedule[1].toLocaleString()} (+3 days)`);
            console.log(`      FU3: ${followUpSchedule[2].toLocaleString()} (+5 days)`);
            console.log(`      FU4: ${followUpSchedule[3].toLocaleString()} (+5 days)`);
            console.log(`      FU5: ${followUpSchedule[4].toLocaleString()} (+3 days)`);
            console.log(`      GB:  ${followUpSchedule[5].toLocaleString()} (+3 days)`);

            // Update prospect status with optimistic locking
            const { data: updated, error: updateError } = await supabase
              .from('campaign_prospects')
              .update({
                status: 'connected',
                connection_accepted_at: new Date().toISOString(),
                follow_up_due_at: firstFollowUpAt.toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', prospect.id)
              .is('connection_accepted_at', null) // Only update if not already processed by webhook
              .select();

            if (updateError) {
              console.error(`   ❌ Error updating prospect: ${updateError.message}`);
            } else if (!updated || updated.length === 0) {
              console.log(`   ⏭️  Already processed (webhook beat us to it)`);
            } else {
              results.accepted++;
            }
          } else {
            console.log(`⏸️  Still pending: ${prospect.first_name} ${prospect.last_name} (${profile.network_distance})`);
            results.still_pending++;
          }

          // Add delay between API calls (3-5 seconds)
          await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));

        } catch (error: any) {
          console.error(`❌ Error checking ${prospect.first_name} ${prospect.last_name}:`, error.message);
          results.errors.push({
            prospect: `${prospect.first_name} ${prospect.last_name}`,
            error: error.message
          });
        }
      }
    }

    console.log(`\n📊 Polling Summary:`);
    console.log(`   - Checked: ${results.checked}`);
    console.log(`   - Accepted: ${results.accepted}`);
    console.log(`   - Still pending: ${results.still_pending}`);
    console.log(`   - Errors: ${results.errors.length}`);

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Polling error:', error);
    return NextResponse.json({
      error: 'Polling failed',
      details: error.message
    }, { status: 500 });
  }
}

// Allow GET for testing/info
export async function GET(req: NextRequest) {
  return NextResponse.json({
    name: 'Poll Accepted Connections',
    description: 'Polls for accepted LinkedIn connections using network_distance',
    schedule: '3-4 times per day with random delays',
    endpoint: '/api/cron/poll-accepted-connections',
    method: 'POST',
    headers: {
      'x-cron-secret': 'Required'
    },
    best_practices: [
      'Random delays to avoid detection',
      'Checks network_distance for acceptance',
      'Processes 30 prospects per run',
      '3-5 second delay between API calls'
    ]
  });
}