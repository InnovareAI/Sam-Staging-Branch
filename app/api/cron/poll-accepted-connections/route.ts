/**
 * Polling-based Connection Acceptance Checker
 *
 * CORRECT APPROACH (Nov 25, 2025 - FIXED):
 * 1. Call GET /api/v1/users/invite/sent to get ALL pending invitations
 * 2. Call GET /api/v1/users/relations to get ALL first-degree connections
 * 3. Prospect is ACCEPTED only if:
 *    - NOT in pending invitations AND
 *    - IS in relations list (first-degree connection)
 * 4. This prevents false positives from declined/withdrawn/expired invitations
 *
 * Schedule: every 2 hours via netlify.toml
 *
 * Best practices from Unipile:
 * - Space out checks only few times per day with random delay
 * - Use invite/sent endpoint (returns pending invitations)
 * - Use relations endpoint to VERIFY actual acceptance
 * - Avoid checking individual profiles (slow + wrong results)
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

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
 *
 * Schedule: First follow-up is 1 day after connection acceptance
 * - Schedules for 1 day later at a random time within business hours (7 AM - 6 PM)
 * - If that day is a weekend or holiday, moves to next business day
 */
function getFirstFollowUpTime(): Date {
  // First follow-up is 1 day after connection
  const followUpDate = new Date();
  followUpDate.setDate(followUpDate.getDate() + 1); // Add 1 day

  // Set a random time between 7 AM and 5 PM (to allow buffer before 6 PM)
  const randomHour = 7 + Math.floor(Math.random() * 10); // 7-16 (7 AM - 4 PM)
  const randomMinute = Math.floor(Math.random() * 60);
  followUpDate.setHours(randomHour, randomMinute, 0, 0);

  const PUBLIC_HOLIDAYS = [
    '2025-01-01', '2025-01-20', '2025-02-17', '2025-03-17',
    '2025-05-26', '2025-06-19', '2025-07-04', '2025-09-01',
    '2025-10-13', '2025-11-11', '2025-11-27', '2025-12-25',
    '2026-01-01', '2026-01-19'
  ];

  // Advance past weekends and holidays while preserving time
  while (true) {
    const dayOfWeek = followUpDate.getDay();
    const dateStr = followUpDate.toISOString().split('T')[0];

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = PUBLIC_HOLIDAYS.includes(dateStr);

    if (!isWeekend && !isHoliday) {
      break;
    }

    followUpDate.setDate(followUpDate.getDate() + 1);
  }

  return followUpDate;
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

    // Minimal delay between pagination requests
    if (cursor) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } while (cursor && pageCount < maxPages);

  return pendingProviderIds;
}

/**
 * Fetch ALL first-degree connections for an account (with pagination)
 * CRITICAL: This is the source of truth for who actually accepted
 */
