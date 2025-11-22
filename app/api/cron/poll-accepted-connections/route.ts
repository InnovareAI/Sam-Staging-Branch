/**
 * Polling-based Connection Acceptance Checker
 *
 * Polls for accepted LinkedIn connections using network_distance
 * This is a backup to the webhook system
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

            // Calculate follow-up time (24 hours after acceptance)
            const followUpDueAt = new Date();
            followUpDueAt.setHours(followUpDueAt.getHours() + 24);

            // Update prospect status
            await supabase
              .from('campaign_prospects')
              .update({
                status: 'connected',
                connection_accepted_at: new Date().toISOString(),
                follow_up_due_at: followUpDueAt.toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', prospect.id);

            results.accepted++;
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