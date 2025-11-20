import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCampaignExecutionStatus() {
  console.log('🔍 Checking campaign execution status...\n');

  // Get Charissa and Michelle campaigns with pending prospects
  const campaigns = [
    '4486cc53-3c8a-47d2-a88c-3dd69db5a17e', // New Campaign-Canada (Charissa)
    '9fcfcab0-7007-4628-b49b-1636ba5f781f'  // 20251117-IA2-Outreach Campaign (Michelle)
  ];

  for (const campaignId of campaigns) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, name, status, auto_execute, n8n_execution_id, next_execution_time')
      .eq('id', campaignId)
      .single();

    if (!campaign) {
      console.log(`❌ Campaign ${campaignId} not found\n`);
      continue;
    }

    console.log(`📋 ${campaign.name}`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Auto Execute: ${campaign.auto_execute}`);
    console.log(`   N8N Execution ID: ${campaign.n8n_execution_id || 'NULL (never executed)'}`);
    console.log(`   Next Execution Time: ${campaign.next_execution_time || 'NULL'}`);

    // Get pending prospects count
    const { count } = await supabase
      .from('campaign_prospects')
      .select('id', { count: 'exact' })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    console.log(`   Pending Prospects: ${count || 0}`);

    // Check if this campaign would be picked up by cron
    const wouldBePickedUp = (
      campaign.status === 'active' &&
      campaign.auto_execute === true &&
      campaign.n8n_execution_id === null
    ) || (
      campaign.status === 'scheduled' &&
      campaign.auto_execute === true &&
      campaign.next_execution_time &&
      new Date(campaign.next_execution_time) <= new Date()
    );

    console.log(`   🎯 Would be picked up by cron: ${wouldBePickedUp ? '✅ YES' : '❌ NO'}`);

    if (!wouldBePickedUp && campaign.n8n_execution_id) {
      console.log(`   ⚠️  PROBLEM: Campaign was executed before, won't be picked up again!`);
    }

    console.log();
  }
}

checkCampaignExecutionStatus().catch(console.error);
