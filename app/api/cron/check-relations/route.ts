import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Check Relations - Proper Connection Acceptance Detection
 *
 * Uses Unipile's /users/relations endpoint (recommended by Unipile docs)
 * instead of polling network_distance
 *
 * This is a backup to the webhook system in case webhooks fail
 * Schedule: 1-2 times per day with random delays
 *
 * POST /api/cron/check-relations
 * Header: x-cron-secret (for security)
 */

export const maxDuration = 300; // 5 minutes

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
    // Security check
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      console.warn('⚠️  Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Checking relations using /users/relations endpoint...');

    // Add random delay (0-5 minutes) to avoid fixed timing
    const randomDelay = Math.floor(Math.random() * 5 * 60 * 1000);
    console.log(`⏱️  Adding ${Math.floor(randomDelay / 1000)}s random delay...`);
    await new Promise(resolve => setTimeout(resolve, randomDelay));

    // Find all prospects with pending connection requests
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select(`
        id,
        first_name,
        last_name,
        linkedin_user_id,
        status,
        contacted_at,
        campaigns!inner (
          id,
          campaign_name,
          linkedin_account_id,
          workspace_accounts!linkedin_account_id (
            unipile_account_id
          )
        )
      `)
      .eq('status', 'connection_request_sent')
      .is('connection_accepted_at', null)
      .not('linkedin_user_id', 'is', null)
      .order('contacted_at', { ascending: true })
      .limit(50);

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

    // Group by account for efficiency
    const byAccount = new Map();
    for (const prospect of prospects) {
      const account = (prospect.campaigns as any).workspace_accounts as any;
      const accountId = account.unipile_account_id;
      if (!byAccount.has(accountId)) {
        byAccount.set(accountId, []);
      }
      byAccount.get(accountId).push(prospect);
    }

    // Check each account's relations
    for (const [accountId, accountProspects] of byAccount) {
      try {
        console.log(`\n👤 Fetching relations for account ${accountId}...`);

        // Get all relations (accepted connections) for this account
        const relations = await unipileRequest(
          `/api/v1/users/relations?account_id=${accountId}&limit=200`
        );

        console.log(`   Found ${relations.items?.length || 0} total relations`);

        // Convert relations to a Set of provider_ids for quick lookup
        const acceptedProviderIds = new Set(
          (relations.items || []).map((r: any) => r.provider_id)
        );

        // Check each prospect in this account
        for (const prospect of accountProspects) {
          results.checked++;

          if (acceptedProviderIds.has(prospect.linkedin_user_id)) {
            // Connection accepted!
            console.log(`✅ ${prospect.first_name} ${prospect.last_name} is now connected`);

            // Calculate follow-up time (24 hours after acceptance)
            const followUpDueAt = new Date();
            followUpDueAt.setHours(followUpDueAt.getHours() + 24);

            const { error: updateError } = await supabase
              .from('campaign_prospects')
              .update({
                status: 'connected',
                connection_accepted_at: new Date().toISOString(),
                follow_up_due_at: followUpDueAt.toISOString(),
                follow_up_sequence_index: 0,
                updated_at: new Date().toISOString()
              })
              .eq('id', prospect.id);

            if (updateError) {
              console.error(`❌ Error updating ${prospect.first_name}:`, updateError);
              results.errors.push({
                prospect: `${prospect.first_name} ${prospect.last_name}`,
                error: updateError.message
              });
            } else {
              results.accepted++;
            }
          } else {
            console.log(`⏸️  ${prospect.first_name} ${prospect.last_name} still pending`);
            results.still_pending++;
          }

          // Add delay between checks (1-2 seconds)
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
        }
      } catch (error: any) {
        console.error(`❌ Error checking account ${accountId}:`, error.message);
        results.errors.push({
          account: accountId,
          error: error.message
        });
      }
    }

    console.log(`\n📊 Summary:`);
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
    console.error('❌ Relations check error:', error);
    return NextResponse.json({
      error: 'Check failed',
      details: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Check Relations',
    description: 'Checks for accepted connections using /users/relations endpoint',
    endpoint: '/api/cron/check-relations',
    method: 'POST',
    schedule: '1-2 times per day with random delays',
    headers: {
      'x-cron-secret': 'Required'
    },
    best_practices: [
      'Uses /users/relations endpoint (Unipile recommended)',
      'More reliable than polling network_distance',
      'Backup to webhook system',
      'Random delays to avoid detection',
      'Processes up to 50 prospects per run'
    ]
  });
}
