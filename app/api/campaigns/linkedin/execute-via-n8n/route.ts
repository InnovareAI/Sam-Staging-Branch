import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * LinkedIn Campaign Execution - SIMPLIFIED
 *
 * Supports TWO campaign types only:
 * - connector: Send connection request first (for 2nd/3rd degree)
 * - messenger: Direct message (for 1st degree connections)
 *
 * NO multi-channel, NO email, NO tiers, NO HITL complexity
 */

// Base N8N webhook URLs for different campaign types
const N8N_CONNECTOR_WEBHOOK = process.env.N8N_CONNECTOR_WEBHOOK_URL || 'https://workflows.innovareai.com/webhook/connector-campaign';
const N8N_MESSENGER_WEBHOOK = process.env.N8N_MESSENGER_WEBHOOK_URL || 'https://workflows.innovareai.com/webhook/messenger-campaign';

/**
 * HUMAN-LIKE MESSAGE RANDOMIZER
 *
 * Generates realistic sending patterns that vary by day:
 * - Sometimes 0-2 messages/hour (slow days)
 * - Sometimes 3-5 messages/hour (busy days)
 * - Sometimes mixed (burst then pause)
 * - Respects daily CR limits per account
 * - Each day has different pattern seeded by date
 */
async function calculateHumanSendDelay(
  supabase: any,
  unipileAccountId: string,
  totalProspects: number,
  prospectIndex: number,
  campaignSettings?: any  // Pass campaign schedule settings
): Promise<number> {
  // 1. Get account's daily limit and today's sent count
  const { data: account } = await supabase
    .from('workspace_accounts')
    .select('daily_message_limit, messages_sent_today, last_message_date')
    .eq('unipile_account_id', unipileAccountId)
    .single();

  const dailyLimit = account?.daily_message_limit || 20; // Default: Free LinkedIn limit
  const sentToday = account?.messages_sent_today || 0;
  const lastMessageDate = account?.last_message_date;

  // Reset counter if it's a new day
  const today = new Date().toISOString().split('T')[0];
  const isNewDay = !lastMessageDate || lastMessageDate.split('T')[0] !== today;

  const actualSentToday = isNewDay ? 0 : sentToday;
  const remainingToday = Math.max(0, dailyLimit - actualSentToday);

  console.log(`📊 Account ${unipileAccountId}: ${actualSentToday}/${dailyLimit} sent today, ${remainingToday} remaining`);

  // 2. Check if today is weekend or holiday (respect campaign settings)
  // DEFAULT: Monday to Friday messaging only (skip_weekends: true)
  // Wide window (5 AM - 6 PM PT) to cover all US timezones
  const skipWeekends = campaignSettings?.skip_weekends ?? true; // Default: M-F only
  const skipHolidays = campaignSettings?.skip_holidays ?? true; // Default: skip holidays
  const timezone = campaignSettings?.timezone || 'America/Los_Angeles'; // Pacific Time for US/CAN
  const workingHoursStart = campaignSettings?.working_hours_start || 5;  // 5 AM PT (covers 8 AM ET)
  const workingHoursEnd = campaignSettings?.working_hours_end || 18;     // 6 PM PT (covers 9 PM ET)

  // Get current time in campaign's timezone
  const now = new Date();
  
  // CRITICAL: Convert to campaign's timezone for accurate hour checking
  const campaignTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const dayOfWeek = campaignTime.getDay(); // 0 = Sunday, 6 = Saturday
  const currentHour = campaignTime.getHours();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  console.log(`🕐 Server time: ${now.toISOString()} | Campaign timezone (${timezone}): ${campaignTime.toLocaleString()} | Hour: ${currentHour}`);

  // Check if we're outside working hours
  const isOutsideWorkingHours = currentHour < workingHoursStart || currentHour >= workingHoursEnd;

  if (isOutsideWorkingHours) {
    // Calculate minutes until next working hour start
    const hoursUntilStart = currentHour < workingHoursStart
      ? workingHoursStart - currentHour
      : (24 - currentHour) + workingHoursStart;
    console.log(`⏸️  Outside working hours (${workingHoursStart}:00-${workingHoursEnd}:00) - waiting ${hoursUntilStart}h`);
    return hoursUntilStart * 60;
  }

  if (isWeekend && skipWeekends) {
    console.log(`⏸️  Weekend detected, skip_weekends=true - skipping until Monday`);
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 2; // Sunday = 1 day, Saturday = 2 days
    return daysUntilMonday * 24 * 60;
  }

  // 3. Can't send more today
  if (remainingToday === 0) {
    console.log(`⏸️  Daily limit reached, delaying to tomorrow`);
    return 24 * 60; // Wait 24 hours
  }

  // 3. Generate day-specific randomization seed
  // Use date + account ID so same account has same pattern each day
  const dateSeed = parseInt(today.replace(/-/g, '')) + unipileAccountId.charCodeAt(0);
  const dayPattern = (dateSeed % 5); // 5 different day patterns

  // 4. Determine today's sending pattern
  let hourlyRate: number; // messages per hour

  switch (dayPattern) {
    case 0: // Slow day: 0-2 messages/hour
      hourlyRate = Math.random() * 2;
      break;
    case 1: // Medium day: 2-3 messages/hour
      hourlyRate = 2 + Math.random();
      break;
    case 2: // Busy day: 3-5 messages/hour
      hourlyRate = 3 + Math.random() * 2;
      break;
    case 3: // Burst pattern: alternate fast/slow
      hourlyRate = (prospectIndex % 2 === 0) ? 4 + Math.random() : 1 + Math.random();
      break;
    case 4: // Random walk: each message slightly different
      hourlyRate = 1 + Math.random() * 4;
      break;
    default:
      hourlyRate = 2;
  }

  // 5. Calculate delay for this specific message
  // Add +/- 30% randomness to make it more human
  const baseDelayMinutes = 60 / hourlyRate;
  const randomness = 0.7 + Math.random() * 0.6; // 0.7 to 1.3x multiplier
  const delayMinutes = Math.floor(baseDelayMinutes * randomness);

  // 6. Ensure we don't exceed daily limit
  const totalDelayMinutes = delayMinutes * (prospectIndex + 1);
  const hoursToSendAll = totalDelayMinutes / 60;

  if (actualSentToday + totalProspects > dailyLimit) {
    // Spread remaining over full work day (8 hours)
    const spreadOverMinutes = 8 * 60;
    return Math.floor(spreadOverMinutes / Math.min(totalProspects, remainingToday)) * prospectIndex;
  }

  console.log(`⏱️  Prospect ${prospectIndex}: ${delayMinutes}min delay (${hourlyRate.toFixed(1)} msg/hr pattern)`);

  return Math.max(0, delayMinutes);
}

