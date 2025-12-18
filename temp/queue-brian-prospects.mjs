import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const campaignId = '64c672da-fb0c-42f3-861e-a47fa29ac06b';

async function queueProspects() {
  console.log('🚀 Direct queue for campaign 64c672da (Brian Neirby - Chillmine)\n');

  // Get campaign details
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, campaign_name, linkedin_account_id, message_templates, connection_message, workspace_id, workspaces!inner(id, settings)')
    .eq('id', campaignId)
    .single();

  console.log('Campaign:', campaign.campaign_name || 'unnamed');
  console.log('Workspace ID:', campaign.workspace_id);

  // Get pending prospects
  const { data: pendingProspects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, linkedin_url, linkedin_user_id, company_name, title')
    .eq('campaign_id', campaignId)
    .in('status', ['pending', 'approved'])
    .not('linkedin_url', 'is', null);

  console.log('Pending prospects:', pendingProspects.length);

  // Check existing queue
  const prospectIds = pendingProspects.map(p => p.id);
  const { data: existingQueue } = await supabase
    .from('send_queue')
    .select('prospect_id')
    .eq('campaign_id', campaignId)
    .in('prospect_id', prospectIds);

  const existingIds = new Set((existingQueue || []).map(q => q.prospect_id));
  const unqueuedProspects = pendingProspects.filter(p => !existingIds.has(p.id));
  console.log('Unqueued prospects:', unqueuedProspects.length);

  if (unqueuedProspects.length === 0) {
    console.log('✅ All prospects already queued');
    return;
  }

  // Get message template
  const messageTemplate = campaign.message_templates?.connection_request ||
                          campaign.connection_message;

  if (!messageTemplate) {
    console.log('❌ No message template found');
    return;
  }

  console.log('Message template found:', messageTemplate.substring(0, 50) + '...');

  // Timezone settings
  const timezone = campaign.workspaces?.settings?.default_timezone || 'America/Los_Angeles';
  console.log('Timezone:', timezone);

  // Build queue records with randomized scheduling
  const MIN_SPACING = 20;
  const MAX_SPACING = 45;
  const queueRecords = [];

  let currentTime = new Date(Date.now() + Math.floor(Math.random() * 15) * 60 * 1000);

  const getHourInTimezone = (date, tz) => {
    const formatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz });
    return parseInt(formatter.format(date), 10);
  };

  const getDayInTimezone = (date, tz) => {
    const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz });
    const day = formatter.format(date);
    const dayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    return dayMap[day] ?? 0;
  };

  const isWeekend = (date) => {
    const day = getDayInTimezone(date, timezone);
    return day === 0 || day === 6;
  };

  const isBusinessHours = (date) => {
    const hour = getHourInTimezone(date, timezone);
    return hour >= 9 && hour < 17;
  };

  const moveToNextBusinessDay = (date) => {
    const next = new Date(date);
    next.setTime(next.getTime() + 24 * 60 * 60 * 1000);
    while (isWeekend(next)) {
      next.setTime(next.getTime() + 24 * 60 * 60 * 1000);
    }
    // Set to 9 AM in timezone (approximate)
    const currentHour = getHourInTimezone(next, timezone);
    const hoursToAdd = 9 - currentHour;
    next.setTime(next.getTime() + hoursToAdd * 60 * 60 * 1000);
    next.setMinutes(0, 0, 0);
    return next;
  };

  for (const prospect of unqueuedProspects) {
    // Skip weekends
    while (isWeekend(currentTime)) {
      currentTime = moveToNextBusinessDay(currentTime);
    }

    // If outside business hours, move to next business day
    if (!isBusinessHours(currentTime)) {
      currentTime = moveToNextBusinessDay(currentTime);
    }

    const scheduledTime = new Date(currentTime);

    // Personalize message
    const personalizedMessage = messageTemplate
      .replace(/\{\{?firstName\}?\}/gi, prospect.first_name || '')
      .replace(/\{\{?first_name\}?\}/gi, prospect.first_name || '')
      .replace(/\{\{?lastName\}?\}/gi, prospect.last_name || '')
      .replace(/\{\{?last_name\}?\}/gi, prospect.last_name || '')
      .replace(/\{\{?companyName\}?\}/gi, prospect.company_name || '')
      .replace(/\{\{?company_name\}?\}/gi, prospect.company_name || '')
      .replace(/\{\{?company\}?\}/gi, prospect.company_name || '')
      .replace(/\{\{?title\}?\}/gi, prospect.title || '');

    queueRecords.push({
      campaign_id: campaignId,
      prospect_id: prospect.id,
      linkedin_user_id: prospect.linkedin_user_id || prospect.linkedin_url,
      message: personalizedMessage,
      scheduled_for: scheduledTime.toISOString(),
      status: 'pending',
      message_type: 'connection_request'
    });

    // Random interval 20-45 min
    const interval = MIN_SPACING + Math.floor(Math.random() * (MAX_SPACING - MIN_SPACING + 1));
    currentTime = new Date(currentTime.getTime() + interval * 60 * 1000);
  }

  console.log(`\n📅 Scheduling ${queueRecords.length} prospects from ${queueRecords[0]?.scheduled_for} to ${queueRecords[queueRecords.length - 1]?.scheduled_for}`);

  // Insert one by one to handle duplicates gracefully
  let inserted = 0;
  let skipped = 0;

  for (const record of queueRecords) {
    const { error } = await supabase.from('send_queue').insert(record);
    if (error) {
      skipped++;
    } else {
      inserted++;
    }
  }

  console.log(`\n🎉 Done! Queued ${inserted} prospects (${skipped} skipped as duplicates)`);
}

queueProspects().catch(console.error);
