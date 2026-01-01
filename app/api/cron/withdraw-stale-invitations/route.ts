import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 second timeout

/**
 * Withdraw Stale LinkedIn Invitations Cron Job
 *
 * Automatically withdraws pending LinkedIn connection requests older than 21 days.
 * This helps:
 * 1. Free up the 100/week invitation limit (stale invites count against it)
 * 2. Improve account health (too many pending invites looks suspicious)
 * 3. Allow re-targeting prospects who didn't respond
 *
 * Schedule: Daily at 3 AM EST (off-peak hours)
 *
 * Unipile API:
 * - GET /api/v1/users/invite/sent - List pending invitations
 * - DELETE /api/v1/users/invite/sent/{id} - Withdraw invitation
 */

const STALE_THRESHOLD_DAYS = 21; // Withdraw invites older than 3 weeks
const MAX_WITHDRAWALS_PER_RUN = 10; // Rate limit: max 10 withdrawals per cron run
const DELAY_BETWEEN_WITHDRAWALS_MS = 3000; // 3 seconds between each withdrawal

interface PendingInvitation {
  id: string;
  invited_user: string;
  invited_user_id: string;
  invited_user_public_id: string;
  invited_user_description: string;
  date: string;
  parsed_datetime: string;
  invitation_text: string;
}

interface InvitationListResponse {
  object: string;
  items: PendingInvitation[];
  cursor: string | null;
}

// Unipile API helper
async function unipileRequest(
  endpoint: string,
  method: 'GET' | 'DELETE' = 'GET'
): Promise<any> {
  const dsn = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
  const apiKey = process.env.UNIPILE_API_KEY;

  if (!apiKey) throw new Error('UNIPILE_API_KEY not configured');

  const baseUrl = dsn.includes('://') ? dsn : `https://${dsn}`;
  const url = `${baseUrl}${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: {
      'X-API-KEY': apiKey,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Unipile API error: ${response.status} - ${errorText}`);
  }

  // DELETE requests may not return JSON
  if (method === 'DELETE') {
    return { success: true };
  }

  return response.json();
}

// Get all pending invitations for an account
async function getPendingInvitations(accountId: string): Promise<PendingInvitation[]> {
  const allInvitations: PendingInvitation[] = [];
  let cursor: string | null = null;

  // Paginate through all invitations
  do {
    const endpoint = cursor
      ? `/api/v1/users/invite/sent?account_id=${accountId}&cursor=${cursor}`
      : `/api/v1/users/invite/sent?account_id=${accountId}&limit=50`;

    const response: InvitationListResponse = await unipileRequest(endpoint);

    if (response.items) {
      allInvitations.push(...response.items);
    }

    cursor = response.cursor;
  } while (cursor);

  return allInvitations;
}

// Withdraw a specific invitation
async function withdrawInvitation(invitationId: string): Promise<boolean> {
  try {
    await unipileRequest(`/api/v1/users/invite/sent/${invitationId}`, 'DELETE');
    return true;
  } catch (error) {
    console.error(`Failed to withdraw invitation ${invitationId}:`, error);
    return false;
  }
}

