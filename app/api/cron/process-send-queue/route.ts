import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import moment from 'moment-timezone';
import {
  getHolidaysForCountry,
  DEFAULT_TIMEZONE,
  BUSINESS_HOURS,
  type ScheduleSettings
} from '@/lib/scheduling-config';
import {
  isMessageWarning,
  MESSAGE_HARD_LIMITS,
  getPreSendDelayMs,
  getMessageVarianceContext
} from '@/lib/anti-detection/message-variance';
import { sendRateLimitNotification } from '@/lib/notifications/notification-router';
import { personalizeMessage } from '@/lib/personalization';

// Countries with Friday-Saturday weekends (Middle East)
const FRIDAY_SATURDAY_WEEKEND_COUNTRIES = ['AE', 'SA', 'KW', 'QA', 'BH', 'OM', 'JO', 'EG'];

// Timezone presets by country (for quick lookup)
const COUNTRY_TIMEZONES: Record<string, string> = {
  US: 'America/New_York',
  CA: 'America/Toronto',
  GB: 'Europe/London',
  DE: 'Europe/Berlin',
  FR: 'Europe/Paris',
  NL: 'Europe/Amsterdam',
  BE: 'Europe/Brussels',
  CH: 'Europe/Zurich',
  AT: 'Europe/Vienna',
  IT: 'Europe/Rome',
  ES: 'Europe/Madrid',
  PT: 'Europe/Lisbon',
  IE: 'Europe/Dublin',
  SE: 'Europe/Stockholm',
  NO: 'Europe/Oslo',
  DK: 'Europe/Copenhagen',
  FI: 'Europe/Helsinki',
  PL: 'Europe/Warsaw',
  GR: 'Europe/Athens',
  ZA: 'Africa/Johannesburg',
  AU: 'Australia/Sydney',
  NZ: 'Pacific/Auckland',
  JP: 'Asia/Tokyo',
  KR: 'Asia/Seoul',
  CN: 'Asia/Shanghai',
  SG: 'Asia/Singapore',
  IN: 'Asia/Kolkata',
  AE: 'Asia/Dubai',
  SA: 'Asia/Riyadh',
  IL: 'Asia/Jerusalem',
};

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

// Extended ScheduleSettings with country support
interface ExtendedScheduleSettings extends ScheduleSettings {
  country_code?: string;
}

