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

import moment from 'moment-timezone';

function canSendMessage(date: Date, settings?: any): boolean {
  // Default settings
  const timezone = settings?.timezone || 'America/New_York';
  const startHour = settings?.working_hours_start ?? 7;
  const endHour = settings?.working_hours_end ?? 18;
  const skipWeekends = settings?.skip_weekends ?? true;
  const skipHolidays = settings?.skip_holidays ?? true;

  // Convert to target timezone
  const localTime = moment(date).tz(timezone);

  // 1. Check Weekend
  if (skipWeekends) {
    const day = localTime.day(); // 0=Sun, 6=Sat
    if (day === 0 || day === 6) {
      console.log(`⏸️  Skipping weekend (${localTime.format('llll')})`);
      return false;
    }
  }

  // 2. Check Business Hours
  const currentHour = localTime.hour();
  if (currentHour < startHour || currentHour >= endHour) {
    console.log(`⏸️  Outside business hours (${currentHour}:00 in ${timezone})`);
    return false;
  }

  // 3. Check Holidays (US Only for now)
  if (skipHolidays) {
    const dateStr = localTime.format('YYYY-MM-DD');
    if (PUBLIC_HOLIDAYS.includes(dateStr)) {
      console.log(`🎉 Skipping public holiday (${dateStr})`);
      return false;
    }
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
    console.log('🕐 Cron request received');
    console.log(`   Secret received: ${cronSecret ? cronSecret.substring(0, 10) + '...' : 'MISSING'}`);
    console.log(`   Expected: ${process.env.CRON_SECRET ? process.env.CRON_SECRET.substring(0, 10) + '...' : 'NOT SET'}`);

    if (cronSecret !== process.env.CRON_SECRET) {
      console.warn(`⚠️  Unauthorized cron request - secret mismatch`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ Cron secret validated. Processing send queue...');

    // 1. Find due messages (get more than 1 so we can skip blocked accounts)
    const now = new Date().toISOString();
    console.log(`⏰ Current time: ${now}`);

    const { data: queuedMessages, error: fetchError } = await supabase
      .from('send_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(50); // Get up to 50 to find a sendable one

    if (fetchError) {
      console.error('❌ Queue fetch error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 });
    }

    console.log(`📋 Found ${queuedMessages?.length || 0} messages due`);

    if (!queuedMessages || queuedMessages.length === 0) {
      console.log('✅ No messages due');
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No messages due'
      });
    }

    // Try each message until we find one we can send
    let queueItem = null;
    let skippedAccounts: string[] = [];

    for (const candidate of queuedMessages) {
      // Quick check: have we already skipped this campaign's account?
      const candidateCampaignId = candidate.campaign_id;

      // Get campaign to check LinkedIn account
      const { data: candidateCampaign } = await supabase
        .from('campaigns')
        .select('linkedin_account_id, schedule_settings')
        .eq('id', candidateCampaignId)
        .single();

      if (!candidateCampaign) continue;

      const accountId = candidateCampaign.linkedin_account_id;

      // Skip if we already know this account is blocked
      if (skippedAccounts.includes(accountId)) continue;

      // Check business hours/weekends/holidays for this campaign
      if (!canSendMessage(new Date(), candidateCampaign.schedule_settings)) {
        console.log(`⏸️  Campaign ${candidateCampaignId} blocked by schedule`);
        skippedAccounts.push(accountId);
        continue;
      }

      // Check 30-min spacing for this account
      const MIN_SPACING_MINUTES = 30;
      const spacingCutoff = new Date(Date.now() - MIN_SPACING_MINUTES * 60 * 1000);

      const { data: accountCampaigns } = await supabase
        .from('campaigns')
        .select('id')
        .eq('linkedin_account_id', accountId);

      const accountCampaignIds = accountCampaigns?.map(c => c.id) || [];

      const { data: recentlySent } = await supabase
        .from('send_queue')
        .select('sent_at')
        .eq('status', 'sent')
        .in('campaign_id', accountCampaignIds)
        .gte('sent_at', spacingCutoff.toISOString())
        .limit(1);

      if (recentlySent && recentlySent.length > 0) {
        console.log(`⏸️  Account ${accountId} blocked by 30-min spacing`);
        skippedAccounts.push(accountId);
        continue;
      }

      // Check daily cap for this account
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: sentToday } = await supabase
        .from('send_queue')
        .select('id')
        .eq('status', 'sent')
        .in('campaign_id', accountCampaignIds)
        .gte('sent_at', todayStart.toISOString());

      if ((sentToday?.length || 0) >= 20) {
        console.log(`⏸️  Account ${accountId} blocked by daily cap (20/day)`);
        skippedAccounts.push(accountId);
        continue;
      }

      // This message can be sent!
      queueItem = candidate;
      break;
    }

    if (!queueItem) {
      console.log(`✅ No sendable messages (${skippedAccounts.length} accounts blocked)`);
      return NextResponse.json({
        success: true,
        processed: 0,
        message: `All due messages blocked by limits`,
        skipped_accounts: skippedAccounts.length
      });
    }
    console.log(`🔍 Processing queue item:`, {
      id: queueItem.id,
      campaign_id: queueItem.campaign_id,
      prospect_id: queueItem.prospect_id,
      linkedin_user_id: queueItem.linkedin_user_id,
      scheduled_for: queueItem.scheduled_for
    });

    // 2. Fetch campaign details (already validated in loop, but need full data)
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, campaign_name, linkedin_account_id, schedule_settings, workspace_id')
      .eq('id', queueItem.campaign_id)
      .single();

    if (campaignError || !campaign) {
      console.error('❌ Campaign not found:', campaignError);
      return NextResponse.json({ error: 'Campaign not found' }, { status: 400 });
    }

    // 3. Fetch workspace account
    console.log(`🔍 Looking for workspace account with ID: ${campaign.linkedin_account_id}`);
    const { data: linkedinAccount, error: accountError } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id, account_name')
      .eq('id', campaign.linkedin_account_id)
      .single();

    if (accountError || !linkedinAccount) {
      console.error('❌ LinkedIn account not found:', accountError);
      return NextResponse.json({ error: 'LinkedIn account not found' }, { status: 400 });
    }

    // Note: Schedule, spacing, and daily cap checks already done in the selection loop above

    // 4. Fetch prospect details
    const { data: prospect, error: prospectError } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, linkedin_url, status')
      .eq('id', queueItem.prospect_id)
      .single();

    if (prospectError || !prospect) {
      console.error('❌ Prospect not found:', prospectError);
      return NextResponse.json({ error: 'Prospect not found' }, { status: 400 });
    }

    const unipileAccountId = linkedinAccount.unipile_account_id;

    // 4.5 Check if message requires connection (follow-ups only send if connected)
    if (queueItem.requires_connection) {
      console.log(`🔍 Message requires connection - checking prospect status`);
      console.log(`   Prospect status: ${prospect.status}`);

      const connectedStatuses = ['connected', 'messaging', 'replied'];
      if (!connectedStatuses.includes(prospect.status)) {
        console.log(`⏭️  Skipping message - prospect not connected yet (status: ${prospect.status})`);

        // Mark as skipped (not failed) - we might retry later
        await supabase
          .from('send_queue')
          .update({
            status: 'skipped',
            error_message: `Connection not accepted yet (prospect status: ${prospect.status})`,
            updated_at: new Date().toISOString()
          })
          .eq('id', queueItem.id);

        return NextResponse.json({
          success: true,
          processed: 0,
          skipped: 1,
          message: 'Message requires connection - prospect not connected yet'
        });
      }

      console.log(`✅ Prospect is connected - proceeding with follow-up message`);
    }

    const messageType = queueItem.message_type || 'connection_request';
    console.log(`\n📤 Sending ${messageType} to ${prospect.first_name} ${prospect.last_name}`);
    console.log(`   Campaign: ${campaign.campaign_name}`);
    console.log(`   Account: ${linkedinAccount.account_name}`);
    console.log(`   Scheduled: ${queueItem.scheduled_for}`);

    try {
      // 2. Send message via Unipile (CR or follow-up)
      const payload = {
        account_id: unipileAccountId,
        provider_id: queueItem.linkedin_user_id,
        message: queueItem.message
      };

      console.log(`📨 Unipile payload:`, JSON.stringify(payload, null, 2));
      console.log(`📨 Account ID: ${unipileAccountId}`);
      console.log(`📨 Provider ID: ${queueItem.linkedin_user_id}`);

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

      // 3.5. Store message in campaign_messages table for tracking
      const messageRecord = {
        campaign_id: queueItem.campaign_id,
        workspace_id: campaign.workspace_id,
        platform: 'linkedin',
        platform_message_id: `linkedin_cr_${queueItem.id}`,
        recipient_linkedin_profile: prospect.linkedin_url,
        recipient_name: `${prospect.first_name} ${prospect.last_name}`,
        prospect_id: prospect.id,
        message_content: queueItem.message,
        message_template_variant: 'connection_request',
        sent_at: new Date().toISOString(),
        sent_via: 'queue_cron',
        sender_account: linkedinAccount.account_name,
        expects_reply: true,
        delivery_status: 'sent'
      };

      const { error: messageError } = await supabase
        .from('campaign_messages')
        .insert(messageRecord);

      if (messageError) {
        console.error('⚠️  Failed to store message in campaign_messages:', messageError);
        // Don't fail the whole operation, just log it
      } else {
        console.log('📝 Message stored in campaign_messages table');
      }

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
    description: 'Processes queued CRs for ALL workspaces with per-account limits',
    endpoint: '/api/cron/process-send-queue',
    method: 'POST',
    schedule: '* * * * * (every minute via Netlify scheduled function)',
    limits_per_linkedin_account: {
      daily_max: '20 CRs per day',
      min_spacing: '30 minutes between CRs',
      business_hours: '7 AM - 6 PM (configurable per campaign)',
      weekends: 'Skipped by default (configurable)',
      holidays: 'US holidays skipped by default (configurable)'
    },
    behavior: {
      per_execution: '1 message (picks oldest due across all accounts)',
      multi_tenant: 'Processes ALL workspaces in single run',
      spacing_enforced: 'Checks last sent time per LinkedIn account'
    },
    requirements: {
      cron_secret: 'x-cron-secret header (matches CRON_SECRET env var)',
      database: 'send_queue, campaigns, workspace_accounts tables'
    }
  });
}