// Calculate days since invitation was sent
function getDaysSinceInvitation(dateString: string): number {
  const inviteDate = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - inviteDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('\n🧹 ========== STALE INVITATION WITHDRAWAL CRON ==========');
  console.log(`⏰ Started at: ${new Date().toISOString()}`);

  // Verify cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (!cronSecret || cronSecret !== expectedSecret) {
    console.log('❌ Unauthorized: Invalid or missing cron secret');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const adminClient = pool;

    // Get all connected LinkedIn accounts across all workspaces
    const { data: linkedinAccounts, error: accountsError } = await adminClient
      .from('workspace_accounts')
      .select('id, workspace_id, unipile_account_id, account_name')
      .eq('account_type', 'linkedin')
      .in('connection_status', VALID_CONNECTION_STATUSES);

    if (accountsError) {
      throw new Error(`Failed to fetch LinkedIn accounts: ${accountsError.message}`);
    }

    if (!linkedinAccounts || linkedinAccounts.length === 0) {
      console.log('📭 No connected LinkedIn accounts found');
      return NextResponse.json({
        success: true,
        message: 'No connected LinkedIn accounts to process',
        processed: 0
      });
    }

    console.log(`📊 Found ${linkedinAccounts.length} connected LinkedIn account(s)`);

    const results = {
      accountsProcessed: 0,
      totalPendingInvitations: 0,
      staleInvitations: 0,
      withdrawnCount: 0,
      failedCount: 0,
      skippedDueToLimit: 0,
      details: [] as {
        accountId: string;
        accountName: string;
        pending: number;
        stale: number;
        withdrawn: number;
        failed: number;
      }[]
    };

    let totalWithdrawnThisRun = 0;

    // Process each LinkedIn account
    for (const account of linkedinAccounts) {
      if (!account.unipile_account_id) {
        console.log(`⏭️ Skipping account ${account.id} - no Unipile account ID`);
        continue;
      }

      console.log(`\n📧 Processing: ${account.account_name || account.unipile_account_id}`);

      try {
        // Get pending invitations for this account
        const pendingInvitations = await getPendingInvitations(account.unipile_account_id);
        console.log(`   📊 Found ${pendingInvitations.length} pending invitation(s)`);

        results.totalPendingInvitations += pendingInvitations.length;

        // Find stale invitations (older than threshold)
        const staleInvitations = pendingInvitations.filter(inv => {
          const daysSince = getDaysSinceInvitation(inv.date || inv.parsed_datetime);
          return daysSince >= STALE_THRESHOLD_DAYS;
        });

        console.log(`   ⏳ ${staleInvitations.length} stale invitation(s) (>${STALE_THRESHOLD_DAYS} days old)`);

        results.staleInvitations += staleInvitations.length;

        const accountResult = {
          accountId: account.unipile_account_id,
          accountName: account.account_name || 'Unknown',
          pending: pendingInvitations.length,
          stale: staleInvitations.length,
          withdrawn: 0,
          failed: 0
        };

        // Withdraw stale invitations (up to the limit)
        for (const invitation of staleInvitations) {
          // Check if we've hit the per-run limit
          if (totalWithdrawnThisRun >= MAX_WITHDRAWALS_PER_RUN) {
            console.log(`   ⚠️ Reached max withdrawals per run (${MAX_WITHDRAWALS_PER_RUN})`);
            results.skippedDueToLimit += staleInvitations.length - accountResult.withdrawn;
            break;
          }

          const daysSince = getDaysSinceInvitation(invitation.date || invitation.parsed_datetime);
          console.log(`   🗑️ Withdrawing: ${invitation.invited_user} (${daysSince} days old)`);

          // Add delay between withdrawals (anti-detection)
          if (accountResult.withdrawn > 0) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_WITHDRAWALS_MS));
          }

          const success = await withdrawInvitation(invitation.id);

          if (success) {
            accountResult.withdrawn++;
            totalWithdrawnThisRun++;
            results.withdrawnCount++;

            // Log to database for tracking
            await adminClient
              .from('linkedin_invitation_withdrawals')
              .insert({
                workspace_id: account.workspace_id,
                unipile_account_id: account.unipile_account_id,
                invitation_id: invitation.id,
                invited_user_name: invitation.invited_user,
                invited_user_id: invitation.invited_user_id,
                invitation_date: invitation.date || invitation.parsed_datetime,
                days_pending: daysSince,
                withdrawn_at: new Date().toISOString()
              })
              .then(() => {})
              .catch(err => console.log(`   ⚠️ Failed to log withdrawal: ${err.message}`));

          } else {
            accountResult.failed++;
            results.failedCount++;
          }
        }

        results.details.push(accountResult);
        results.accountsProcessed++;

      } catch (accountError) {
        console.error(`   ❌ Error processing account: ${accountError}`);
        results.details.push({
          accountId: account.unipile_account_id,
          accountName: account.account_name || 'Unknown',
          pending: 0,
          stale: 0,
          withdrawn: 0,
          failed: -1 // Indicates account-level error
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log('\n📊 ========== SUMMARY ==========');
    console.log(`   Accounts processed: ${results.accountsProcessed}`);
    console.log(`   Total pending invitations: ${results.totalPendingInvitations}`);
    console.log(`   Stale invitations (>${STALE_THRESHOLD_DAYS}d): ${results.staleInvitations}`);
    console.log(`   Successfully withdrawn: ${results.withdrawnCount}`);
    console.log(`   Failed withdrawals: ${results.failedCount}`);
    console.log(`   Skipped (rate limit): ${results.skippedDueToLimit}`);
    console.log(`   Duration: ${duration}ms`);
    console.log('================================\n');

    return NextResponse.json({
      success: true,
      ...results,
      duration_ms: duration,
      threshold_days: STALE_THRESHOLD_DAYS,
      next_run_note: results.skippedDueToLimit > 0
        ? `${results.skippedDueToLimit} invitations skipped, will process in next run`
        : undefined
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Cron job failed:', errorMessage);

    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

// GET endpoint for documentation/health check
export async function GET() {
  return NextResponse.json({
    name: 'Withdraw Stale Invitations',
    description: 'Automatically withdraws pending LinkedIn connection requests older than 21 days',
    schedule: 'Daily at 3 AM EST',
    config: {
      stale_threshold_days: STALE_THRESHOLD_DAYS,
      max_withdrawals_per_run: MAX_WITHDRAWALS_PER_RUN,
      delay_between_withdrawals_ms: DELAY_BETWEEN_WITHDRAWALS_MS
    },
    benefits: [
      'Frees up weekly invitation limit (100/week)',
      'Improves account health score',
      'Allows re-targeting non-responsive prospects'
    ],
    requirements: {
      cron_secret: 'x-cron-secret header (matches CRON_SECRET env var)',
      database: 'workspace_accounts, linkedin_invitation_withdrawals tables'
    }
  });
}
