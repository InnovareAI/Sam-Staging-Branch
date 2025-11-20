import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCampaignTimezones() {
  console.log('🔍 Checking campaign timezone settings...\n');

  // Get all active connector campaigns with pending prospects
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, timezone, working_hours_start, working_hours_end, skip_weekends')
    .eq('status', 'active')
    .eq('campaign_type', 'connector');

  if (!campaigns) {
    console.log('❌ No campaigns found');
    return;
  }

  // Check current time in different timezones
  const now = new Date();
  console.log(`🕐 Current Time:`);
  console.log(`   UTC: ${now.toISOString()}`);
  console.log(`   PT: ${now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`);
  console.log(`   ET: ${now.toLocaleString('en-US', { timeZone: 'America/New_York' })}\n`);

  for (const campaign of campaigns) {
    // Get pending count
    const { count } = await supabase
      .from('campaign_prospects')
      .select('id', { count: 'exact' })
      .eq('campaign_id', campaign.id)
      .eq('status', 'pending');

    if (count === 0) continue;

    const timezone = campaign.timezone || 'UTC';
    const workStart = campaign.working_hours_start || 7;
    const workEnd = campaign.working_hours_end || 18;
    const skipWeekends = campaign.skip_weekends !== false; // default true

    console.log(`📋 ${campaign.name} (${count} pending)`);
    console.log(`   Timezone: ${timezone}`);
    console.log(`   Working Hours: ${workStart}:00 - ${workEnd}:00`);
    console.log(`   Skip Weekends: ${skipWeekends}`);

    // Check current time in campaign timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
      weekday: 'short'
    });

    const parts = formatter.formatToParts(now);
    const currentHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const currentDay = parts.find(p => p.type === 'weekday')?.value;

    console.log(`   Current time in ${timezone}: ${currentHour}:00 (${currentDay})`);

    // Check if would execute
    const isWeekend = skipWeekends && (currentDay === 'Sat' || currentDay === 'Sun');
    const isWorkingHours = currentHour >= workStart && currentHour < workEnd;

    if (isWeekend) {
      console.log(`   ❌ SKIPPED: Weekend`);
    } else if (!isWorkingHours) {
      console.log(`   ❌ SKIPPED: Outside working hours (${currentHour} not in ${workStart}-${workEnd})`);
    } else {
      console.log(`   ✅ SHOULD EXECUTE`);
    }

    console.log();
  }
}

checkCampaignTimezones().catch(console.error);
