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
const CAMPAIGN_ID = '683f9214-8a3f-4015-98fe-aa3ae76a9ebe'; // 20251117-IA4-Outreach Campaign

console.log('\n🎯 Sending 3 CRs from Thorsten\'s account...\n');

// Get 3 completely fresh prospects (not the ones we already tested)
const { data: prospects, error } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, linkedin_url, company_name, title, campaign_id')
  .eq('campaign_id', CAMPAIGN_ID)
  .eq('status', 'pending')
  .is('contacted_at', null)
  .limit(50);

if (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

// Filter out prospects we already tested
const testedNames = ['Reid Hoffman', 'Joel Baker', 'Tobi Oladimeji', 'David Pisarek', 
                     'Yangxiang Li', 'Abraham Mann', 'Kim Vallee'];
const freshProspects = prospects.filter(p => 
  !testedNames.includes(`${p.first_name} ${p.last_name}`)
).slice(0, 3);

if (freshProspects.length < 3) {
  console.error('❌ Not enough fresh prospects');
  process.exit(1);
}

console.log('Selected 3 prospects:\n');
freshProspects.forEach((p, i) => {
  console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
  console.log(`   LinkedIn: ${p.linkedin_url}\n`);
});

// Get campaign details
const { data: campaign } = await supabase
  .from('campaigns')
  .select('id, name, connection_message, message_templates')
  .eq('id', CAMPAIGN_ID)
  .single();

// Send each prospect via N8N
for (const prospect of freshProspects) {
  console.log(`📤 Sending CR to ${prospect.first_name} ${prospect.last_name}...`);
  
  const payload = {
    workspaceId: '7f0341da-88db-476b-ae0a-fc0da5b70861',
    campaignId: campaign.id,
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
      console.log(`   ✅ Triggered N8N workflow\n`);
      
      // Update status
      await supabase
        .from('campaign_prospects')
        .update({
          status: 'connection_request_sent',
          contacted_at: new Date().toISOString()
        })
        .eq('id', prospect.id);
    } else {
      const error = await response.text();
      console.log(`   ❌ Failed: ${response.status} - ${error}\n`);
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}\n`);
  }
  
  // Wait 2 seconds between sends
  await new Promise(resolve => setTimeout(resolve, 2000));
}

console.log('✅ Done! Check Thorsten\'s LinkedIn for sent invitations.\n');
