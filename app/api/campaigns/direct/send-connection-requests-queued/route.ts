import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Direct Campaign Execution - Queue-Based (TESTING MODE - 5 MIN SPACING)
 *
 * Safe queue-based system for gradual CR sending:
 * 1. Fetch pending prospects
 * 2. Create send_queue records (spaced 5 minutes apart - ACCELERATED FOR TESTING)
 * 3. Cron job processes queue and sends actual CRs
 *
 * POST /api/campaigns/direct/send-connection-requests-queued
 * Body: { campaignId: string }
 *
 * TESTING MODE: Creates queue with 1 CR every 5 minutes (accelerated testing)
 * Production mode: Change to 30 minutes (1 CR every 30 min = 20 CRs per 10 hours)
 *
 * Response: Immediate (no hanging)
 * Actual sending: Happens via cron job every minute
 */

export const maxDuration = 60; // 60 seconds max

// Unipile REST API configuration
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

function getNextBusinessDay(date: Date): Date {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  // Keep advancing until we find a business day
  while (isWeekend(nextDay) || isPublicHoliday(nextDay)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }

  return nextDay;
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
    const { campaignId } = await req.json();

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
    }

    console.log(`🚀 Starting queue-based campaign execution: ${campaignId}`);

    // 1. Fetch campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        id,
        campaign_name,
        message_templates,
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
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const linkedinAccount = campaign.workspace_accounts as any;
    const unipileAccountId = linkedinAccount.unipile_account_id;

    if (!unipileAccountId) {
      return NextResponse.json({ error: 'No LinkedIn account configured' }, { status: 400 });
    }

    console.log(`📋 Campaign: ${campaign.campaign_name}`);
    console.log(`👤 LinkedIn Account: ${linkedinAccount.account_name} (${unipileAccountId})`);

    // 2. Fetch pending prospects (max 20 for testing)
    const cooldownDate = new Date();
    cooldownDate.setHours(cooldownDate.getHours() - 24);

    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaignId)
      .or(`status.in.(pending,approved),and(status.eq.failed,updated_at.lt.${cooldownDate.toISOString()})`)
      .not('linkedin_url', 'is', null)
      .order('created_at', { ascending: true })
      .limit(20);

    if (prospectsError) {
      console.error('Error fetching prospects:', prospectsError);
      return NextResponse.json({ error: 'Failed to fetch prospects' }, { status: 500 });
    }

    if (!prospects || prospects.length === 0) {
      console.log('✅ No pending prospects to queue');
      return NextResponse.json({
        success: true,
        queued: 0,
        message: 'No pending prospects'
      });
    }

    console.log(`📊 Found ${prospects.length} prospects to queue`);

    // 3. Validate prospects and create queue records
    const queueRecords = [];
    const skipped = [];
    const connectionRequestMessage = campaign.message_templates?.connection_request ||
      'Hi {first_name}, I\'d like to connect!';

    for (let prospectIndex = 0; prospectIndex < prospects.length; prospectIndex++) {
      const prospect = prospects[prospectIndex];

      try {
        console.log(`\n👤 Validating: ${prospect.first_name} ${prospect.last_name}`);

        // VALIDATION: Check duplicates WITHIN SAME WORKSPACE ONLY
        const { data: existingInOtherCampaign } = await supabase
          .from('campaign_prospects')
          .select('status, campaign_id, campaigns!inner(campaign_name, workspace_id)')
          .eq('linkedin_url', prospect.linkedin_url)
          .neq('campaign_id', campaignId)
          .eq('campaigns.workspace_id', campaign.workspace_id)
          .limit(1)
          .single();

        if (existingInOtherCampaign) {
          const otherCampaignName = (existingInOtherCampaign as any).campaigns?.campaign_name || 'another campaign';
          console.log(`⚠️  ${prospect.first_name} already in ${otherCampaignName} (same workspace) - skipping`);

          await supabase
            .from('campaign_prospects')
            .update({
              status: 'failed',
              notes: `Duplicate: Already in ${otherCampaignName} (same workspace)`,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          skipped.push({
            name: `${prospect.first_name} ${prospect.last_name}`,
            reason: 'duplicate_in_same_workspace'
          });
          continue;
        }

        const { data: existingInThisCampaign } = await supabase
          .from('campaign_prospects')
          .select('status, contacted_at')
          .eq('linkedin_url', prospect.linkedin_url)
          .eq('campaign_id', campaignId)
          .in('status', ['connection_request_sent', 'connected', 'messaging', 'replied'])
          .limit(1)
          .single();

        if (existingInThisCampaign) {
          console.log(`⚠️  Already contacted ${prospect.first_name} - skipping`);

          await supabase
            .from('campaign_prospects')
            .update({
              status: existingInThisCampaign.status,
              notes: `Already contacted in this campaign`,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          skipped.push({
            name: `${prospect.first_name} ${prospect.last_name}`,
            reason: `already_${existingInThisCampaign.status}`
          });
          continue;
        }

        // PROFILE LOOKUP & VALIDATION
        let providerId = prospect.linkedin_user_id;
        let profile: any = null;

        if (providerId) {
          console.log(`📝 Looking up profile with provider_id: ${providerId}`);
          profile = await unipileRequest(
            `/api/v1/users/profile?account_id=${unipileAccountId}&provider_id=${encodeURIComponent(providerId)}`
          );
        } else {
          console.log(`📝 Extracting vanity from ${prospect.linkedin_url}`);
          const vanityMatch = prospect.linkedin_url.match(/linkedin\.com\/in\/([^\/\?#]+)/);
          if (!vanityMatch) throw new Error(`Cannot extract vanity from ${prospect.linkedin_url}`);

          const vanityId = vanityMatch[1];
          console.log(`  Using legacy endpoint: /api/v1/users/${vanityId}`);

          try {
            profile = await unipileRequest(`/api/v1/users/${vanityId}?account_id=${unipileAccountId}`);
            providerId = profile.provider_id;
            console.log(`  ✅ Found: ${profile.first_name} ${profile.last_name}`);
          } catch (legacyError: any) {
            throw new Error(`Profile lookup failed: ${legacyError.message}`);
          }
        }

        // CHECK: Already connected?
        if (profile.network_distance === 'FIRST_DEGREE') {
          console.log(`⚠️  Already connected - skipping`);

          await supabase
            .from('campaign_prospects')
            .update({
              status: 'connected',
              notes: 'Already a 1st degree connection',
              linkedin_user_id: providerId,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          skipped.push({
            name: `${prospect.first_name} ${prospect.last_name}`,
            reason: 'already_connected'
          });
          continue;
        }

        // CHECK: Withdrawn invitation?
        if (profile.invitation?.status === 'WITHDRAWN') {
          console.log(`⚠️  Previously withdrawn - LinkedIn cooldown active`);

          const cooldownEnd = new Date();
          cooldownEnd.setDate(cooldownEnd.getDate() + 21);

          await supabase
            .from('campaign_prospects')
            .update({
              status: 'failed',
              notes: `Invitation withdrawn - cooldown until ~${cooldownEnd.toISOString().split('T')[0]}`,
              linkedin_user_id: providerId,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          skipped.push({
            name: `${prospect.first_name} ${prospect.last_name}`,
            reason: 'withdrawn_cooldown'
          });
          continue;
        }

        // CHECK: Already pending?
        if (profile.invitation?.status === 'PENDING') {
          console.log(`⚠️  Invitation already pending`);

          await supabase
            .from('campaign_prospects')
            .update({
              status: 'connection_request_sent',
              notes: 'Invitation already pending on LinkedIn',
              linkedin_user_id: providerId,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          skipped.push({
            name: `${prospect.first_name} ${prospect.last_name}`,
            reason: 'already_pending'
          });
          continue;
        }

        // VALIDATION PASSED: Create queue records for ALL 6 messages (CR + 5 follow-ups)
        // Schedule to start immediately with 5-minute spacing for CRs
        let scheduledFor = new Date();

        // Clear seconds and milliseconds for consistency
        scheduledFor.setSeconds(0, 0);

        // Add 5-minute spacing for this prospect (0 min for first, 5 for second, 10 for third, etc)
        scheduledFor.setMinutes(scheduledFor.getMinutes() + (prospectIndex * 5));

        console.log(`✅ Valid prospect - queuing CR + 5 follow-ups for ${scheduledFor.toLocaleTimeString()}`);
        console.log(`   Index: ${prospectIndex}, CR Scheduled (ISO): ${scheduledFor.toISOString()}`);

        // 1. CONNECTION REQUEST (immediate - respecting weekend/holiday blocking)
        queueRecords.push({
          campaign_id: campaignId,
          prospect_id: prospect.id,
          linkedin_user_id: providerId,
          scheduled_for: scheduledFor.toISOString(),
          status: 'pending',
          message_type: 'connection_request',
          message: connectionRequestMessage
            .replace(/{first_name}/g, prospect.first_name)
            .replace(/{last_name}/g, prospect.last_name)
            .replace(/{company_name}/g, prospect.company_name || '')
            .replace(/{title}/g, prospect.title || '')
        });

        // 2-6. FOLLOW-UP MESSAGES (scheduled 3, 8, 13, 18, 23 days after CR)
        const followUpMessages = [
          campaign.message_templates?.follow_up_messages?.[0] || campaign.message_templates?.alternative_message,
          campaign.message_templates?.follow_up_messages?.[1],
          campaign.message_templates?.follow_up_messages?.[2],
          campaign.message_templates?.follow_up_messages?.[3],
          campaign.message_templates?.follow_up_messages?.[4]
        ];

        const followUpDelays = [3, 8, 13, 18, 23]; // Days after CR

        followUpMessages.forEach((followUpMessage, index) => {
          if (followUpMessage) {
            const followUpDate = new Date(scheduledFor);
            followUpDate.setDate(followUpDate.getDate() + followUpDelays[index]);

            queueRecords.push({
              campaign_id: campaignId,
              prospect_id: prospect.id,
              linkedin_user_id: providerId,
              scheduled_for: followUpDate.toISOString(),
              status: 'pending',
              message_type: `follow_up_${index + 1}`,
              requires_connection: true, // Only send if connection accepted
              message: followUpMessage
                .replace(/{first_name}/g, prospect.first_name)
                .replace(/{last_name}/g, prospect.last_name)
                .replace(/{company_name}/g, prospect.company_name || '')
                .replace(/{title}/g, prospect.title || '')
            });
          }
        });

      } catch (error: any) {
        console.error(`❌ Validation failed for ${prospect.first_name}:`, error.message);
        skipped.push({
          name: `${prospect.first_name} ${prospect.last_name}`,
          reason: `validation_error: ${error.message}`
        });
      }
    }

    console.log(`\n📊 Validation summary:`);
    console.log(`   - Valid (queued): ${queueRecords.length}`);
    console.log(`   - Skipped: ${skipped.length}`);

    if (queueRecords.length === 0) {
      return NextResponse.json({
        success: true,
        queued: 0,
        skipped: skipped.length,
        message: 'All prospects were skipped (no valid prospects to queue)'
      });
    }

    // 4. Bulk insert queue records
    console.log(`\n📝 Attempting to insert ${queueRecords.length} queue records...`);
    console.log(`📋 ALL queue records to be inserted:`);
    queueRecords.forEach((record, index) => {
      console.log(`   [${index}] scheduled_for: ${record.scheduled_for}, prospect: ${record.linkedin_user_id}`);
    });

    const { data: insertedData, error: insertError } = await supabase
      .from('send_queue')
      .insert(queueRecords)
      .select();

    if (insertError) {
      console.error('❌ Queue insertion error:', insertError);
      console.error('   Error details:', JSON.stringify(insertError, null, 2));
      return NextResponse.json({ error: `Failed to queue messages: ${insertError.message}` }, { status: 500 });
    }

    console.log(`✅ Successfully inserted ${insertedData?.length || 0} records`);
    if (!insertedData || insertedData.length === 0) {
      console.error('⚠️  WARNING: Insert returned no data even though no error was thrown!');
      console.error('   This suggests a constraint violation or RLS policy issue.');
    }

    // Calculate estimated completion time
    const lastScheduledTime = new Date(queueRecords[queueRecords.length - 1].scheduled_for);
    const durationMinutes = Math.ceil((lastScheduledTime.getTime() - new Date().getTime()) / (1000 * 60));

    // 5. Update campaign status to active
    await supabase
      .from('campaigns')
      .update({
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    return NextResponse.json({
      success: true,
      campaign_id: campaignId,
      queued: queueRecords.length,
      skipped: skipped.length,
      message: `✅ Campaign queued! ${queueRecords.length} CRs will be sent (1 every 30 minutes)`,
      estimated_completion: lastScheduledTime.toISOString(),
      estimated_duration_minutes: durationMinutes,
      queue_details: queueRecords.map((r, i) => ({
        index: i + 1,
        prospect: `${r.linkedin_user_id}`,
        scheduled_for: r.scheduled_for
      })),
      skipped_details: skipped
    });

  } catch (error: any) {
    console.error('Campaign queue error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to queue campaign' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Queue-Based Campaign Execution',
    description: 'Creates send_queue records for gradual CR sending (1 every 5 minutes - TESTING MODE)',
    endpoint: '/api/campaigns/direct/send-connection-requests-queued',
    method: 'POST',
    mode: 'TESTING MODE (accelerated - 5 min spacing)',
    sending_pattern: '1 CR every 5 minutes (TESTING) - Change to 30 minutes for production',
    daily_limit: '20 CRs per day (LinkedIn free tier) - Testing cadence will exceed this',
    payload: {
      campaignId: 'UUID of campaign to queue'
    },
    response: {
      success: true,
      queued: 'Number of CRs queued',
      skipped: 'Number of prospects skipped (duplicates, already contacted, etc)',
      estimated_completion: 'ISO timestamp when all queued CRs will be sent',
      estimated_duration_minutes: 'Total minutes to send all queued CRs'
    }
  });
}
