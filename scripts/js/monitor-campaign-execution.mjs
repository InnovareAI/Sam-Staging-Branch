#!/usr/bin/env node
/**
 * Real-time campaign execution monitoring
 * Tracks: Campaign creation → Processing → Delay → CR sent
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKSPACE_ID = '85e80099-12f9-491a-a0a1-ad48d086a9f0'; // IA7

console.log('📊 MONITORING IA7 CAMPAIGN EXECUTION\n');
console.log('Watching for new campaigns and prospect updates...\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let lastCampaignCheck = new Date();
let lastProspectCheck = new Date();
let knownCampaigns = new Set();
let knownProspects = new Map(); // prospectId -> status

async function checkNewCampaigns() {
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, campaign_name, status, created_at')
    .eq('workspace_id', WORKSPACE_ID)
    .gte('created_at', lastCampaignCheck.toISOString())
    .order('created_at', { ascending: false });

  if (campaigns && campaigns.length > 0) {
    for (const campaign of campaigns) {
      if (!knownCampaigns.has(campaign.id)) {
        knownCampaigns.add(campaign.id);
        const time = new Date().toLocaleTimeString();
        console.log(`\n🆕 [${time}] NEW CAMPAIGN CREATED`);
        console.log(`   ID: ${campaign.id}`);
        console.log(`   Name: ${campaign.campaign_name}`);
        console.log(`   Status: ${campaign.status}`);

        // Get prospects for this campaign
        const { data: prospects } = await supabase
          .from('campaign_prospects')
          .select('id, first_name, last_name, status, linkedin_url')
          .eq('campaign_id', campaign.id);

        if (prospects && prospects.length > 0) {
          console.log(`\n   📋 Prospects (${prospects.length}):`);
          prospects.forEach(p => {
            knownProspects.set(p.id, p.status);
            console.log(`      - ${p.first_name} ${p.last_name} [${p.status}]`);
          });
        }
      }
    }
  }

  lastCampaignCheck = new Date();
}

async function checkProspectUpdates() {
  if (knownProspects.size === 0) return;

  const prospectIds = Array.from(knownProspects.keys());

  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status, contacted_at, updated_at, personalization_data')
    .in('id', prospectIds);

  if (prospects) {
    for (const prospect of prospects) {
      const oldStatus = knownProspects.get(prospect.id);
      if (oldStatus !== prospect.status) {
        const time = new Date().toLocaleTimeString();
        console.log(`\n🔄 [${time}] PROSPECT STATUS CHANGE`);
        console.log(`   Name: ${prospect.first_name} ${prospect.last_name}`);
        console.log(`   ${oldStatus} → ${prospect.status}`);

        if (prospect.personalization_data?.event_id) {
          console.log(`   Event ID: ${prospect.personalization_data.event_id}`);
        }

        if (prospect.contacted_at) {
          console.log(`   ✅ Contacted at: ${new Date(prospect.contacted_at).toLocaleString()}`);
        }

        knownProspects.set(prospect.id, prospect.status);

        // If CR sent, show success
        if (prospect.status === 'cr_sent' || prospect.status === 'connection_request_sent') {
          console.log('\n   🎉 CONNECTION REQUEST SENT SUCCESSFULLY!');
        }
      }
    }
  }
}

async function showExecutionStatus() {
  // Show campaign execution status
  const { data: activeCampaigns } = await supabase
    .from('campaigns')
    .select('id, campaign_name, status')
    .eq('workspace_id', WORKSPACE_ID)
    .in('status', ['active', 'processing']);

  if (activeCampaigns && activeCampaigns.length > 0) {
    console.log(`\n⏳ Active Campaigns: ${activeCampaigns.length}`);
  }
}

// Monitor every 5 seconds
console.log('Starting monitoring... (Ctrl+C to stop)\n');

setInterval(async () => {
  await checkNewCampaigns();
  await checkProspectUpdates();
}, 5000);

// Show execution status every 30 seconds
setInterval(showExecutionStatus, 30000);

// Keep alive
process.stdin.resume();