function canSendMessage(date: Date, settings?: ExtendedScheduleSettings): boolean {
  // Default settings from centralized config
  const countryCode = settings?.country_code || 'US';
  const timezone = settings?.timezone || COUNTRY_TIMEZONES[countryCode] || DEFAULT_TIMEZONE;
  const startHour = settings?.working_hours_start ?? BUSINESS_HOURS.start;
  const endHour = settings?.working_hours_end ?? BUSINESS_HOURS.end;
  const skipWeekends = settings?.skip_weekends ?? true;
  const skipHolidays = settings?.skip_holidays ?? true;

  // Convert to target timezone
  const localTime = moment(date).tz(timezone);

  // 1. Check Weekend (country-specific)
  if (skipWeekends) {
    const day = localTime.day(); // 0=Sun, 6=Sat

    // Middle East countries: Friday-Saturday weekend
    if (FRIDAY_SATURDAY_WEEKEND_COUNTRIES.includes(countryCode)) {
      if (day === 5 || day === 6) { // Friday or Saturday
        console.log(`⏸️  Skipping weekend (Fri-Sat) in ${countryCode} (${localTime.format('llll')})`);
        return false;
      }
    } else {
      // Standard Saturday-Sunday weekend
      if (day === 0 || day === 6) {
        console.log(`⏸️  Skipping weekend (${localTime.format('llll')})`);
        return false;
      }
    }
  }

  // 2. Check Business Hours
  const currentHour = localTime.hour();
  if (currentHour < startHour || currentHour >= endHour) {
    console.log(`⏸️  Outside business hours (${currentHour}:00 in ${timezone}, ${countryCode})`);
    return false;
  }

  // 3. Check Holidays (country-specific)
  if (skipHolidays) {
    const dateStr = localTime.format('YYYY-MM-DD');
    const holidays = getHolidaysForCountry(countryCode);
    if (holidays.includes(dateStr)) {
      console.log(`🎉 Skipping ${countryCode} holiday (${dateStr})`);
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
    const errorBody = await response.text().catch(() => '');
    let error: any = { message: 'Unknown error' };
    try {
      error = JSON.parse(errorBody);
    } catch {
      error = { message: errorBody || `HTTP ${response.status}` };
    }

    // Log full error for debugging (helps diagnose "Unknown error" failures)
    console.error(`🔴 Unipile API Error [${response.status}] ${endpoint}:`, {
      status: response.status,
      title: error.title,
      message: error.message,
      type: error.type,
      detail: error.detail,
      fullBody: errorBody.substring(0, 500)
    });

    // Include type and detail in error for better status handling
    // FIX (Dec 19): Include detail in message so error handlers can match specific errors
    const errorParts = [error.title || error.message || `HTTP ${response.status}`];
    if (error.detail) errorParts.push(error.detail);
    const errorMsg = errorParts.join(': ');
    const err = new Error(errorMsg);
    (err as any).type = error.type;
    (err as any).status = response.status;
    (err as any).detail = error.detail;
    throw err;
  }

  return response.json();
}

/**
 * Extract LinkedIn slug from URL or return as-is if already a slug
 * FIX (Dec 18): Helper function to extract slug from URLs like https://www.linkedin.com/in/john-doe/
 */
function extractLinkedInSlug(urlOrSlug: string): string {
  if (!urlOrSlug) return '';
  // If it's already just a slug, return it
  if (!urlOrSlug.includes('/') && !urlOrSlug.includes('http')) return urlOrSlug;
  // Extract slug from URL like https://www.linkedin.com/in/john-doe/
  const match = urlOrSlug.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  return match ? match[1] : urlOrSlug;
}

/**
 * Resolve LinkedIn URL or vanity to provider_id
 * If already a provider_id (starts with ACo or ACw), return as-is
 * Otherwise, extract vanity from URL and lookup via Unipile
 */
async function resolveToProviderId(linkedinUserIdOrUrl: string, accountId: string): Promise<string> {
  // Already a provider_id (ACo or ACw format - both are valid LinkedIn provider IDs)
  if (linkedinUserIdOrUrl.startsWith('ACo') || linkedinUserIdOrUrl.startsWith('ACw')) {
    return linkedinUserIdOrUrl;
  }

  // FIX (Dec 18): Extract slug from URL before resolving
  const vanity = extractLinkedInSlug(linkedinUserIdOrUrl);

  console.log(`🔍 Resolving vanity "${vanity}" to provider_id...`);

  // Use legacy endpoint (NOT /api/v1/users/profile?identifier= which is broken for vanities with numbers)
  const profile = await unipileRequest(`/api/v1/users/${encodeURIComponent(vanity)}?account_id=${accountId}`);

  if (!profile.provider_id) {
    throw new Error(`Could not resolve provider_id for: ${vanity}`);
  }

  console.log(`✅ Resolved to provider_id: ${profile.provider_id}`);
  return profile.provider_id;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Log activity to database for auditing and debugging
 */
async function logActivity(
  actionType: string,
  actionStatus: 'success' | 'failed' | 'skipped',
  details: Record<string, any>,
  options?: {
    workspaceId?: string;
    campaignId?: string;
    prospectId?: string;
    errorMessage?: string;
    durationMs?: number;
  }
) {
  try {
    await supabase.from('system_activity_log').insert({
      workspace_id: options?.workspaceId || null,
      campaign_id: options?.campaignId || null,
      prospect_id: options?.prospectId || null,
      action_type: actionType,
      action_status: actionStatus,
      details,
      error_message: options?.errorMessage || null,
      duration_ms: options?.durationMs || null,
    });
  } catch (logError) {
    console.error('Failed to log activity:', logError);
  }
}

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
    // FIX (Dec 18): Atomically lock queue items to prevent race condition duplicates
    let queueItem = null;
    let skippedAccounts: string[] = [];

    for (const candidate of queuedMessages) {
      // Quick check: have we already skipped this campaign's account?
      const candidateCampaignId = candidate.campaign_id;

      // Get campaign to check LinkedIn account and schedule settings
      const { data: candidateCampaign } = await supabase
        .from('campaigns')
        .select('linkedin_account_id, schedule_settings, country_code, timezone, working_hours_start, working_hours_end, skip_weekends, skip_holidays')
        .eq('id', candidateCampaignId)
        .single();

      if (!candidateCampaign) continue;

      const accountId = candidateCampaign.linkedin_account_id;

      // Skip if we already know this account is blocked
      if (skippedAccounts.includes(accountId)) continue;

      // Build schedule settings from campaign fields or schedule_settings JSON
      const scheduleSettings: ExtendedScheduleSettings = {
        country_code: candidateCampaign.country_code || candidateCampaign.schedule_settings?.country_code || 'US',
        timezone: candidateCampaign.timezone || candidateCampaign.schedule_settings?.timezone,
        working_hours_start: candidateCampaign.working_hours_start ?? candidateCampaign.schedule_settings?.working_hours_start,
        working_hours_end: candidateCampaign.working_hours_end ?? candidateCampaign.schedule_settings?.working_hours_end,
        skip_weekends: candidateCampaign.skip_weekends ?? candidateCampaign.schedule_settings?.skip_weekends ?? true,
        skip_holidays: candidateCampaign.skip_holidays ?? candidateCampaign.schedule_settings?.skip_holidays ?? true,
      };

      // Check business hours/weekends/holidays for this campaign's target country
      if (!canSendMessage(new Date(), scheduleSettings)) {
        console.log(`⏸️  Campaign ${candidateCampaignId} blocked by schedule`);
        skippedAccounts.push(accountId);
        continue;
      }

      // Check spacing for this account
      // ANTI-DETECTION: Use MESSAGE_HARD_LIMITS.MIN_CR_GAP_MINUTES from randomizer
      const minSpacingMinutes = MESSAGE_HARD_LIMITS.MIN_CR_GAP_MINUTES; // 20 min
      const spacingCutoff = new Date(Date.now() - minSpacingMinutes * 60 * 1000);

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
        console.log(`⏸️  Account ${accountId} blocked by ${minSpacingMinutes}-min spacing`);
        skippedAccounts.push(accountId);
        continue;
      }

      // Check daily caps for this account using MESSAGE_HARD_LIMITS from randomizer
      const DAILY_CR_LIMIT = MESSAGE_HARD_LIMITS.MAX_CONNECTION_REQUESTS_PER_DAY; // 25
      const DAILY_MESSAGE_LIMIT = MESSAGE_HARD_LIMITS.MAX_MESSAGES_PER_DAY; // 50
      const HOURLY_CR_LIMIT = MESSAGE_HARD_LIMITS.MAX_CONNECTION_REQUESTS_PER_HOUR; // 5
      const HOURLY_MESSAGE_LIMIT = MESSAGE_HARD_LIMITS.MAX_MESSAGES_PER_HOUR; // 10

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const hourStart = new Date();
      hourStart.setMinutes(0, 0, 0);

      // Get today's sends with message_type to count separately
      const { data: sentToday } = await supabase
        .from('send_queue')
        .select('id, message_type, sent_at')
        .eq('status', 'sent')
        .in('campaign_id', accountCampaignIds)
        .gte('sent_at', todayStart.toISOString());

      // Count CRs vs messages separately (daily)
      const crsSentToday = (sentToday || []).filter(s =>
        s.message_type === 'connection_request' || !s.message_type
      ).length;
      const messagesSentToday = (sentToday || []).filter(s =>
        s.message_type && s.message_type !== 'connection_request'
      ).length;

      // Count CRs vs messages this hour (burst protection)
      const crsSentThisHour = (sentToday || []).filter(s =>
        (s.message_type === 'connection_request' || !s.message_type) &&
        new Date(s.sent_at) >= hourStart
      ).length;
      const messagesSentThisHour = (sentToday || []).filter(s =>
        s.message_type && s.message_type !== 'connection_request' &&
        new Date(s.sent_at) >= hourStart
      ).length;

      // Determine which type this candidate is
      const candidateType = candidate.message_type || 'connection_request';
      const isCR = candidateType === 'connection_request';

      // Check HOURLY limits first (burst protection from randomizer)
      if (isCR && crsSentThisHour >= HOURLY_CR_LIMIT) {
        console.log(`⏸️  Account ${accountId} hit CR hourly cap (${crsSentThisHour}/${HOURLY_CR_LIMIT})`);
        skippedAccounts.push(accountId);
        continue;
      }
      if (!isCR && messagesSentThisHour >= HOURLY_MESSAGE_LIMIT) {
        console.log(`⏸️  Account ${accountId} hit message hourly cap (${messagesSentThisHour}/${HOURLY_MESSAGE_LIMIT})`);
        skippedAccounts.push(accountId);
        continue;
      }

      // Check DAILY limits
      if (isCR && crsSentToday >= DAILY_CR_LIMIT) {
        console.log(`⏸️  Account ${accountId} hit CR daily cap (${crsSentToday}/${DAILY_CR_LIMIT})`);
        skippedAccounts.push(accountId);

        // Send rate limit notification (only once per day per account)
        // Check if we already notified today using a simple in-memory check per request
        // For persistence, we check if crsSentToday == DAILY_CR_LIMIT (first time hitting limit)
        if (crsSentToday === DAILY_CR_LIMIT) {
          const { data: accountInfo } = await supabase
            .from('workspace_accounts')
            .select('account_name, workspace_id')
            .eq('id', accountId)
            .single();

          if (accountInfo?.workspace_id) {
            // Count pending items for this account's campaigns
            const { count: pendingCount } = await supabase
              .from('send_queue')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'pending')
              .in('campaign_id', accountCampaignIds);

            // Send rate limit notification via unified router (Slack or Google Chat)
            sendRateLimitNotification({
              workspaceId: accountInfo.workspace_id,
              accountName: accountInfo.account_name || 'LinkedIn Account',
              limitType: 'connection_request',
              current: crsSentToday,
              limit: DAILY_CR_LIMIT,
              pendingCount: pendingCount || 0,
            }).catch(err => console.warn('Rate limit notification failed:', err));
          }
        }
        continue;
      }
      if (!isCR && messagesSentToday >= DAILY_MESSAGE_LIMIT) {
        console.log(`⏸️  Account ${accountId} hit message daily cap (${messagesSentToday}/${DAILY_MESSAGE_LIMIT})`);
        skippedAccounts.push(accountId);

        // Send rate limit notification for messages
        if (messagesSentToday === DAILY_MESSAGE_LIMIT) {
          const { data: accountInfo } = await supabase
            .from('workspace_accounts')
            .select('account_name, workspace_id')
            .eq('id', accountId)
            .single();

          if (accountInfo?.workspace_id) {
            const { count: pendingCount } = await supabase
              .from('send_queue')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'pending')
              .in('campaign_id', accountCampaignIds);

            // Send rate limit notification via unified router (Slack or Google Chat)
            sendRateLimitNotification({
              workspaceId: accountInfo.workspace_id,
              accountName: accountInfo.account_name || 'LinkedIn Account',
              limitType: 'message',
              current: messagesSentToday,
              limit: DAILY_MESSAGE_LIMIT,
              pendingCount: pendingCount || 0,
            }).catch(err => console.warn('Rate limit notification failed:', err));
          }
        }
        continue;
      }

      console.log(`📊 Account ${accountId.substring(0, 8)}... today: ${crsSentToday}/${DAILY_CR_LIMIT} CRs, ${messagesSentToday}/${DAILY_MESSAGE_LIMIT} msgs | hour: ${crsSentThisHour}/${HOURLY_CR_LIMIT} CRs, ${messagesSentThisHour}/${HOURLY_MESSAGE_LIMIT} msgs`);

      // This message can be sent!
      // FIX (Dec 18): Atomically claim this queue item to prevent race condition
      // Update status to 'processing' only if it's still 'pending' (prevents duplicate sends)
      const { data: lockedItem, error: lockError } = await supabase
        .from('send_queue')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', candidate.id)
        .eq('status', 'pending') // CRITICAL: only update if still pending (optimistic locking)
        .select()
        .single();

      if (lockError || !lockedItem) {
        // Another cron job grabbed this item first - try next candidate
        console.log(`⚠️  Queue item ${candidate.id} was already claimed by another process`);
        continue;
      }

      console.log(`🔒 Locked queue item ${lockedItem.id} for processing`);
      queueItem = lockedItem;
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
      .select('id, name, linkedin_account_id, schedule_settings, workspace_id')
      .eq('id', queueItem.campaign_id)
      .single();

    if (campaignError || !campaign) {
      console.error('❌ Campaign not found:', campaignError);
      return NextResponse.json({ error: 'Campaign not found' }, { status: 400 });
    }

    // 3. Fetch workspace account and validate it's the correct type
    console.log(`🔍 Looking for workspace account with ID: ${campaign.linkedin_account_id}`);

    // FIX (Dec 18): Try workspace_accounts first, then user_unipile_accounts
    let linkedinAccount: { unipile_account_id: string; account_name: string; provider?: string } | null = null;
    let accountError: any = null;

    const { data: workspaceAccount, error: wsError } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id, account_name, account_type')
      .eq('id', campaign.linkedin_account_id)
      .single();

    if (workspaceAccount) {
      linkedinAccount = {
        unipile_account_id: workspaceAccount.unipile_account_id,
        account_name: workspaceAccount.account_name,
        provider: workspaceAccount.account_type === 'linkedin' ? 'LINKEDIN' : workspaceAccount.account_type?.toUpperCase()
      };
    } else {
      // Fallback to user_unipile_accounts
      const { data: unipileAccount, error: unipileError } = await supabase
        .from('user_unipile_accounts')
        .select('unipile_account_id, account_name, provider')
        .eq('id', campaign.linkedin_account_id)
        .single();

      if (unipileAccount) {
        linkedinAccount = unipileAccount;
      } else {
        accountError = unipileError || wsError;
      }
    }

    if (accountError || !linkedinAccount) {
      console.error('❌ LinkedIn account not found:', accountError);
      return NextResponse.json({ error: 'LinkedIn account not found' }, { status: 400 });
    }

    // FIX (Dec 18): Validate the account is actually a LinkedIn account for LinkedIn operations
    const campaignType = campaign.type || campaign.campaign_type;
    const isLinkedInCampaign = campaignType === 'connector' || campaignType === 'messenger' || !campaignType;

    if (isLinkedInCampaign && linkedinAccount.provider && linkedinAccount.provider !== 'LINKEDIN') {
      console.error(`❌ Campaign ${campaign.name} is using a ${linkedinAccount.provider} account for LinkedIn operations`);
      // Mark as failed with clear error
      await supabase.from('send_queue').update({
        status: 'failed',
        error_message: `Invalid account type: ${linkedinAccount.provider}. LinkedIn campaigns require a LinkedIn account.`,
        updated_at: new Date().toISOString()
      }).eq('id', queueItem.id);

      // Also update prospect status
      await supabase.from('campaign_prospects').update({
        status: 'failed',
        notes: `Campaign configuration error: Using ${linkedinAccount.provider} account for LinkedIn campaign`,
        updated_at: new Date().toISOString()
      }).eq('id', queueItem.prospect_id);

      return NextResponse.json({
        success: false,
        processed: 0,
        error: `Invalid account type: ${linkedinAccount.provider}. LinkedIn campaigns require a LinkedIn account.`
      }, { status: 400 });
    }

    // Note: Schedule, spacing, and daily cap checks already done in the selection loop above

    // 4. Fetch prospect details (including company_name and title for personalization)
    const { data: prospect, error: prospectError } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, linkedin_url, status, company_name, title')
      .eq('id', queueItem.prospect_id)
      .single();

    if (prospectError || !prospect) {
      console.error('❌ Prospect not found:', prospectError);
      return NextResponse.json({ error: 'Prospect not found' }, { status: 400 });
    }

    const unipileAccountId = linkedinAccount.unipile_account_id;

    // 4.5 CRITICAL: Check if prospect has replied or opted out - STOP all messaging
    const stopStatuses = ['replied', 'opted_out', 'converted', 'not_interested'];
    if (stopStatuses.includes(prospect.status)) {
      console.log(`🛑 Prospect has ${prospect.status} - cancelling all pending messages`);

      // Cancel ALL pending messages for this prospect in this campaign
      const { data: cancelledMessages } = await supabase
        .from('send_queue')
        .update({
          status: 'cancelled',
          error_message: `Prospect ${prospect.status} - messaging stopped`,
          updated_at: new Date().toISOString()
        })
        .eq('campaign_id', queueItem.campaign_id)
        .eq('prospect_id', queueItem.prospect_id)
        .eq('status', 'pending')
        .select('id');

      const cancelledCount = cancelledMessages?.length || 0;
      console.log(`✅ Cancelled ${cancelledCount} pending messages for ${prospect.first_name}`);

      return NextResponse.json({
        success: true,
        processed: 0,
        cancelled: cancelledCount,
        message: `Prospect ${prospect.status} - all pending messages cancelled`
      });
    }

    // 4.6 Check if message requires connection (follow-ups only send if connected)
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
    const isMessengerMessage = messageType.startsWith('direct_message_');
    const isConnectionRequest = messageType === 'connection_request';
    const isOpenInMail = messageType === 'open_inmail';

    console.log(`\n📤 Sending ${messageType} to ${prospect.first_name} ${prospect.last_name}`);
    console.log(`   Campaign: ${campaign.name}`);
    console.log(`   Account: ${linkedinAccount.account_name}`);
    console.log(`   Scheduled: ${queueItem.scheduled_for}`);
    console.log(`   Type: ${isOpenInMail ? 'Open InMail' : isMessengerMessage ? 'Direct Message' : isConnectionRequest ? 'Connection Request' : 'Follow-up'}`);

    // ============================================
    // HUMAN-LIKE DELAYS (Anti-Detection Randomizer)
    // Uses message-variance.ts for human-like behavior
    // Capped at 15s to avoid serverless timeout (60s limit)
    // ============================================

    // Get variance context for this prospect (consistent style per prospect)
    const varianceContext = getMessageVarianceContext(prospect.id, 0, queueItem.message.length);

    // Use randomizer's pre-send delay (30-90s normally, capped for serverless)
    const rawPreSendDelay = getPreSendDelayMs();
    const preSendDelay = Math.min(rawPreSendDelay, 15000); // Cap at 15s for serverless
    console.log(`⏳ Pre-send delay: ${Math.round(preSendDelay / 1000)}s (randomizer: ${Math.round(rawPreSendDelay / 1000)}s)`);
    console.log(`📝 Variance: tone=${varianceContext.tone}, style=${varianceContext.openingStyle}, length=${varianceContext.targetLength}`);
    await new Promise(resolve => setTimeout(resolve, preSendDelay));

    try {
      // 2. Resolve linkedin_user_id to provider_id (handles URLs and vanities)
      // FIX (Dec 19): Extract slug FIRST and persist to DB to prevent infinite retry loops
      let providerId = queueItem.linkedin_user_id;

      // If it's a URL or vanity (not ACo/ACw format), resolve it
      // Both ACo and ACw are valid LinkedIn provider_id formats
      console.log(`🔍🔍🔍 RESOLUTION CHECK: providerId="${providerId}", startsWithACo=${providerId.startsWith('ACo')}, startsWithACw=${providerId.startsWith('ACw')}`);
      if (!providerId.startsWith('ACo') && !providerId.startsWith('ACw')) {
        console.log(`🔄🔄🔄 ENTERING RESOLUTION BRANCH for "${providerId}"`);

        // Step 1: Extract slug FIRST (handles full URLs like https://linkedin.com/in/john-doe)
        const slug = extractLinkedInSlug(providerId);
        console.log(`   Extracted slug: ${slug}`);

        // Step 2: Persist slug to DB IMMEDIATELY (prevents infinite retry of bad URLs)
        // This ensures even if resolution fails, retries will use the clean slug
        if (slug !== providerId) {
          console.log(`   Updating DB with cleaned slug before resolution...`);
          await supabase
            .from('send_queue')
            .update({ linkedin_user_id: slug })
            .eq('id', queueItem.id);
          await supabase
            .from('campaign_prospects')
            .update({ linkedin_user_id: slug })
            .eq('id', prospect.id);
          providerId = slug;
        }

        // Step 3: Now try to resolve slug to provider_id
        console.log(`   🔍 DEBUG: Calling resolveToProviderId("${slug}", "${unipileAccountId}")...`);
        let resolvedProviderId: string;
        try {
          resolvedProviderId = await resolveToProviderId(slug, unipileAccountId);
          console.log(`   🔍 DEBUG: resolveToProviderId returned: "${resolvedProviderId}"`);
          console.log(`   Resolved to provider_id: ${resolvedProviderId}`);
        } catch (resolutionError) {
          console.error(`   ❌❌❌ RESOLUTION FAILED: ${resolutionError instanceof Error ? resolutionError.message : resolutionError}`);
          throw resolutionError; // Re-throw to be caught by outer handler
        }

        // Step 4: Update DB with final provider_id
        await supabase
          .from('send_queue')
          .update({ linkedin_user_id: resolvedProviderId })
          .eq('id', queueItem.id);
        await supabase
          .from('campaign_prospects')
          .update({ linkedin_user_id: resolvedProviderId })
          .eq('id', prospect.id);

        providerId = resolvedProviderId;
      }

      // 3. Personalize message before sending (safety net in case queue-time personalization missed it)
      // This ensures {first_name} and other placeholders are always replaced, even if they were
      // missed during queue creation or if the template changed after queuing
      const personalizedMessage = personalizeMessage(queueItem.message, {
        first_name: prospect.first_name,
        last_name: prospect.last_name,
        company_name: prospect.company_name,
        title: prospect.title
      });

      console.log(`📝 Message personalization check:`);
      console.log(`   Original: "${queueItem.message.substring(0, 80)}..."`);
      console.log(`   Personalized: "${personalizedMessage.substring(0, 80)}..."`);

      // 3. Send message via Unipile
      // CRITICAL: Different endpoints for different message types
      // - Connection Request: POST /api/v1/users/invite
      // - Messenger/Follow-up: POST /api/v1/chats/{chatId}/messages

      if (isConnectionRequest) {
        // CRITICAL DEBUG (Dec 19): Log provider ID to verify resolution worked
        console.log(`🔍 DEBUG: Final providerId = "${providerId}" (starts with ACo: ${providerId.startsWith('ACo')}, ACw: ${providerId.startsWith('ACw')})`);
        console.log(`🔍 DEBUG: Original queueItem.linkedin_user_id = "${queueItem.linkedin_user_id}"`);

        // Send connection request
        const payload = {
          account_id: unipileAccountId,
          provider_id: providerId,
          message: personalizedMessage
        };

        console.log(`📨 Sending connection request:`, JSON.stringify(payload, null, 2));

        await unipileRequest('/api/v1/users/invite', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        console.log(`✅ Connection request sent successfully`);

      } else if (isOpenInMail) {
        // Send Open InMail (free InMail to profiles with Open Profile enabled)
        // Uses Unipile's inmail: true option - free if recipient has Open Profile
        console.log(`📨 Sending Open InMail...`);

        // Check if recipient has Open Profile (optional - for logging)
        let isOpenProfile = false;
        try {
          const profileCheck = await unipileRequest(`/api/v1/users/${providerId}?account_id=${unipileAccountId}`);
          isOpenProfile = profileCheck.is_open_profile === true;
          if (!isOpenProfile) {
            console.warn(`⚠️ Recipient may not have Open Profile - InMail may use credits`);
          }
        } catch (e) {
          console.warn(`⚠️ Could not check Open Profile status`);
        }

        const payload = {
          account_id: unipileAccountId,
          attendees_ids: [providerId],
          text: personalizedMessage,
          options: {
            linkedin: {
              inmail: true  // Critical: enables InMail mode
            }
          }
        };

        console.log(`📨 Sending InMail:`, JSON.stringify(payload, null, 2));

        await unipileRequest('/api/v1/chats', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        console.log(`✅ ${isOpenProfile ? 'Open InMail (free)' : 'InMail'} sent successfully`);

      } else {
        // Send direct message or follow-up
        console.log(`💬 Sending ${isMessengerMessage ? 'direct message' : 'follow-up message'}...`);

        // Use POST /api/v1/chats to start a new chat or message existing connection
        // This is more reliable than searching for existing chats
        // Unipile automatically handles finding/creating the chat thread
        const payload = {
          account_id: unipileAccountId,
          attendees_ids: [providerId], // Array of provider_ids for attendees
          text: personalizedMessage
        };

        console.log(`📨 Starting chat/sending message:`, JSON.stringify(payload, null, 2));

        await unipileRequest('/api/v1/chats', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        console.log(`✅ Message sent successfully`);
      }

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
        platform_message_id: `linkedin_${messageType}_${queueItem.id}`,
        recipient_linkedin_profile: prospect.linkedin_url,
        recipient_name: `${prospect.first_name} ${prospect.last_name}`,
        prospect_id: prospect.id,
        message_content: personalizedMessage,
        message_template_variant: messageType,
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

      // 3.6. Also store in linkedin_messages table for unified message history
      const linkedinMessageRecord = {
        workspace_id: campaign.workspace_id,
        campaign_id: queueItem.campaign_id,
        prospect_id: prospect.id,
        linkedin_account_id: linkedinAccount.id,
        direction: 'outgoing',
        message_type: isConnectionRequest ? 'connection_request' : (isMessengerMessage ? 'message' : 'follow_up'),
        content: personalizedMessage,
        recipient_linkedin_url: prospect.linkedin_url,
        recipient_name: `${prospect.first_name} ${prospect.last_name}`,
        recipient_linkedin_id: queueItem.linkedin_user_id,
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: {
          queue_id: queueItem.id,
          sender_account: linkedinAccount.account_name
        }
      };

      const { error: linkedinMsgError } = await supabase
        .from('linkedin_messages')
        .insert(linkedinMessageRecord);

      if (linkedinMsgError) {
        console.error('⚠️  Failed to store in linkedin_messages:', linkedinMsgError);
      } else {
        console.log('📝 Message stored in linkedin_messages table');
      }

      // 4. Update prospect record
      // FIX (Dec 18): Add error handling to ensure prospect status is updated
      if (isConnectionRequest) {
        // Connection request sent - wait for acceptance before scheduling follow-ups
        // Bug fix: Nov 27 - was incorrectly scheduling follow-ups before acceptance
        const { error: prospectUpdateError } = await supabase
          .from('campaign_prospects')
          .update({
            status: 'connection_request_sent',
            contacted_at: new Date().toISOString(),
            linkedin_user_id: queueItem.linkedin_user_id,
            // follow_up_due_at: NOT SET - wait for acceptance
            follow_up_sequence_index: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', prospect.id);

        if (prospectUpdateError) {
          console.error(`❌ Failed to update prospect status:`, prospectUpdateError.message);
        } else {
          console.log(`✅ CR sent - follow-up will be scheduled when prospect accepts`);
        }

      } else if (isOpenInMail) {
        // Open InMail sent - they're not connected, but we initiated contact
        // Can schedule follow-ups via InMail channel
        const { error: prospectUpdateError } = await supabase
          .from('campaign_prospects')
          .update({
            status: 'inmail_sent',
            contacted_at: new Date().toISOString(),
            linkedin_user_id: queueItem.linkedin_user_id,
            follow_up_sequence_index: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', prospect.id);

        if (prospectUpdateError) {
          console.error(`❌ Failed to update prospect status:`, prospectUpdateError.message);
        } else {
          console.log(`✅ Open InMail sent - prospect contacted via InMail`);
        }

      } else {
        // Messenger message or follow-up sent - update status
        const { error: prospectUpdateError } = await supabase
          .from('campaign_prospects')
          .update({
            status: 'messaging',
            contacted_at: prospect.contacted_at || new Date().toISOString(),
            last_follow_up_at: new Date().toISOString(),
            linkedin_user_id: queueItem.linkedin_user_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', prospect.id);

        if (prospectUpdateError) {
          console.error(`❌ Failed to update prospect status:`, prospectUpdateError.message);
        } else {
          console.log(`✅ ${isMessengerMessage ? 'Direct message' : 'Follow-up'} sent`);
        }
      }

      // 5. Get count of remaining pending messages
      const { count: remainingCount } = await supabase
        .from('send_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      console.log(`📊 Remaining in queue: ${remainingCount}`);

      // Log success to database
      await logActivity('queue_send', 'success', {
        prospect_name: `${prospect.first_name} ${prospect.last_name}`,
        linkedin_url: prospect.linkedin_url,
        message_type: messageType,
        remaining_in_queue: remainingCount,
      }, {
        workspaceId: campaign.workspace_id,
        campaignId: queueItem.campaign_id,
        prospectId: prospect.id,
      });

      return NextResponse.json({
        success: true,
        processed: 1,
        sent_to: `${prospect.first_name} ${prospect.last_name}`,
        campaign: campaign.name,
        remaining_in_queue: remainingCount,
        message: `✅ CR sent. ${remainingCount} messages remaining in queue`
      });

    } catch (sendError: unknown) {
      // CRITICAL FIX (Dec 19): Ensure error message is NEVER raw JSON
      let errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error';
      // If it looks like JSON, try to extract the useful parts
      if (errorMessage.startsWith('{') || errorMessage.startsWith('[')) {
        try {
          const parsed = JSON.parse(errorMessage);
          errorMessage = parsed.detail || parsed.message || parsed.title || errorMessage;
        } catch {
          // Keep as-is if parsing fails
        }
      }
      console.error(`❌ Failed to send CR:`, errorMessage);
      console.error(`   🔍 DEBUG: Raw sendError:`, sendError);

      // Check for LinkedIn warning patterns (rate limits, restrictions)
      const warningCheck = isMessageWarning(errorMessage);
      if (warningCheck.isWarning) {
        console.log(`🚨 LINKEDIN WARNING DETECTED: "${warningCheck.pattern}"`);
        console.log(`🛑 PAUSING campaign ${campaign.id} for 24 hours`);

        // Log warning to activity log
        await logActivity('linkedin_warning', 'failed', {
          warning_pattern: warningCheck.pattern,
          prospect_name: `${prospect.first_name} ${prospect.last_name}`,
          action: 'campaign_paused_24h'
        }, {
          workspaceId: campaign.workspace_id,
          campaignId: campaign.id,
          prospectId: prospect.id,
          errorMessage: `LinkedIn warning: ${warningCheck.pattern}`
        });

        // Reschedule this message for 24 hours later
        const resumeTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await supabase
          .from('send_queue')
          .update({
            status: 'pending', // FIX (Dec 18): Reset to pending so it can be processed again
            scheduled_for: resumeTime.toISOString(),
            error_message: `LinkedIn warning (${warningCheck.pattern}) - rescheduled for ${resumeTime.toISOString()}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', queueItem.id);

        return NextResponse.json({
          success: false,
          processed: 0,
          warning: warningCheck.pattern,
          message: `LinkedIn warning detected - rescheduled for 24 hours`,
          resume_at: resumeTime.toISOString()
        });
      }

      // Determine specific status based on error message
      let prospectStatus = 'failed';
      let queueStatus = 'failed';
      let cleanErrorMessage = errorMessage;
      const errorMsg = errorMessage.toLowerCase();
      const errorStatus = (sendError as any).status;

      // FIX (Dec 19): Handle 422 "profile not found" as permanent failure
      if (errorStatus === 422 || errorMsg.includes('recipient cannot be reached') || errorMsg.includes('invalid_recipient')) {
        // Profile doesn't exist or is locked - permanent failure, don't retry
        prospectStatus = 'failed';
        queueStatus = 'failed';
        cleanErrorMessage = 'LinkedIn profile not found or locked - cannot send';
        console.error(`❌ Profile not found (422): ${errorMessage}`);
      } else if (errorMsg.includes('does not match provider') && errorMsg.includes('format')) {
        // FIX (Dec 19): This is a data format error - should be rare now with slug extraction
        // Mark as failed after the resolution fix - if we still get this, it's a permanent issue
        prospectStatus = 'failed';
        queueStatus = 'failed';
        cleanErrorMessage = 'LinkedIn ID format error - resolution failed';
        console.error(`⚠️ Format error after resolution fix - marking as failed: ${errorMessage}`);
      } else if (errorMsg.includes('invalid_parameters') && !errorMsg.includes('format')) {
        // Generic invalid parameters - could be actual missing profile
        prospectStatus = 'failed';
        queueStatus = 'failed';
        cleanErrorMessage = 'LinkedIn API rejected request - invalid parameters';
      } else if (errorMsg.includes('should delay') || errorMsg.includes('invitation') || errorMsg.includes('already')) {
        // Already has pending invitation
        prospectStatus = 'already_invited';
        queueStatus = 'skipped';
        cleanErrorMessage = 'Already has pending invitation';
      } else if (errorMsg.includes('withdrawn') || errorMsg.includes('declined')) {
        // Previously withdrawn or declined
        prospectStatus = 'invitation_declined';
        queueStatus = 'failed';
        cleanErrorMessage = 'Invitation was withdrawn or declined';
      } else if (errorMsg.includes('rate') || errorMsg.includes('limit') || errorMsg.includes('throttle') || errorMsg.includes('429') || errorMsg.includes('too_many')) {
        // Rate limited - can retry later (includes 429 status and too_many_requests)
        prospectStatus = 'approved'; // FIX: Keep as approved, not rate_limited (avoids status constraint issues)
        queueStatus = 'pending'; // Keep in queue for retry
        // Schedule retry for 1 hour later
        cleanErrorMessage = 'Rate limited - will retry in 1 hour';
      } else if (errorMsg.includes('connected') || errorMsg.includes('first_degree') || errorMsg.includes('1st degree')) {
        // Already connected
        prospectStatus = 'connected';
        queueStatus = 'skipped';
        cleanErrorMessage = 'Already connected';
      } else if (errorMsg.includes('cannot_resend_yet') || errorMsg.includes('resend')) {
        // Cannot resend yet
        prospectStatus = 'already_invited';
        queueStatus = 'skipped';
        cleanErrorMessage = 'Cannot resend invitation yet';
      } else if (errorMsg.includes('cannot_invite_attendee') || errorMsg.includes('cannot invite')) {
        // Cannot invite (LinkedIn restriction)
        prospectStatus = 'failed';
        queueStatus = 'failed';
        cleanErrorMessage = 'LinkedIn blocked invitation (account restriction)';
      }

      // Mark queue item with clean error message
      // For rate limits, also schedule retry for 1 hour later
      const queueUpdate: Record<string, any> = {
        status: queueStatus,
        error_message: cleanErrorMessage,
        updated_at: new Date().toISOString()
      };

      if (queueStatus === 'pending' && cleanErrorMessage.includes('Rate limited')) {
        queueUpdate.scheduled_for = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour delay
      }

      await supabase
        .from('send_queue')
        .update(queueUpdate)
        .eq('id', queueItem.id);

      // Update prospect with specific status
      await supabase
        .from('campaign_prospects')
        .update({
          status: prospectStatus,
          notes: `CR send failed: ${cleanErrorMessage}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', prospect.id);

      // Log to database for auditing
      await logActivity('queue_send', 'failed', {
        prospect_name: `${prospect.first_name} ${prospect.last_name}`,
        linkedin_url: prospect.linkedin_url,
        queue_status: queueStatus,
        prospect_status: prospectStatus,
        error_type: (sendError as any).type || 'unknown',
        api_status: (sendError as any).status || null,
      }, {
        workspaceId: campaign.workspace_id,
        campaignId: queueItem.campaign_id,
        prospectId: prospect.id,
        errorMessage,
      });

      return NextResponse.json({
        success: false,
        processed: 0,
        error: errorMessage,
        message: `❌ Failed to send CR to ${prospect.first_name}: ${errorMessage}`
      });
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Cron job failed';
    console.error('❌ Cron job error:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Process Send Queue',
    description: 'Processes queued CRs for ALL workspaces with per-account limits and country-specific scheduling',
    endpoint: '/api/cron/process-send-queue',
    method: 'POST',
    schedule: '* * * * * (every minute via Netlify scheduled function)',
    limits_per_linkedin_account: {
      daily_max: '20 CRs per day',
      min_spacing: '5 minutes between CRs',
      business_hours: '5 AM - 5 PM (configurable per campaign)',
      weekends: 'Skipped by default - Sat/Sun for most countries, Fri/Sat for Middle East',
      holidays: 'Country-specific holidays (30+ countries supported)'
    },
    country_support: {
      europe: ['DE', 'FR', 'GB', 'NL', 'BE', 'AT', 'CH', 'IT', 'ES', 'PT', 'IE', 'SE', 'NO', 'DK', 'FI', 'PL', 'GR', 'IS'],
      americas: ['US', 'CA', 'MX', 'BR'],
      asia_pacific: ['JP', 'KR', 'CN', 'SG', 'IN', 'AU', 'NZ'],
      middle_east_africa: ['ZA', 'AE', 'SA', 'IL'],
      friday_saturday_weekends: ['AE', 'SA', 'KW', 'QA', 'BH', 'OM', 'JO', 'EG']
    },
    behavior: {
      per_execution: '1 message (picks oldest due across all accounts)',
      multi_tenant: 'Processes ALL workspaces in single run',
      spacing_enforced: 'Checks last sent time per LinkedIn account',
      timezone_aware: 'Uses target country timezone for business hours check'
    },
    requirements: {
      cron_secret: 'x-cron-secret header (matches CRON_SECRET env var)',
      database: 'send_queue, campaigns, workspace_accounts tables'
    }
  });
}
// Build timestamp: 1766139466
