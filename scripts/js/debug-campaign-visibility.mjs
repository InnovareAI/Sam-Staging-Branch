#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugCampaignVisibility() {
  const campaignId = 'cc452d62-c3a4-4d90-bfb9-19063f7a5d79';
  
  console.log('\n🔍 DEBUGGING CAMPAIGN VISIBILITY\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Get campaign details
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (campaign) {
    console.log('Campaign Status:');
    console.log(`   ├─ Name: ${campaign.name}`);
    console.log(`   ├─ Status: ${campaign.status}`);
    console.log(`   ├─ Campaign Type: ${campaign.campaign_type}`);
    console.log(`   ├─ Created: ${campaign.created_at}`);
    console.log(`   ├─ Updated: ${campaign.updated_at}`);
    console.log(`   ├─ Launched At: ${campaign.launched_at || '❌ NOT SET'}`);
    console.log(`   └─ LinkedIn Account: ${campaign.linkedin_account_id || '❌ NOT SET'}\n`);

    // Check prospects with approved status
    const { count: approvedCount } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'approved');

    // Check prospects with pending status
    const { count: pendingCount } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    console.log('Prospect Status Breakdown:');
    console.log(`   ├─ Approved: ${approvedCount || 0}`);
    console.log(`   ├─ Pending: ${pendingCount || 0}`);
    console.log(`   └─ Total: ${(approvedCount || 0) + (pendingCount || 0)}\n`);

    // Check send queue
    const { count: queueCount } = await supabase
      .from('send_queue')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);

    console.log('Send Queue:');
    console.log(`   └─ Messages: ${queueCount || 0}\n`);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔴 ISSUE IDENTIFIED:');
    console.log('');
    
    if (!campaign.launched_at) {
      console.log('   ❌ launched_at is NULL');
      console.log('   This is why campaign is not showing in Active Campaigns!');
      console.log('');
      console.log('   A campaign is considered "active" if:');
      console.log('   1. status = "active" ✅');
      console.log('   2. launched_at IS NOT NULL ❌');
      console.log('   3. Has prospects with approved/pending status ✅');
    }

    if (campaign.status !== 'active') {
      console.log(`   ❌ Status is "${campaign.status}" instead of "active"`);
    }

    console.log('');
    console.log('💡 SOLUTION:');
    console.log('   Need to set launched_at timestamp when campaign is executed');
    console.log('   This happens in the campaign execution API endpoint');
    console.log('═══════════════════════════════════════════════════════════════\n');
  }
}

debugCampaignVisibility();
