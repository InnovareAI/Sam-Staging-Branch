import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import moment from 'moment-timezone';
import {
  PUBLIC_HOLIDAYS,
  DEFAULT_TIMEZONE,
  BUSINESS_HOURS,
  type ScheduleSettings
} from '@/lib/scheduling-config';

/**
 * POST /api/campaigns/direct/send-messages-queued
 *
 * Queue-based messenger campaign execution for ALREADY CONNECTED prospects
 *
 * KEY DIFFERENCE from send-connection-requests-queued:
 * - No connection request is sent (prospects are already connected)
 * - Messages are direct LinkedIn messages via /api/v1/chats/{chatId}/messages
 * - message_type = 'direct_message_1', 'direct_message_2', etc.
 * - requires_connection = false (since they're already connected)
 *
 * FLOW:
 * 1. Validate campaign is messenger type
 * 2. Validate all prospects are already connected
 * 3. Queue all messages (first message + follow-ups) with scheduled times
 * 4. Return immediately (<2 seconds)
 * 5. Cron job processes queue every minute
 *
 * Body: { campaignId: string }
 */

export const maxDuration = 10; // 10 seconds max

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

function calculateNextSendTime(
  baseTime: Date,
  prospectIndex: number,
  messageIndex: number,
  followUpDelayDays: number[],
  settings?: ScheduleSettings,
  cumulativeMinutes?: number // Pre-calculated cumulative random offset for this prospect
): Date {
  const timezone = settings?.timezone || DEFAULT_TIMEZONE;
  const startHour = settings?.working_hours_start ?? BUSINESS_HOURS.start;
  const endHour = settings?.working_hours_end ?? BUSINESS_HOURS.end;
  const skipWeekends = settings?.skip_weekends ?? true;
  const skipHolidays = settings?.skip_holidays ?? true;

  // RANDOMIZED SCHEDULING (Dec 11, 2025)
  // Use pre-calculated cumulative minutes if provided, otherwise use deterministic random
  // This makes timing look more human-like

  // Calculate initial scheduled time
  let scheduledTime = moment(baseTime).tz(timezone);

  // For first message: add cumulative random spacing
  if (messageIndex === 0) {
    if (cumulativeMinutes !== undefined) {
      // Use pre-calculated cumulative offset (randomized)
      scheduledTime = scheduledTime.add(cumulativeMinutes, 'minutes');
    } else {
      // Fallback: deterministic pseudo-random based on prospectIndex
      // Range: 20-45 minutes per prospect (avg 32.5 min)
      const seed = prospectIndex * 7919; // Prime number for better distribution
      const randomOffset = 20 + (seed % 26); // 20-45 range
      const cumulativeOffset = prospectIndex > 0
        ? prospectIndex * randomOffset
        : 0;
      scheduledTime = scheduledTime.add(cumulativeOffset, 'minutes');
    }
  } else {
    // For follow-ups: add days based on follow-up delay
    const delayDays = followUpDelayDays[messageIndex - 1] || 3;
    scheduledTime = scheduledTime.add(delayDays, 'days');
  }

  // Set to business hours start if before
  if (scheduledTime.hour() < startHour) {
    scheduledTime = scheduledTime.hour(startHour).minute(0).second(0);
  }

  // Skip weekends, holidays, and after-hours
  while (true) {
    const dayOfWeek = scheduledTime.day();
    const dateStr = scheduledTime.format('YYYY-MM-DD');

    // Check weekend
    if (skipWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 2;
      scheduledTime = scheduledTime.add(daysUntilMonday, 'days').hour(startHour).minute(0).second(0);
      continue;
    }

    // Check holiday
    if (skipHolidays && PUBLIC_HOLIDAYS.includes(dateStr)) {
      scheduledTime = scheduledTime.add(1, 'day').hour(startHour).minute(0).second(0);
      continue;
    }

    // Check business hours
    if (scheduledTime.hour() >= endHour) {
      scheduledTime = scheduledTime.add(1, 'day').hour(startHour).minute(0).second(0);
      continue;
    }

    break;
  }

  return scheduledTime.toDate();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const authClient = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const { campaignId } = await req.json();

    if (!campaignId) {
      return NextResponse.json({
        success: false,
        error: 'campaignId required'
      }, { status: 400 });
    }

    console.log(`🚀 Queuing messenger campaign: ${campaignId}`);

    // 1. Fetch campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        campaign_type,
        message_templates,
        schedule_settings,
        linkedin_account_id,
        workspace_id,
        workspace_accounts!linkedin_account_id (
          id,
          unipile_account_id,
          account_name
        )
      `)
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('Campaign not found:', campaignError);
      return NextResponse.json({
        success: false,
        error: 'Campaign not found'
      }, { status: 404 });
    }

    // Validate campaign type is messenger
    if (campaign.campaign_type !== 'messenger') {
      return NextResponse.json({
        success: false,
        error: 'This endpoint is for messenger campaigns only. Use send-connection-requests-queued for connector campaigns.'
      }, { status: 400 });
    }

    const linkedinAccount = campaign.workspace_accounts as any;
    const unipileAccountId = linkedinAccount?.unipile_account_id;

    if (!unipileAccountId) {
      return NextResponse.json({
        success: false,
        error: 'No LinkedIn account configured for this campaign'
      }, { status: 400 });
    }

    console.log(`📋 Campaign: ${campaign.name} (Messenger)`);
    console.log(`👤 LinkedIn Account: ${linkedinAccount.account_name} (${unipileAccountId})`);

    // 2. Fetch pending prospects
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'approved', 'connected']) // Must be connected or marked as such
      .not('linkedin_url', 'is', null)
      .order('created_at', { ascending: true });

    if (prospectsError) {
      console.error('Error fetching prospects:', prospectsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch prospects'
      }, { status: 500 });
    }

    if (!prospects || prospects.length === 0) {
      return NextResponse.json({
        success: true,
        queued: 0,
        message: 'No pending prospects to queue'
      });
    }

    console.log(`📊 Found ${prospects.length} prospects to queue`);

    // ==========================================
    // PRE-FLIGHT VALIDATION: Check ALL prospects are connected BEFORE processing any
    // This prevents silent one-by-one failures - fail fast with clear error
    // ==========================================
    console.log(`🔍 Pre-flight check: Validating prospects are 1st degree connections...`);

    // Check up to first 10 prospects (or all if fewer)
    const sampleSize = Math.min(prospects.length, 10);
    const sampleProspects = prospects.slice(0, sampleSize);

    const connectionChecks = await Promise.all(
      sampleProspects.map(async (p) => {
        try {
          // CRITICAL FIX (Dec 8): Use vanity URL endpoint, NOT provider_id endpoint
          // Unipile's profile?provider_id= returns WRONG profiles (returns Jamshaid Ali for Paul Dhaliwal!)
          // The legacy /users/{vanity} endpoint works correctly

          // Extract vanity from LinkedIn URL
          const vanityMatch = p.linkedin_url?.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
          const vanity = vanityMatch?.[1];

          if (!vanity) {
            return { id: p.id, name: `${p.first_name} ${p.last_name}`, connected: false, reason: 'No LinkedIn URL' };
          }

          // Use legacy endpoint that actually works correctly
          const profile = await unipileRequest(
            `/api/v1/users/${vanity}?account_id=${unipileAccountId}`
          );

          return {
            id: p.id,
            name: `${p.first_name} ${p.last_name}`,
            connected: profile?.network_distance === 'FIRST_DEGREE',
            distance: profile?.network_distance || 'UNKNOWN'
          };
        } catch (err) {
          return { id: p.id, name: `${p.first_name} ${p.last_name}`, connected: false, reason: 'API error' };
        }
      })
    );

    const notConnected = connectionChecks.filter(c => !c.connected);

    if (notConnected.length > 0) {
      // Categorize failures for clearer error message
      const missingIds = notConnected.filter(c => c.reason === 'No LinkedIn ID');
      const notFirstDegree = notConnected.filter(c => c.distance && c.distance !== 'FIRST_DEGREE');
      const apiErrors = notConnected.filter(c => c.reason === 'API error');

      console.error(`❌ Pre-flight FAILED: ${notConnected.length}/${sampleSize} prospects cannot receive messages`);
      notConnected.forEach(nc => console.log(`   - ${nc.name}: ${nc.distance || nc.reason}`));

      // Build a clear error message
      let errorParts: string[] = [];
      if (missingIds.length > 0) {
        errorParts.push(`${missingIds.length} missing LinkedIn user ID (need to resolve URLs first)`);
      }
      if (notFirstDegree.length > 0) {
        errorParts.push(`${notFirstDegree.length} not 1st degree connections (use Connector campaign first)`);
      }
      if (apiErrors.length > 0) {
        errorParts.push(`${apiErrors.length} failed API check`);
      }

      return NextResponse.json({
        success: false,
        error: `Messenger campaigns require 1st degree connections with resolved LinkedIn IDs. Issues found: ${errorParts.join(', ')}.`,
        suggestion: missingIds.length > 0
          ? 'Prospects need LinkedIn user IDs. Re-upload with LinkedIn URLs or use the resolve-ids endpoint first.'
          : 'Use a Connector campaign to send connection requests first.',
        notConnected: notConnected.map(c => ({ name: c.name, reason: c.distance || c.reason })),
        breakdown: { missingIds: missingIds.length, notFirstDegree: notFirstDegree.length, apiErrors: apiErrors.length },
        checkedCount: sampleSize,
        totalProspects: prospects.length
      }, { status: 400 });
    }

    console.log(`✅ Pre-flight PASSED: All ${sampleSize} sampled prospects are 1st degree connections`);

    // 3. Extract messages from campaign
    // MESSENGER CAMPAIGNS: Use direct_message_1/2/3 keys (NO connection request)
    // CONNECTOR CAMPAIGNS: Use connection_request + follow_ups (legacy support)
    const messageTemplates = campaign.message_templates || {};

    // Check for messenger-style keys first (direct_message_1, direct_message_2, etc.)
    const messengerMessages = [];
    for (let i = 1; i <= 5; i++) {
      const msg = messageTemplates[`direct_message_${i}`];
      if (msg && msg.trim()) messengerMessages.push(msg);
    }

    // Fallback to connector-style keys if no messenger keys found
    let allMessages: string[];
    if (messengerMessages.length > 0) {
      allMessages = messengerMessages;
      console.log(`📝 Using messenger template format (${allMessages.length} direct messages)`);
    } else {
      const firstMessage = messageTemplates.connection_request || messageTemplates.first_message || '';
      const followUpMessages = messageTemplates.follow_up_messages || [];
      allMessages = [firstMessage, ...followUpMessages].filter(m => m && m.trim() !== '');
      console.log(`📝 Using connector template format (first + ${followUpMessages.length} follow-ups)`);
    }

    if (allMessages.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Campaign has no messages configured'
      }, { status: 400 });
    }

    console.log(`📝 Campaign has ${allMessages.length} messages to queue per prospect`);

    // A/B Testing: Check if enabled and get variant B message
    const abTestingEnabled = messageTemplates.ab_testing_enabled || false;
    // For messenger campaigns, alternative_message_b is the variant B of the first message
    const alternativeMessageB = messageTemplates.alternative_message_b || null;

    if (abTestingEnabled && alternativeMessageB) {
      console.log('🧪 A/B Testing ENABLED - will alternate first message between variants A and B (50/50)');
    } else if (abTestingEnabled && !alternativeMessageB) {
      console.log('⚠️ A/B Testing enabled but no Variant B message found - using Variant A only');
    }

    // 4. Follow-up delays (in days) - default to 3, 5, 7, 5, 7 for up to 5 follow-ups
    const followUpDelayDays = messageTemplates.follow_up_delays || [3, 5, 7, 5, 7];

    // 5. Queue all messages for all prospects
    const queueRecords = [];
    const validationResults = [];
    const now = new Date();

    // RANDOMIZED SCHEDULING (Dec 11, 2025)
    // Pre-calculate cumulative random offsets for each prospect
    // Range: 20-45 minutes per prospect (avg 32.5 min)
    const cumulativeOffsets: number[] = [];
    let cumulativeMinutes = Math.floor(Math.random() * 15); // Initial random offset 0-15 min
    for (let i = 0; i < prospects.length; i++) {
      cumulativeOffsets.push(cumulativeMinutes);
      const randomInterval = 20 + Math.floor(Math.random() * 26); // 20-45 range
      cumulativeMinutes += randomInterval;
    }
    console.log(`📅 Scheduling with random intervals (20-45 min). First 3 offsets: ${cumulativeOffsets.slice(0, 3).join(', ')} min`);

    for (let prospectIndex = 0; prospectIndex < prospects.length; prospectIndex++) {
      const prospect = prospects[prospectIndex];

      try {
        // CRITICAL: Validate prospect is actually connected
        // For messenger campaigns, we REQUIRE prospects to be already connected
        console.log(`\n👤 Validating prospect ${prospectIndex + 1}/${prospects.length}: ${prospect.first_name} ${prospect.last_name}`);

        // Check if we have their provider_id (LinkedIn user ID)
        let providerId = prospect.linkedin_user_id;

        // If not, try to resolve it from their LinkedIn URL
        if (!providerId) {
          console.log(`📝 Resolving LinkedIn user ID from URL...`);
          const vanityMatch = prospect.linkedin_url?.match(/linkedin\.com\/in\/([^\/\?#]+)/);
          if (!vanityMatch) {
            validationResults.push({
              prospectId: prospect.id,
              name: `${prospect.first_name} ${prospect.last_name}`,
              status: 'skipped',
              reason: 'Invalid LinkedIn URL'
            });
            continue;
          }

          const vanityId = vanityMatch[1];

          // Use legacy endpoint to get provider_id
          try {
            const profile = await unipileRequest(`/api/v1/users/${vanityId}?account_id=${unipileAccountId}`);
            providerId = profile.provider_id;

            // Update prospect with resolved provider_id
            await supabase
              .from('campaign_prospects')
              .update({ linkedin_user_id: providerId })
              .eq('id', prospect.id);

          } catch (profileError: any) {
            console.error(`❌ Failed to resolve LinkedIn profile for ${prospect.first_name}:`, profileError.message);
            validationResults.push({
              prospectId: prospect.id,
              name: `${prospect.first_name} ${prospect.last_name}`,
              status: 'skipped',
              reason: `Could not access LinkedIn profile: ${profileError.message}`
            });
            continue;
          }
        }

        // Now validate they are connected (FIRST_DEGREE)
        // CRITICAL FIX (Dec 8): Use vanity endpoint - provider_id endpoint returns WRONG profiles!
        console.log(`🔍 Checking connection status for ${prospect.first_name}...`);
        let profile: any;

        try {
          // Extract vanity from LinkedIn URL for reliable lookup
          const vanityMatch = prospect.linkedin_url?.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
          if (!vanityMatch) {
            throw new Error('Could not extract vanity from LinkedIn URL');
          }
          const vanityId = vanityMatch[1];
          profile = await unipileRequest(`/api/v1/users/${vanityId}?account_id=${unipileAccountId}`);
        } catch (profileError: any) {
          console.error(`❌ Failed to check connection status:`, profileError.message);
          validationResults.push({
            prospectId: prospect.id,
            name: `${prospect.first_name} ${prospect.last_name}`,
            status: 'skipped',
            reason: `Could not verify connection: ${profileError.message}`
          });
          continue;
        }

        // CRITICAL: Messenger campaigns require FIRST_DEGREE connection
        if (profile.network_distance !== 'FIRST_DEGREE') {
          console.warn(`⚠️  ${prospect.first_name} is NOT connected (distance: ${profile.network_distance})`);

          // Update prospect status
          await supabase
            .from('campaign_prospects')
            .update({
              status: 'failed',
              notes: `Messenger campaign requires connection - current distance: ${profile.network_distance}. Use connector campaign instead.`,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          validationResults.push({
            prospectId: prospect.id,
            name: `${prospect.first_name} ${prospect.last_name}`,
            status: 'skipped',
            reason: `Not connected (${profile.network_distance}) - messenger campaigns require existing connection`
          });
          continue;
        }

        console.log(`✅ ${prospect.first_name} is connected - queuing ${allMessages.length} messages`);

        // A/B Testing: Assign variant for this prospect (even index = A, odd index = B)
        // Only applies to first message - follow-ups are the same for both variants
        const useAbTesting = abTestingEnabled && alternativeMessageB;
        const variant: 'A' | 'B' | null = useAbTesting ? (prospectIndex % 2 === 0 ? 'A' : 'B') : null;

        // Queue all messages for this prospect - ALL formats (Dec 4 fix)
        const firstName = prospect.first_name || '';
        const lastName = prospect.last_name || '';
        const companyName = prospect.company_name || '';
        const title = prospect.title || '';
        for (let messageIndex = 0; messageIndex < allMessages.length; messageIndex++) {
          // For first message (messageIndex 0), use variant B if assigned
          const messageTemplate = (messageIndex === 0 && variant === 'B')
            ? alternativeMessageB
            : allMessages[messageIndex];

          const message = messageTemplate
            .replace(/\{first_name\}/gi, firstName)
            .replace(/\{last_name\}/gi, lastName)
            .replace(/\{company_name\}/gi, companyName)
            .replace(/\{company\}/gi, companyName)
            .replace(/\{title\}/gi, title)
            .replace(/\{\{first_name\}\}/gi, firstName)
            .replace(/\{\{last_name\}\}/gi, lastName)
            .replace(/\{\{company_name\}\}/gi, companyName)
            .replace(/\{\{company\}\}/gi, companyName)
            .replace(/\{firstName\}/g, firstName)
            .replace(/\{lastName\}/g, lastName)
            .replace(/\{companyName\}/g, companyName)
            .replace(/\{\{firstName\}\}/g, firstName)
            .replace(/\{\{lastName\}\}/g, lastName)
            .replace(/\{\{companyName\}\}/g, companyName);

          const scheduledFor = calculateNextSendTime(
            now,
            prospectIndex,
            messageIndex,
            followUpDelayDays,
            campaign.schedule_settings,
            cumulativeOffsets[prospectIndex] // Randomized offset for this prospect
          );

          const messageType = messageIndex === 0
            ? 'direct_message_1'
            : `direct_message_${messageIndex + 1}`;

          queueRecords.push({
            campaign_id: campaignId,
            prospect_id: prospect.id,
            linkedin_user_id: providerId,
            message: message,
            scheduled_for: scheduledFor.toISOString(),
            status: 'pending',
            message_type: messageType,
            requires_connection: false, // Messenger campaigns don't need to check connection (already connected)
            variant: messageIndex === 0 ? variant : null, // A/B variant only for first message
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }

        // Update prospect status (and A/B variant if applicable)
        await supabase
          .from('campaign_prospects')
          .update({
            status: 'connected', // Mark as connected
            linkedin_user_id: providerId,
            ab_variant: variant, // A/B testing variant assignment
            updated_at: new Date().toISOString()
          })
          .eq('id', prospect.id);

        validationResults.push({
          prospectId: prospect.id,
          name: `${prospect.first_name} ${prospect.last_name}`,
          status: 'queued',
          messagesQueued: allMessages.length
        });

      } catch (error: any) {
        console.error(`❌ Error processing ${prospect.first_name}:`, error.message);
        validationResults.push({
          prospectId: prospect.id,
          name: `${prospect.first_name} ${prospect.last_name}`,
          status: 'error',
          error: error.message
        });
      }
    }

    // 6. Insert all queue records in batch
    if (queueRecords.length > 0) {
      console.log(`\n💾 Inserting ${queueRecords.length} queue records...`);

      const { error: insertError } = await supabase
        .from('send_queue')
        .insert(queueRecords);

      if (insertError) {
        console.error('Failed to insert queue records:', insertError);
        return NextResponse.json({
          success: false,
          error: `Failed to queue messages: ${insertError.message}`
        }, { status: 500 });
      }

      console.log(`✅ Queue created successfully`);
    }

    // 7. Return summary
    const queuedCount = validationResults.filter(r => r.status === 'queued').length;
    const skippedCount = validationResults.filter(r => r.status === 'skipped').length;
    const errorCount = validationResults.filter(r => r.status === 'error').length;

    console.log(`\n📊 QUEUE SUMMARY:`);
    console.log(`   ✅ Queued: ${queuedCount} prospects (${queueRecords.length} total messages)`);
    console.log(`   ⏭️  Skipped: ${skippedCount} prospects`);
    console.log(`   ❌ Errors: ${errorCount} prospects`);

    return NextResponse.json({
      success: true,
      queued: queuedCount,
      skipped: skippedCount,
      errors: errorCount,
      totalMessages: queueRecords.length,
      results: validationResults,
      message: `✅ Queued ${queueRecords.length} messages for ${queuedCount} prospects. Processing starts immediately via cron job.`
    });

  } catch (error: any) {
    console.error('❌ Messenger queue creation error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Send Messages Queued (Messenger Campaigns)',
    description: 'Queue messages for messenger campaigns (prospects already connected)',
    endpoint: '/api/campaigns/direct/send-messages-queued',
    method: 'POST',
    body: {
      campaignId: 'UUID of messenger campaign'
    },
    requirements: {
      campaign_type: 'messenger',
      prospects_must_be: 'FIRST_DEGREE connections (already connected)',
      messages: 'First message + follow-ups configured in campaign.message_templates'
    },
    behavior: {
      validation: 'Checks all prospects are connected before queuing',
      queue: 'Creates send_queue entries with message_type = direct_message_1, direct_message_2, etc.',
      spacing: '30 minutes between prospects, configurable days between follow-ups',
      processing: 'Cron job processes queue every minute'
    },
    difference_from_connector: {
      connector: 'Sends connection request first, then follow-ups after acceptance',
      messenger: 'Sends messages directly (no connection request) - requires existing connection'
    }
  });
}
