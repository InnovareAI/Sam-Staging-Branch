import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const cronUrl = 'https://app.meet-sam.com/api/cron/process-pending-prospects';
const cronSecret = process.env.CRON_SECRET;

async function getAllPendingCount() {
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, workspaces(name)')
    .in('status', ['active', 'scheduled']);

  const pending = [];

  for (const campaign of campaigns || []) {
    const { count } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .in('status', ['pending', 'approved', 'ready_to_message'])
      .not('linkedin_url', 'is', null);

    if (count > 0) {
      pending.push({
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        workspace: campaign.workspaces.name,
        count
      });
    }
  }

  return pending;
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

console.log('👀 Starting universal campaign watcher...\n');
console.log('Monitoring ALL workspaces for active campaigns');
console.log('Trigger interval: 120 seconds (2 minutes)\n');

let iteration = 1;

while (true) {
  const pending = await getAllPendingCount();
  const totalPending = pending.reduce((sum, c) => sum + c.count, 0);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Iteration ${iteration} - ${new Date().toLocaleTimeString()}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  if (totalPending === 0) {
    console.log('✅ No pending prospects across all campaigns');
    console.log('⏰ Waiting 120 seconds before checking again...');
    await new Promise(resolve => setTimeout(resolve, 120000));
    iteration++;
    continue;
  }

  console.log(`📊 Active campaigns with pending prospects:\n`);
  for (const c of pending) {
    console.log(`   ${c.workspace}: ${c.campaign_name}`);
    console.log(`   Pending: ${c.count} prospects\n`);
  }

  console.log(`⏳ Total pending: ${totalPending} prospects`);
  console.log('🚀 Triggering cron...\n');

  try {
    const result = await triggerCron();

    if (result.success) {
      console.log(`✅ Cron executed successfully`);
      console.log(`   Processed: ${result.prospects_processed} prospects`);
      console.log(`   Message: ${result.message}`);
    } else {
      console.log(`❌ Error: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('❌ Fetch error:', error.message);
  }

  console.log(`⏰ Waiting 120 seconds before next run...`);
  await new Promise(resolve => setTimeout(resolve, 120000)); // 2 minutes

  iteration++;
}
