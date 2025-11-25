/**
 * Polling-based Connection Acceptance Checker
 *
 * CORRECT APPROACH (Nov 25, 2025 - per Unipile docs):
 * 1. Call GET /api/v1/users/invite/sent to get ALL pending invitations
 * 2. Any prospect NOT in pending list but in our DB = accepted or withdrawn
 * 3. This is ONE API call per account instead of one per prospect
 *
 * Schedule: every 2 hours via netlify.toml
 *
 * Best practices from Unipile:
 * - Space out checks only few times per day with random delay
 * - Use invite/sent endpoint (returns pending invitations)
 * - Avoid checking individual profiles (slow + wrong results)
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
 * Fetch ALL pending invitations for an account (with pagination)
 */
async function fetchAllPendingInvitations(accountId: string): Promise<Set<string>> {
  const pendingProviderIds = new Set<string>();
  let cursor: string | null = null;
  let pageCount = 0;
  const maxPages = 20; // Safety limit

  do {
    const url = cursor
      ? `/api/v1/users/invite/sent?account_id=${accountId}&limit=100&cursor=${cursor}`
      : `/api/v1/users/invite/sent?account_id=${accountId}&limit=100`;

    const response = await unipileRequest(url);

    for (const invitation of response.items || []) {
      if (invitation.invited_user_id) {
        pendingProviderIds.add(invitation.invited_user_id);
      }
      // Also add public_id for matching
      if (invitation.invited_user_public_id) {
        pendingProviderIds.add(invitation.invited_user_public_id.toLowerCase());
      }
    }

    cursor = response.cursor || null;
    pageCount++;

    // Small delay between pagination requests
    if (cursor) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } while (cursor && pageCount < maxPages);

  return pendingProviderIds;
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

    // Add random delay (0-5 minutes) to avoid fixed timing - skip for manual triggers
    const skipDelay = req.headers.get('x-skip-delay') === 'true';
    if (!skipDelay) {
      const randomDelay = Math.floor(Math.random() * 5 * 60 * 1000);
      console.log(`⏱️  Adding ${Math.floor(randomDelay / 1000)}s random delay...`);
      await new Promise(resolve => setTimeout(resolve, randomDelay));
    } else {
      console.log('⏭️  Skipping random delay (manual trigger)');
    }

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
      .order('contacted_at', { ascending: true });

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

    console.log(`📊 Found ${prospects.length} prospects with pending CRs`);

    const results = {
      checked: 0,
      accepted: 0,
      still_pending: 0,
      errors: [] as { prospect: string; error: string }[]
    };

    // Group by LinkedIn account
    const accountGroups = new Map<string, typeof prospects>();

    for (const prospect of prospects) {
      const campaign = prospect.campaigns as any;
      const account = campaign.workspace_accounts as any;
      if (!account?.unipile_account_id) continue;

      const accountId = account.unipile_account_id;

      if (!accountGroups.has(accountId)) {
        accountGroups.set(accountId, []);
      }
      accountGroups.get(accountId)!.push(prospect);
    }

    // Process each account
    for (const [accountId, accountProspects] of accountGroups) {
      const accountName = (accountProspects[0].campaigns as any).workspace_accounts?.account_name || accountId;
      console.log(`\n🔍 Checking ${accountProspects.length} prospects for ${accountName}`);

      try {
        // Fetch ALL pending invitations for this account (1 API call)
        console.log(`   📥 Fetching pending invitations from Unipile...`);
        const pendingInvitations = await fetchAllPendingInvitations(accountId);
        console.log(`   📊 Found ${pendingInvitations.size} pending invitations in Unipile`);

        // Check each prospect
        for (const prospect of accountProspects) {
          results.checked++;

          // Extract vanity from LinkedIn URL for matching
          const vanityMatch = prospect.linkedin_url?.match(/linkedin\.com\/in\/([^\/\?#]+)/);
          const vanity = vanityMatch ? vanityMatch[1].toLowerCase() : null;
          const providerId = prospect.linkedin_user_id;

          // Check if this prospect is still in pending invitations
          const stillPending =
            (providerId && pendingInvitations.has(providerId)) ||
            (vanity && pendingInvitations.has(vanity));

          if (!stillPending) {
            // Not in pending list = ACCEPTED (or withdrawn, but we assume accepted)
            console.log(`   ✅ Connection accepted: ${prospect.first_name} ${prospect.last_name}`);

            const firstFollowUpAt = getFirstFollowUpTime();

            // Update prospect status
            const { data: updated, error: updateError } = await supabase
              .from('campaign_prospects')
              .update({
                status: 'connected',
                connection_accepted_at: new Date().toISOString(),
                follow_up_due_at: firstFollowUpAt.toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', prospect.id)
              .is('connection_accepted_at', null)
              .select();

            if (updateError) {
              console.error(`      ❌ Error updating: ${updateError.message}`);
              results.errors.push({ prospect: `${prospect.first_name} ${prospect.last_name}`, error: updateError.message });
            } else if (!updated || updated.length === 0) {
              console.log(`      ⏭️  Already processed (webhook beat us)`);
            } else {
              results.accepted++;
              console.log(`      📅 Follow-up scheduled: ${firstFollowUpAt.toISOString()}`);
            }
          } else {
            results.still_pending++;
          }
        }

        // Delay between accounts
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error: any) {
        console.error(`   ❌ Error processing account ${accountName}:`, error.message);
        results.errors.push({ prospect: `Account: ${accountName}`, error: error.message });
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
    description: 'Polls for accepted LinkedIn connections using invite/sent endpoint',
    schedule: 'Every 2 hours via Netlify cron',
    endpoint: '/api/cron/poll-accepted-connections',
    method: 'POST',
    headers: {
      'x-cron-secret': 'Required',
      'x-skip-delay': 'Optional - set to "true" to skip random delay'
    },
    approach: [
      '1. Fetch ALL pending invitations via /api/v1/users/invite/sent',
      '2. Compare with our DB prospects marked as connection_request_sent',
      '3. Any NOT in pending list = accepted',
      '4. Update status to connected and schedule follow-up'
    ]
  });
}
