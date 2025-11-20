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

console.log('\n🧪 Testing with completely fresh prospect...\n');

// Get campaigns from IA1
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id')
  .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009');

// Get completely fresh prospect
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, linkedin_url, company_name, title, campaign_id, status, contacted_at')
  .in('campaign_id', campaigns.map(c => c.id))
  .eq('status', 'pending')
  .is('contacted_at', null)
  .limit(20);

console.log(`Found ${prospects.length} pending prospects\n`);

// Skip the ones we already tested
const testedNames = ['Martin Redmond', 'David Pisarek', 'John P. Perkins'];
const fresh = prospects.find(p => !testedNames.includes(`${p.first_name} ${p.last_name}`));

if (!fresh) {
  console.error('❌ No fresh prospects available');
  process.exit(1);
}

console.log(`Selected: ${fresh.first_name} ${fresh.last_name}`);
console.log(`LinkedIn: ${fresh.linkedin_url}`);
console.log(`Current status: ${fresh.status}\n`);

const payload = {
  workspaceId: IA7_ID,
  campaignId: fresh.campaign_id,
  channel: 'linkedin',
  campaignType: 'connector',
  unipileAccountId: TOBIAS_UNIPILE_ID,
  prospects: [{
    id: fresh.id,
    first_name: fresh.first_name,
    last_name: fresh.last_name,
    linkedin_url: fresh.linkedin_url,
    company_name: fresh.company_name,
    title: fresh.title,
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

console.log(`Response: ${response.status}\n`);

if (response.status === 504) {
  console.log('⏳ 504 timeout - but workflow might still be processing...\n');
} else if (!response.ok) {
  const error = await response.text();
  console.error(`❌ Error: ${error}`);
  process.exit(1);
}

// Wait for processing
console.log('⏳ Waiting 8 seconds for N8N to process...\n');
await new Promise(resolve => setTimeout(resolve, 8000));

// Check database
const { data: updated } = await supabase
  .from('campaign_prospects')
  .select('status, contacted_at')
  .eq('id', fresh.id)
  .single();

console.log('📊 Database Status:');
console.log(`   Status: ${updated.status}`);
console.log(`   Contacted: ${updated.contacted_at || 'null'}\n`);

if (updated.status !== 'pending' && updated.contacted_at) {
  console.log('✅ SUCCESS! Database was updated!\n');
  console.log(`🎯 Check Tobias's LinkedIn for: ${fresh.first_name} ${fresh.last_name}\n`);
} else {
  console.log('❌ Database NOT updated\n');
  console.log('N8N might still have the JSON error or the webhook didn\'t work.\n');
}