/**
 * Get workspace ID for a given account
 */
async function getWorkspaceIdForAccount(supabase: any, unipileAccountId: string): Promise<string> {
  const { data } = await supabase
    .from('workspace_accounts')
    .select('workspace_id')
    .eq('unipile_account_id', unipileAccountId)
    .single();

  return data?.workspace_id;
}

/**
 * Update account's daily message counter after sending
 */
async function incrementAccountMessageCount(supabase: any, unipileAccountId: string) {
  const today = new Date().toISOString().split('T')[0];

  const { data: account } = await supabase
    .from('workspace_accounts')
    .select('messages_sent_today, last_message_date')
    .eq('unipile_account_id', unipileAccountId)
    .single();

  const lastMessageDate = account?.last_message_date?.split('T')[0];
  const isNewDay = lastMessageDate !== today;

  await supabase
    .from('workspace_accounts')
    .update({
      messages_sent_today: isNewDay ? 1 : (account?.messages_sent_today || 0) + 1,
      last_message_date: new Date().toISOString()
    })
    .eq('unipile_account_id', unipileAccountId);
}

export async function POST(req: NextRequest) {
  try {
    console.log('🚀 ========== CAMPAIGN EXECUTE CALLED ==========');

    // 1. Authenticate user
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get request data
    const { campaignId, workspaceId } = await req.json();

    if (!campaignId || !workspaceId) {
      return NextResponse.json({
        error: 'Missing required fields',
        required: ['campaignId', 'workspaceId']
      }, { status: 400 });
    }

    // 3. Verify workspace access
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: member } = await supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
    }

    console.log(`🚀 LinkedIn Campaign Launch: ${campaignId}`);

    // 4. Get campaign with LinkedIn account
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select(`
        *,
        linkedin_account:workspace_accounts!linkedin_account_id (
          id,
          account_name,
          unipile_account_id,
          is_active
        )
      `)
      .eq('id', campaignId)
      .eq('workspace_id', workspaceId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({
        error: 'Campaign not found',
        details: campaignError?.message
      }, { status: 404 });
    }

    // 5. Get campaign prospects separately (RLS bypass for service role)
    const { data: prospects, error: prospectsError } = await supabaseAdmin
      .from('campaign_prospects')
      .select('id, first_name, last_name, email, company_name, title, linkedin_url, linkedin_user_id, status')
      .eq('campaign_id', campaignId);

    if (prospectsError) {
      console.error('Error fetching prospects:', prospectsError);
    }

    // Attach prospects to campaign object
    campaign.campaign_prospects = prospects || [];

    // 6. Validate LinkedIn account
    if (!campaign.linkedin_account?.unipile_account_id) {
      return NextResponse.json({
        error: 'No LinkedIn account connected',
        message: 'Please connect a LinkedIn account to this campaign'
      }, { status: 400 });
    }

    if (!campaign.linkedin_account.is_active) {
      return NextResponse.json({
        error: 'LinkedIn account inactive',
        message: 'Please reconnect your LinkedIn account'
      }, { status: 400 });
    }

    // 7. Get prospects ready to contact
    const pendingProspects = campaign.campaign_prospects.filter(
      (p: any) => ['pending', 'approved', 'ready_to_message', 'queued_in_n8n'].includes(p.status) && p.linkedin_url
    );

    if (pendingProspects.length === 0) {
      return NextResponse.json({
        message: 'No prospects ready to contact',
        processed: 0
      });
    }

    console.log(`📋 Processing ${pendingProspects.length} prospects`);

    // 8. Determine campaign type
    // connector = send CR first (default)
    // messenger = direct message only
    const campaignType = campaign.campaign_type || 'connector';
    console.log(`📋 Campaign Type from DB: "${campaign.campaign_type}" → Using: "${campaignType}"`);

    if (!['connector', 'messenger'].includes(campaignType)) {
      return NextResponse.json({
        error: 'Invalid campaign type',
        message: 'Only "connector" and "messenger" campaigns are supported',
        received: campaignType
      }, { status: 400 });
    }

    // 9. Get account tracking data for N8N
    const { data: accountTracking } = await supabaseAdmin
      .from('workspace_accounts')
      .select('daily_message_limit, messages_sent_today, last_message_date')
      .eq('unipile_account_id', campaign.linkedin_account.unipile_account_id)
      .single();

    const today = new Date().toISOString().split('T')[0];
    const lastMessageDate = accountTracking?.last_message_date?.split('T')[0];
    const isNewDay = !lastMessageDate || lastMessageDate !== today;
    const currentSentToday = isNewDay ? 0 : (accountTracking?.messages_sent_today || 0);

    // 10. Build N8N payload
    const n8nPayload = {
      workspace_id: workspaceId,
      campaign_id: campaignId,
      channel: 'linkedin',
      campaign_type: campaignType,
      unipile_account_id: campaign.linkedin_account.unipile_account_id,
      unipileAccountId: campaign.linkedin_account.unipile_account_id, // CRITICAL: N8N expects camelCase

      // CRITICAL: Account tracking data for N8N to update message counters
      account_tracking: {
        daily_message_limit: accountTracking?.daily_message_limit || 20,
        messages_sent_today: currentSentToday,
        last_message_date: accountTracking?.last_message_date || new Date().toISOString(),
        remaining_today: Math.max(0, (accountTracking?.daily_message_limit || 20) - currentSentToday)
      },

      // Schedule settings for N8N to enforce timing
      // DEFAULT: Monday to Friday messaging only (skip_weekends: true)
      // Wide window (5 AM - 6 PM PT) to cover all US timezones
      schedule_settings: campaign.schedule_settings || {
        timezone: 'America/Los_Angeles',  // Pacific Time for US/CAN
        working_hours_start: 5,    // 5 AM PT (covers 8 AM ET)
        working_hours_end: 18,      // 6 PM PT (covers 9 PM ET)
        skip_weekends: true,        // Default: M-F only
        skip_holidays: true
      },

      prospects: await Promise.all(pendingProspects.map(async (p: any, index: number) => {
        // HUMAN-LIKE RANDOMIZER: Calculate intelligent send delays
        // ALL prospects respect working hours - no immediate sends
        const sendDelay = await calculateHumanSendDelay(
          supabaseAdmin,
          campaign.linkedin_account.unipile_account_id,
          pendingProspects.length,
          index,
          campaign.schedule_settings // Pass campaign schedule settings (timezone, working hours, skip_weekends, skip_holidays)
        );

        return {
          id: p.id,
          prospect_id: p.id,
          campaign_id: campaignId,
          first_name: p.first_name,
          last_name: p.last_name,
          linkedin_url: p.linkedin_url,
          linkedin_user_id: p.linkedin_user_id,
          company_name: p.company_name,
          title: p.title,
          send_delay_minutes: sendDelay
        };
      })),
      messages: campaignType === 'messenger' ? {
        // Messenger campaigns: array of messages to send in sequence
        message_sequence: [
          campaign.message_templates?.connection_request || '',
          ...(campaign.message_templates?.follow_up_messages || [])
        ].filter(msg => msg && msg.trim() !== '')
      } : {
        // Connector campaigns: connection request + follow-ups (N8N expects snake_case)
        connection_request: campaign.connection_message || campaign.message_templates?.connection_request || '',
        cr: campaign.connection_message || campaign.message_templates?.connection_request || '',
        follow_up_1: campaign.message_templates?.follow_up_messages?.[0] || '',
        follow_up_2: campaign.message_templates?.follow_up_messages?.[1] || '',
        follow_up_3: campaign.message_templates?.follow_up_messages?.[2] || '',
        follow_up_4: campaign.message_templates?.follow_up_messages?.[3] || '',
        goodbye_message: campaign.message_templates?.follow_up_messages?.[4] || '',
        alternative_message: campaign.message_templates?.alternative_message || campaign.message_templates?.follow_up_messages?.[0] || ''
      },
      timing: {
        fu1_delay_days: 2,
        fu2_delay_days: 5,
        fu3_delay_days: 7,
        fu4_delay_days: 5,
        gb_delay_days: 7
      },
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
      unipile_dsn: `https://${process.env.UNIPILE_DSN}`,
      unipile_api_key: process.env.UNIPILE_API_KEY
    };

    console.log(`📦 Sending to N8N:`, {
      campaign_type: campaignType,
      prospect_count: pendingProspects.length,
      linkedin_account: campaign.linkedin_account.account_name,
      daily_limit: accountTracking?.daily_message_limit || 20,
      sent_today: currentSentToday,
      remaining_today: Math.max(0, (accountTracking?.daily_message_limit || 20) - currentSentToday)
    });

    console.log(`📋 FULL N8N PAYLOAD:`, JSON.stringify(n8nPayload, null, 2));

    // 10. Determine which N8N webhook to call based on campaign type
    const N8N_WEBHOOK_URL = campaignType === 'messenger' ? N8N_MESSENGER_WEBHOOK : N8N_CONNECTOR_WEBHOOK;

    console.log(`🎯 Calling ${campaignType} workflow: ${N8N_WEBHOOK_URL}`);

    // 11. Call N8N webhook
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n8nPayload)
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error(`❌ N8N failed:`, errorText);
      throw new Error(`N8N webhook failed: ${n8nResponse.status}`);
    }

    const n8nResult = await n8nResponse.json();
    console.log(`✅ N8N accepted campaign`);

    // 11. Update prospect statuses
    for (const prospect of pendingProspects) {
      await supabaseAdmin
        .from('campaign_prospects')
        .update({ status: 'queued_in_n8n' })
        .eq('id', prospect.id);
    }

    // 12. Update campaign
    await supabaseAdmin
      .from('campaigns')
      .update({
        status: 'active',
        last_executed_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    return NextResponse.json({
      success: true,
      message: `LinkedIn ${campaignType} campaign launched`,
      prospects_queued: pendingProspects.length,
      campaign_type: campaignType
    });

  } catch (error: any) {
    console.error('❌ Campaign execution error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json({
      error: 'Campaign launch failed',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
