#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const THORSTEN_UNIPILE_ID = 'mERQmojtSZq5GeomZZazlw';
const IA1_WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

console.log('\n🎯 Sending 3 CRs from Thorsten Linz (IA1)...\n');

// Get campaigns from IA1 workspace
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name')
  .eq('workspace_id', IA1_WORKSPACE_ID)
  .limit(5);

console.log('IA1 Campaigns:');
campaigns.forEach(c => console.log(`  - ${c.name} (${c.id})`));
console.log();

// Use the first campaign with pending prospects
let selectedCampaign = null;
let prospects = [];

for (const campaign of campaigns) {
  const { data: campaignProspects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, linkedin_url, company_name, title')
    .eq('campaign_id', campaign.id)
    .eq('status', 'pending')
    .is('contacted_at', null)
    .limit(10);
  
  if (campaignProspects && campaignProspects.length >= 3) {
    selectedCampaign = campaign;
    prospects = campaignProspects.slice(0, 3);
    break;
  }
}

if (!selectedCampaign) {
  console.error('❌ No campaigns with 3+ pending prospects in IA1');
  process.exit(1);
}

console.log(`Using campaign: ${selectedCampaign.name}\n`);
console.log('Selected 3 prospects:\n');
prospects.forEach((p, i) => {
  console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
  console.log(`   LinkedIn: ${p.linkedin_url}\n`);
});

// Get campaign message
const { data: campaign } = await supabase
  .from('campaigns')
  .select('connection_message, message_templates')
  .eq('id', selectedCampaign.id)
  .single();

// Send each prospect
for (const prospect of prospects) {
  console.log(`📤 Sending CR to ${prospect.first_name} ${prospect.last_name}...`);
  
  const payload = {
    workspaceId: IA1_WORKSPACE_ID,
    campaignId: selectedCampaign.id,
    channel: 'linkedin',
    campaignType: 'connector',
    unipileAccountId: THORSTEN_UNIPILE_ID,
    prospects: [{
      id: prospect.id,
      first_name: prospect.first_name,
      last_name: prospect.last_name,
      linkedin_url: prospect.linkedin_url,
      company_name: prospect.company_name,
      title: prospect.title,
      send_delay_minutes: 0
    }],
    messages: {
      connection_request: campaign.message_templates?.connection_request || campaign.connection_message || '',
      cr: campaign.message_templates?.connection_request || campaign.connection_message || ''
    },
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    unipile_dsn: process.env.UNIPILE_DSN,
    unipile_api_key: process.env.UNIPILE_API_KEY
  };

  try {
    const response = await fetch('https://workflows.innovareai.com/webhook/connector-campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log(`   ✅ Triggered\n`);
      
      await supabase
        .from('campaign_prospects')
        .update({
          status: 'connection_request_sent',
          contacted_at: new Date().toISOString()
        })
        .eq('id', prospect.id);
    } else {
      const error = await response.text();
      console.log(`   ❌ Failed: ${error}\n`);
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}\n`);
  }
  
  await new Promise(resolve => setTimeout(resolve, 3000));
}

console.log('✅ Done! Check Thorsten\'s LinkedIn → My Network → Sent Invitations\n');
