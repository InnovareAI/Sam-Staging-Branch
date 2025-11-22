import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Cron Job: Process Send Queue
 *
 * Runs every minute to send queued connection requests
 * One message per execution (safe, throttled approach)
 *
 * POST /api/cron/process-send-queue
 * Header: x-cron-secret (for security)
 *
 * Cronjob.org setup:
 * - URL: https://app.meet-sam.com/api/cron/process-send-queue
 * - Schedule: * * * * * (every minute)
 * - Headers: x-cron-secret: ${CRON_SECRET}
 */

export const maxDuration = 60; // 60 seconds

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

// Public holidays (US holidays 2025-2026)
// Format: YYYY-MM-DD
const PUBLIC_HOLIDAYS = [
  '2025-01-01', // New Year's Day
  '2025-01-20', // MLK Jr. Day
  '2025-02-17', // Presidents' Day
  '2025-03-17', // St. Patrick's Day (optional - adjust as needed)
  '2025-05-26', // Memorial Day
  '2025-06-19', // Juneteenth
  '2025-07-04', // Independence Day
  '2025-09-01', // Labor Day
  '2025-10-13', // Columbus Day
  '2025-11-11', // Veterans Day
  '2025-11-27', // Thanksgiving
  '2025-12-25', // Christmas
  '2026-01-01', // New Year's Day
  '2026-01-19', // MLK Jr. Day
];

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

function isPublicHoliday(date: Date): boolean {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
  return PUBLIC_HOLIDAYS.includes(dateStr);
}

function canSendMessage(scheduledFor: Date): boolean {
  // Don't send on weekends
  if (isWeekend(scheduledFor)) {
    console.log(`⏸️  Skipping weekend message (${scheduledFor.toISOString()})`);
    return false;
  }

  // Don't send on public holidays
  if (isPublicHoliday(scheduledFor)) {
    console.log(`🎉 Skipping public holiday message (${scheduledFor.toISOString()})`);
    return false;
  }

  return true;
}

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

    console.log('🕐 Processing send queue...');

    // 1. Find NEXT message due to send (order by scheduled_for ASC, limit 1)
    const { data: queuedMessages, error: fetchError } = await supabase
      .from('send_queue')
      .select(`
        id,
        campaign_id,
        prospect_id,
        linkedin_user_id,
        scheduled_for,
        message,
        campaigns!inner (
          id,
          campaign_name,
          linkedin_account_id,
          workspace_accounts!linkedin_account_id (
            unipile_account_id,
            account_name
          )
        ),
        campaign_prospects (
          id,
          first_name,
          last_name,
          linkedin_url
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(1);

    if (fetchError) {
      console.error('❌ Queue fetch error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 });
    }

    if (!queuedMessages || queuedMessages.length === 0) {
      console.log('✅ No messages due');
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No messages due'
      });
    }

    const queueItem = queuedMessages[0];
    const scheduledFor = new Date(queueItem.scheduled_for);

    // Check if message should be skipped due to weekend or holiday
    if (!canSendMessage(scheduledFor)) {
      console.log(`⏳ Message scheduled for weekend/holiday. Will try again on next business day.`);
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'Message scheduled for weekend/holiday - skipped until next business day',
        scheduledFor: queueItem.scheduled_for
      });
    }
    const campaign = queueItem.campaigns as any;
    const prospect = queueItem.campaign_prospects[0];
    const linkedinAccount = campaign.workspace_accounts as any;
    const unipileAccountId = linkedinAccount.unipile_account_id;

    console.log(`\n📤 Sending CR to ${prospect.first_name} ${prospect.last_name}`);
    console.log(`   Campaign: ${campaign.campaign_name}`);
    console.log(`   Account: ${linkedinAccount.account_name}`);
    console.log(`   Scheduled: ${queueItem.scheduled_for}`);

    try {
      // 2. Send connection request via Unipile
      const payload = {
        account_id: unipileAccountId,
        provider_id: queueItem.linkedin_user_id,
        message: queueItem.message
      };

      console.log(`📨 Sending to provider_id: ${queueItem.linkedin_user_id}`);

      await unipileRequest('/api/v1/users/invite', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      console.log(`✅ CR sent successfully`);

      // 3. Mark queue item as sent
      await supabase
        .from('send_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', queueItem.id);

      // 4. Update prospect record
      const nextActionAt = new Date();
      nextActionAt.setDate(nextActionAt.getDate() + 3); // 3 days for acceptance

      await supabase
        .from('campaign_prospects')
        .update({
          status: 'connection_request_sent',
          contacted_at: new Date().toISOString(),
          linkedin_user_id: queueItem.linkedin_user_id,
          follow_up_due_at: nextActionAt.toISOString(),
          follow_up_sequence_index: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', prospect.id);

      console.log(`⏰ Next follow-up scheduled for: ${nextActionAt.toISOString()}`);

      // 5. Get count of remaining pending messages
      const { count: remainingCount } = await supabase
        .from('send_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      console.log(`📊 Remaining in queue: ${remainingCount}`);

      return NextResponse.json({
        success: true,
        processed: 1,
        sent_to: `${prospect.first_name} ${prospect.last_name}`,
        campaign: campaign.campaign_name,
        remaining_in_queue: remainingCount,
        message: `✅ CR sent. ${remainingCount} messages remaining in queue`
      });

    } catch (sendError: any) {
      console.error(`❌ Failed to send CR:`, sendError.message);

      // Mark as failed, but don't delete from queue
      await supabase
        .from('send_queue')
        .update({
          status: 'failed',
          error_message: sendError.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', queueItem.id);

      // Update prospect as failed too
      await supabase
        .from('campaign_prospects')
        .update({
          status: 'failed',
          notes: `CR send failed: ${sendError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', prospect.id);

      return NextResponse.json({
        success: false,
        processed: 0,
        error: sendError.message,
        message: `❌ Failed to send CR to ${prospect.first_name}: ${sendError.message}`
      });
    }

  } catch (error: any) {
    console.error('❌ Cron job error:', error);
    return NextResponse.json(
      { error: error.message || 'Cron job failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Process Send Queue',
    description: 'Sends one queued CR per minute (throttled, safe approach)',
    endpoint: '/api/cron/process-send-queue',
    method: 'POST',
    schedule: '* * * * * (every minute via cron-job.org)',
    behavior: {
      per_execution: '1 message',
      rate: '1 message per minute = 60 messages per hour',
      daily_max: '1440 messages per day (but limited by send_queue size)',
      safety: 'Only processes 1 message at a time, slow and safe'
    },
    requirements: {
      cron_secret: 'x-cron-secret header (matches CRON_SECRET env var)',
      database: 'send_queue table must exist'
    }
  });
}