async function fetchAllRelations(accountId: string): Promise<Set<string>> {
  const relationIds = new Set<string>();
  let cursor: string | null = null;
  let pageCount = 0;
  const maxPages = 50; // Higher limit - relations can be large

  do {
    const url = cursor
      ? `/api/v1/users/relations?account_id=${accountId}&limit=100&cursor=${cursor}`
      : `/api/v1/users/relations?account_id=${accountId}&limit=100`;

    const response = await unipileRequest(url);

    for (const relation of response.items || []) {
      // Add provider_id (main identifier)
      if (relation.provider_id) {
        relationIds.add(relation.provider_id);
      }
      // Add public_identifier (vanity URL) for matching
      if (relation.public_identifier) {
        relationIds.add(relation.public_identifier.toLowerCase());
      }
    }

    cursor = response.cursor || null;
    pageCount++;

    // Minimal delay between pagination requests
    if (cursor) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } while (cursor && pageCount < maxPages);

  return relationIds;
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
      .order('contacted_at', { ascending: true })
      .limit(50); // Process 50 at a time to avoid timeout

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
      declined: 0, // Connection was declined/withdrawn/expired (not in pending + not in relations + 24h old)
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
        // Fetch ALL pending invitations for this account
        console.log(`   📥 Fetching pending invitations from Unipile...`);
        const pendingInvitations = await fetchAllPendingInvitations(accountId);
        console.log(`   📊 Found ${pendingInvitations.size} pending invitations in Unipile`);

        // Fetch ALL first-degree connections (relations) for this account
        // CRITICAL: This is the source of truth for who actually accepted
        console.log(`   📥 Fetching relations (first-degree connections) from Unipile...`);
        const relations = await fetchAllRelations(accountId);
        console.log(`   📊 Found ${relations.size} first-degree connections in Unipile`);

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

          // Check if this prospect is in relations (first-degree connection)
          const isConnected =
            (providerId && relations.has(providerId)) ||
            (vanity && relations.has(vanity));

          if (stillPending) {
            // Still in pending list = waiting for response
            results.still_pending++;
          } else if (isConnected) {
            // NOT in pending AND IS in relations = ACTUALLY ACCEPTED
            console.log(`   ✅ Connection VERIFIED accepted: ${prospect.first_name} ${prospect.last_name}`);

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
            // NOT in pending AND NOT in relations = declined/withdrawn/expired
            // Only mark as declined if the CR was sent more than 24 hours ago
            // (to avoid false positives from API delays)
            const sentAt = prospect.contacted_at ? new Date(prospect.contacted_at) : null;
            const hoursSinceSent = sentAt ? (Date.now() - sentAt.getTime()) / (1000 * 60 * 60) : 999;

            if (hoursSinceSent >= 24) {
              console.log(`   ❌ Connection DECLINED: ${prospect.first_name} ${prospect.last_name} (sent ${Math.floor(hoursSinceSent)}h ago)`);

              // Update status to declined
              const { error: declineError } = await supabase
                .from('campaign_prospects')
                .update({
                  status: 'declined',
                  follow_up_due_at: null, // Stop any follow-ups
                  updated_at: new Date().toISOString()
                })
                .eq('id', prospect.id)
                .eq('status', 'connection_request_sent'); // Only update if still pending

              if (declineError) {
                console.error(`      ❌ Error updating: ${declineError.message}`);
                results.errors.push({ prospect: `${prospect.first_name} ${prospect.last_name}`, error: declineError.message });
              } else {
                results.declined++;

                // Also cancel any pending emails for this prospect
                await supabase
                  .from('email_send_queue')
                  .update({
                    status: 'cancelled',
                    error_message: 'Connection declined - sequence stopped',
                    updated_at: new Date().toISOString()
                  })
                  .eq('prospect_id', prospect.id)
                  .eq('status', 'pending');
              }
            } else {
              console.log(`   ⏳ Waiting for response: ${prospect.first_name} ${prospect.last_name} (sent ${Math.floor(hoursSinceSent)}h ago, need 24h before marking declined)`);
              results.still_pending++; // Count as still pending until 24h threshold
            }
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
    console.log(`   - Accepted (verified in relations): ${results.accepted}`);
    console.log(`   - Declined (not in pending + not in relations): ${results.declined}`);
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
    description: 'Polls for accepted LinkedIn connections using invite/sent AND relations endpoints',
    schedule: 'Every 2 hours via Netlify cron',
    endpoint: '/api/cron/poll-accepted-connections',
    method: 'POST',
    headers: {
      'x-cron-secret': 'Required',
      'x-skip-delay': 'Optional - set to "true" to skip random delay'
    },
    approach: [
      '1. Fetch ALL pending invitations via /api/v1/users/invite/sent',
      '2. Fetch ALL first-degree connections via /api/v1/users/relations',
      '3. Compare with our DB prospects marked as connection_request_sent',
      '4. Mark as ACCEPTED only if: NOT in pending AND IS in relations',
      '5. This prevents false positives from declined/withdrawn/expired invitations'
    ],
    results: {
      'still_pending': 'In pending invitations - waiting for response',
      'accepted': 'Verified in relations list - actually accepted',
      'declined': 'Not pending + not in relations + 24h old - marked as declined, follow-ups cancelled'
    }
  });
}
