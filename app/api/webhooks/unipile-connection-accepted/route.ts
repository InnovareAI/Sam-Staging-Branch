import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Unipile Webhook Handler - Connection Accepted
 *
 * Receives webhook events when LinkedIn connections are accepted
 * Event: users.new_relation
 *
 * POST /api/webhooks/unipile-connection-accepted
 * Header: x-unipile-signature (for verification)
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // Verify webhook signature (optional but recommended)
    const signature = req.headers.get('x-unipile-signature');
    if (!signature && process.env.NODE_ENV === 'production') {
      console.warn('⚠️  Missing webhook signature in production');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('📨 Webhook received:', JSON.stringify(body, null, 2));

    // Webhook payload structure from Unipile
    // {
    //   "id": "webhook_event_id",
    //   "account_id": "unipile_account_id",
    //   "event_type": "new_relation",
    //   "source": "users",
    //   "data": {
    //     "provider_id": "ACoAA...",
    //     "first_name": "John",
    //     "last_name": "Doe",
    //     "profile_url": "https://www.linkedin.com/in/john-doe/",
    //     "timestamp": "2025-11-22T16:00:00Z"
    //   }
    // }

    const { event_type, source, data, account_id } = body;

    // Only process new_relation events from users source
    if (event_type !== 'new_relation' || source !== 'users') {
      console.log(`⏭️  Skipping event: ${event_type}/${source}`);
      return NextResponse.json({ received: true });
    }

    if (!data || !data.provider_id) {
      console.error('❌ Missing provider_id in webhook data');
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { provider_id, first_name, last_name } = data;

    console.log(`✅ Processing new connection: ${first_name} ${last_name} (${provider_id})`);

    // Find all prospects with this provider_id across all campaigns
    const { data: prospects, error: fetchError } = await supabase
      .from('campaign_prospects')
      .select('id, campaign_id, first_name, last_name, status, follow_up_due_at')
      .eq('linkedin_user_id', provider_id)
      .eq('status', 'connection_request_sent');

    if (fetchError) {
      console.error('❌ Error fetching prospects:', fetchError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!prospects || prospects.length === 0) {
      console.log(`ℹ️  No pending prospects found for provider_id ${provider_id}`);
      return NextResponse.json({ received: true, matched: 0 });
    }

    console.log(`📊 Found ${prospects.length} prospect(s) to update`);

    // Update all matching prospects to 'connected' status
    const updates = [];
    for (const prospect of prospects) {
      // Calculate follow-up time (24 hours after acceptance)
      const followUpDueAt = new Date();
      followUpDueAt.setHours(followUpDueAt.getHours() + 24);

      const { error: updateError } = await supabase
        .from('campaign_prospects')
        .update({
          status: 'connected',
          connection_accepted_at: new Date().toISOString(),
          follow_up_due_at: followUpDueAt.toISOString(),
          follow_up_sequence_index: 0, // Reset to send first follow-up
          updated_at: new Date().toISOString()
        })
        .eq('id', prospect.id);

      if (updateError) {
        console.error(`❌ Error updating prospect ${prospect.id}:`, updateError);
      } else {
        console.log(`✅ Updated ${prospect.first_name} ${prospect.last_name} to connected status`);
        updates.push({
          id: prospect.id,
          name: `${prospect.first_name} ${prospect.last_name}`,
          follow_up_due_at: followUpDueAt.toISOString()
        });
      }
    }

    console.log(`🎉 Webhook processed: ${updates.length} prospect(s) updated`);

    return NextResponse.json({
      received: true,
      matched: prospects.length,
      updated: updates.length,
      updates: updates
    });

  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
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
