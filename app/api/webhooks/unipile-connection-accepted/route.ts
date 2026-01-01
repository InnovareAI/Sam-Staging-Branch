import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

/**
 * ⚠️ DEPRECATED - DO NOT USE
 *
 * This webhook handler is DISABLED to prevent duplicate processing.
 * Use /api/webhooks/unipile instead which handles ALL Unipile webhook events.
 *
 * ISSUE: Having two webhook handlers for new_relation events creates race conditions:
 * - This handler uses 24-hour follow-up scheduling
 * - /api/webhooks/unipile uses business day scheduling
 * - Both update the same campaign_prospects records
 * - Last write wins, causing unpredictable follow-up timing
 *
 * SOLUTION: Consolidated all webhook handling to /api/webhooks/unipile
 *
 * DELETE this webhook URL from Unipile dashboard after deploying this change.
 */

export async function POST(req: NextRequest) {
  console.warn('⚠️ DEPRECATED WEBHOOK CALLED: /api/webhooks/unipile-connection-accepted');
  console.warn('⚠️ Please use /api/webhooks/unipile instead');
  console.warn('⚠️ DELETE this webhook URL from Unipile dashboard');

  return NextResponse.json({
    error: 'Deprecated endpoint',
    message: 'This webhook handler is disabled. Use /api/webhooks/unipile instead.',
    redirect_to: '/api/webhooks/unipile'
  }, { status: 410 }); // 410 Gone - resource permanently removed
}

// GET endpoint for testing/info
export async function GET() {
  return NextResponse.json({
    name: 'Unipile Connection Accepted Webhook',
    description: 'Receives webhook events when LinkedIn connections are accepted',
    event: 'users.new_relation',
    endpoint: '/api/webhooks/unipile-connection-accepted',
    method: 'POST',
    headers: {
      'x-unipile-signature': 'Recommended for production'
    },
    expected_payload: {
      event_type: 'new_relation',
      source: 'users',
      account_id: 'unipile_account_id',
      data: {
        provider_id: 'LinkedIn internal ID',
        first_name: 'First name',
        last_name: 'Last name',
        profile_url: 'LinkedIn profile URL',
        timestamp: 'ISO timestamp'
      }
    }
  });
}
