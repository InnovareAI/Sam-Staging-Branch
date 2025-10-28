import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const campaignId = 'ba20c801-74ad-461f-960f-020d79091973'; // Noriko's campaign
const cronUrl = 'https://app.meet-sam.com/api/cron/process-pending-prospects';
const cronSecret = process.env.CRON_SECRET;

async function getPendingCount() {
  const { count } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .in('status', ['pending', 'approved', 'ready_to_message'])
    .not('linkedin_url', 'is', null);

  return count || 0;
}

async function triggerCron() {
  const response = await fetch(cronUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': cronSecret
    }
  });

  return await response.json();
}

console.log('🤖 Starting automated campaign processing...\n');
console.log(`Campaign ID: ${campaignId}`);
console.log(`Trigger interval: 120 seconds (2 minutes)\n`);

let iteration = 1;

while (true) {
  const pending = await getPendingCount();

  if (pending === 0) {
    console.log('\n🎉 All prospects processed! Campaign complete.');
    break;
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Iteration ${iteration} - ${new Date().toLocaleTimeString()}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`⏳ Pending prospects: ${pending}`);
  console.log('🚀 Triggering cron...');

  try {
    const result = await triggerCron();

    if (result.success) {
      console.log(`✅ Processed ${result.prospects_processed} prospects`);
      console.log(`   Message: ${result.message}`);
    } else {
      console.log(`❌ Error: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('❌ Fetch error:', error.message);
  }

  const newPending = await getPendingCount();
  const processed = pending - newPending;

  console.log(`📊 Progress: ${processed} sent, ${newPending} remaining`);

  if (newPending > 0) {
    console.log(`⏰ Waiting 120 seconds before next run...`);
    await new Promise(resolve => setTimeout(resolve, 120000)); // 2 minutes
  }

  iteration++;
}

console.log('\n✅ Campaign processing complete!');
