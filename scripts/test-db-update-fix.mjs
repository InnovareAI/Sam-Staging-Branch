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

const IA7_ID = '85e80099-12f9-491a-a0a1-ad48d086a9f0';
const TOBIAS_UNIPILE_ID = 'v8-RaHZzTD60o6EVwqcpvg';

console.log('\n🧪 Testing N8N database update fix...\n');

// Get one fresh prospect
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, linkedin_url, company_name, title, campaign_id')
  .in('campaign_id', (await supabase.from('campaigns').select('id').eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')).data.map(c => c.id))
  .eq('status', 'pending')
  .is('contacted_at', null)
  .not('first_name', 'in', '(Martin,David,John)')
  .limit(1)
  .single();

if (!prospects) {
  console.error('❌ No fresh prospects');
  process.exit(1);
}

console.log(`Test prospect: ${prospects.first_name} ${prospects.last_name}`);
console.log(`LinkedIn: ${prospects.linkedin_url}\n`);

const payload = {
  workspaceId: IA7_ID,
  campaignId: prospects.campaign_id,
  channel: 'linkedin',
  campaignType: 'connector',
  unipileAccountId: TOBIAS_UNIPILE_ID,
  prospects: [{
    id: prospects.id,
    first_name: prospects.first_name,
    last_name: prospects.last_name,
    linkedin_url: prospects.linkedin_url,
    company_name: prospects.company_name,
    title: prospects.title,
    send_delay_minutes: 0
  }],
  messages: {
    connection_request: "",
    cr: ""
  },
  supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  unipile_dsn: process.env.UNIPILE_DSN,
  unipile_api_key: process.env.UNIPILE_API_KEY
};

console.log('📤 Sending to N8N...\n');

const response = await fetch('https://workflows.innovareai.com/webhook/connector-campaign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

if (response.ok) {
  console.log('✅ N8N accepted request\n');
  
  // Wait 5 seconds for N8N to process
  console.log('⏳ Waiting 5 seconds for N8N to update database...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check if database was updated
  const { data: updated } = await supabase
    .from('campaign_prospects')
    .select('status, contacted_at')
    .eq('id', prospects.id)
    .single();
  
  console.log('📊 Database check:');
  console.log(`   Status: ${updated.status}`);
  console.log(`   Contacted at: ${updated.contacted_at || 'null'}\n`);
  
  if (updated.status === 'connection_requested' || updated.status === 'connection_request_sent') {
    console.log('✅ SUCCESS! Database was updated by N8N!\n');
    console.log('🎯 Also check Tobias\'s LinkedIn for the invitation.\n');
  } else {
    console.log('❌ Database NOT updated - still showing status: ' + updated.status + '\n');
    console.log('The JSON error might still be happening.\n');
  }
} else {
  const error = await response.text();
  console.error(`❌ N8N error: ${response.status}`);
  console.error(error);
}
