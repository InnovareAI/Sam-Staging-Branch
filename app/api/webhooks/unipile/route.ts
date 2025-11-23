/**
 * Unipile Webhook Handler
 *
 * Receives real-time events from Unipile including:
 * - new_relation: When a LinkedIn connection is accepted
 * - new_message: When a new message is received
 *
 * Documentation: https://developer.unipile.com/docs/detecting-accepted-invitations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase client
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
 * Verify webhook signature from Unipile
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-unipile-signature');

    // Verify webhook signature if secret is configured
    if (process.env.UNIPILE_WEBHOOK_SECRET) {
      const isValid = verifyWebhookSignature(
        body,
        signature,
        process.env.UNIPILE_WEBHOOK_SECRET
      );

      if (!isValid) {
        console.error('❌ Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const event = JSON.parse(body);
    console.log(`📨 Received Unipile webhook event: ${event.event_type}`);

    switch (event.event_type) {
      case 'USERS_WEBHOOK':
        return handleUsersWebhook(event);

      case 'MESSAGING_WEBHOOK':
        return handleMessagingWebhook(event);

      default:
        console.log(`⚠️ Unhandled event type: ${event.event_type}`);
        return NextResponse.json({
          success: true,
          message: `Event type ${event.event_type} not handled`
        });
    }
  } catch (error: any) {
    console.error('❌ Webhook processing error:', error);
    return NextResponse.json({
      error: 'Webhook processing failed',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Handle USERS_WEBHOOK events (includes new_relation)
 */
async function handleUsersWebhook(event: any) {
  const { type, data } = event;

  if (type === 'new_relation') {
    console.log('🤝 New LinkedIn connection accepted!');

    const {
      account_id,
      provider_id,
      public_identifier,
      name,
      profile_url
    } = data.user;

    try {
      // Find the workspace account
      const { data: account } = await supabase
        .from('workspace_accounts')
        .select('id, workspace_id')
        .eq('unipile_account_id', account_id)
        .single();

      if (!account) {
        console.error(`❌ Account not found for Unipile ID: ${account_id}`);
        return NextResponse.json({
          success: false,
          error: 'Account not found'
        }, { status: 404 });
      }

      // Find prospects with this LinkedIn user
      const { data: prospects, error: prospectError } = await supabase
        .from('campaign_prospects')
        .select(`
          id,
          status,
          campaign_id,
          connection_accepted_at,
          campaigns!inner (
            workspace_id
          )
        `)
        .or(`linkedin_user_id.eq.${provider_id},linkedin_url.ilike.%${public_identifier}%`)
        .eq('campaigns.workspace_id', account.workspace_id)
        .eq('status', 'connection_request_sent');

      if (prospectError || !prospects || prospects.length === 0) {
        console.log(`⚠️ No pending prospects found for ${name} (${public_identifier})`);
        return NextResponse.json({
          success: true,
          message: 'No prospects to update'
        });
      }

      // Update all matching prospects
      for (const prospect of prospects) {
        console.log(`✅ Updating prospect ${prospect.id} to connected status`);

        // Calculate follow-up time (next business day at 9 AM)
        const followUpDueAt = getNextBusinessDay(1);

        await supabase
          .from('campaign_prospects')
          .update({
            status: 'connected',
            connection_accepted_at: new Date().toISOString(),
            follow_up_due_at: followUpDueAt.toISOString(),
            linkedin_user_id: provider_id, // Update provider_id if not set
            updated_at: new Date().toISOString()
          })
          .eq('id', prospect.id);

        console.log(`   📅 First follow-up scheduled for: ${followUpDueAt.toLocaleString()}`);
      }

      console.log(`🎉 Updated ${prospects.length} prospects to connected status`);

      return NextResponse.json({
        success: true,
        message: `Connection accepted for ${name}`,
        updated_prospects: prospects.length
      });

    } catch (error: any) {
      console.error('❌ Error processing new_relation:', error);
      return NextResponse.json({
        error: 'Failed to process new relation',
        details: error.message
      }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    message: `Users webhook type ${type} received`
  });
}

/**
 * Handle MESSAGING_WEBHOOK events
 */
async function handleMessagingWebhook(event: any) {
  const { type, data } = event;

  if (type === 'new_message') {
    console.log('💬 New message received');

    const {
      account_id,
      chat_id,
      message,
      sender
    } = data;

    // Check if this is a reply from a prospect
    if (sender.provider_id) {
      const { data: prospects } = await supabase
        .from('campaign_prospects')
        .select('id, status')
        .eq('linkedin_user_id', sender.provider_id)
        .in('status', ['connected', 'messaging']);

      if (prospects && prospects.length > 0) {
        // Update prospect status to 'replied' and STOP follow-up sequence
        for (const prospect of prospects) {
          await supabase
            .from('campaign_prospects')
            .update({
              status: 'replied',
              responded_at: new Date().toISOString(),
              follow_up_due_at: null, // STOP follow-up sequence
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);
        }

        console.log(`✅ Updated ${prospects.length} prospects to replied status and stopped follow-up sequence`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Message processed'
    });
  }

  return NextResponse.json({
    success: true,
    message: `Messaging webhook type ${type} received`
  });
}

// Allow GET for webhook setup verification
export async function GET(req: NextRequest) {
  return NextResponse.json({
    name: 'Unipile Webhook Handler',
    description: 'Receives real-time events from Unipile',
    endpoint: '/api/webhooks/unipile',
    events: [
      'new_relation - Connection accepted',
      'new_message - Message received'
    ],
    configuration: {
      webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com'}/api/webhooks/unipile`,
      secret_configured: !!process.env.UNIPILE_WEBHOOK_SECRET
    }
  });
}