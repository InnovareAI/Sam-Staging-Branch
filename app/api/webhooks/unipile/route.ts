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

        // Calculate first follow-up time (smart: 1-2hrs if in business hours, else next business day)
        const followUpDueAt = getFirstFollowUpTime();

        // Optimistic locking: only update if not already processed by polling cron
        const { data: updated, error: updateError } = await supabase
          .from('campaign_prospects')
          .update({
            status: 'connected',
            connection_accepted_at: new Date().toISOString(),
            follow_up_due_at: followUpDueAt.toISOString(),
            linkedin_user_id: provider_id, // Update provider_id if not set
            updated_at: new Date().toISOString()
          })
          .eq('id', prospect.id)
          .is('connection_accepted_at', null) // Only update if not already processed
          .select();

        if (updateError) {
          console.error(`   ❌ Error updating prospect: ${updateError.message}`);
        } else if (!updated || updated.length === 0) {
          console.log(`   ⏭️  Already processed (polling cron beat us to it)`);
        } else {
          console.log(`   📅 First follow-up scheduled for: ${followUpDueAt.toLocaleString()}`);
        }
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
 * Supports both LinkedIn messages and Email replies
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

    // Determine if this is LinkedIn or Email based on account type
    const { data: account } = await supabase
      .from('workspace_accounts')
      .select('account_type')
      .eq('unipile_account_id', account_id)
      .single();

    const isEmail = account?.account_type === 'email';
    const senderEmail = sender?.email || sender?.identifier || message?.from?.email;
    const senderLinkedInId = sender?.provider_id;

    console.log(`📨 Message type: ${isEmail ? 'EMAIL' : 'LINKEDIN'}, sender: ${isEmail ? senderEmail : senderLinkedInId}`);

    let prospects: any[] = [];

    if (isEmail && senderEmail) {
      // EMAIL: Match by email address
      const { data: emailProspects } = await supabase
        .from('campaign_prospects')
        .select('id, status, campaign_id')
        .eq('email', senderEmail.toLowerCase())
        .in('status', ['pending', 'email_sent', 'follow_up_sent']);

      prospects = emailProspects || [];
      console.log(`📧 Found ${prospects.length} email prospects matching ${senderEmail}`);

    } else if (senderLinkedInId) {
      // LINKEDIN: Match by LinkedIn provider_id
      const { data: linkedinProspects } = await supabase
        .from('campaign_prospects')
        .select('id, status, campaign_id')
        .eq('linkedin_user_id', senderLinkedInId)
        .in('status', ['connected', 'messaging', 'follow_up_sent']);

      prospects = linkedinProspects || [];
      console.log(`💼 Found ${prospects.length} LinkedIn prospects matching ${senderLinkedInId}`);
    }

    // Store the incoming message in linkedin_messages table
    const messageContent = message?.text || message?.body || message?.content || '';
    const messageId = message?.id || data.message_id;

    if (prospects.length > 0) {
      // Update all matching prospects to 'replied' and STOP sequences
      for (const prospect of prospects) {
        // Get prospect details for message storage
        const { data: prospectDetails } = await supabase
          .from('campaign_prospects')
          .select('first_name, last_name, linkedin_url, campaign_id, campaigns!inner(workspace_id)')
          .eq('id', prospect.id)
          .single();

        // Store the incoming message
        if (prospectDetails && messageContent) {
          const workspaceId = (prospectDetails.campaigns as any)?.workspace_id;

          await supabase
            .from('linkedin_messages')
            .insert({
              workspace_id: workspaceId,
              campaign_id: prospect.campaign_id,
              prospect_id: prospect.id,
              direction: 'incoming',
              message_type: isEmail ? 'email' : 'message',
              content: messageContent,
              unipile_message_id: messageId,
              unipile_chat_id: chat_id,
              sender_linkedin_url: prospectDetails.linkedin_url,
              sender_name: `${prospectDetails.first_name || ''} ${prospectDetails.last_name || ''}`.trim(),
              sender_linkedin_id: senderLinkedInId,
              status: 'received',
              sent_at: new Date().toISOString(),
              metadata: {
                raw_sender: sender,
                account_id: account_id,
                is_email: isEmail
              }
            });

          console.log(`💾 Stored incoming message from ${prospectDetails.first_name} ${prospectDetails.last_name}`);
        }

        await supabase
          .from('campaign_prospects')
          .update({
            status: 'replied',
            responded_at: new Date().toISOString(),
            follow_up_due_at: null, // STOP follow-up sequence
            updated_at: new Date().toISOString()
          })
          .eq('id', prospect.id);

        // Cancel any pending emails for this prospect
        await supabase
          .from('email_send_queue')
          .update({
            status: 'cancelled',
            error_message: 'Prospect replied - sequence stopped',
            updated_at: new Date().toISOString()
          })
          .eq('prospect_id', prospect.id)
          .eq('status', 'pending');
      }

      console.log(`✅ Updated ${prospects.length} prospects to replied status, stopped follow-up sequences, and cancelled pending emails`);
    } else if (messageContent) {
      // Store message even if no prospect found (for audit purposes)
      console.log(`⚠️ No prospect found, but storing message for audit`);

      // Try to find workspace from account
      const { data: accountData } = await supabase
        .from('workspace_accounts')
        .select('workspace_id')
        .eq('unipile_account_id', account_id)
        .single();

      if (accountData?.workspace_id) {
        await supabase
          .from('linkedin_messages')
          .insert({
            workspace_id: accountData.workspace_id,
            direction: 'incoming',
            message_type: isEmail ? 'email' : 'message',
            content: messageContent,
            unipile_message_id: messageId,
            unipile_chat_id: chat_id,
            sender_linkedin_id: senderLinkedInId,
            sender_name: sender?.name || sender?.display_name,
            status: 'received',
            sent_at: new Date().toISOString(),
            metadata: {
              raw_sender: sender,
              account_id: account_id,
              is_email: isEmail,
              no_prospect_match: true
            }
          });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${isEmail ? 'Email' : 'LinkedIn'} message processed`,
      prospects_updated: prospects.length
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