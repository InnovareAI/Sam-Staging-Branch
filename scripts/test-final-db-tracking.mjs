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

console.log('\n🧪 FINAL TEST - Database tracking after webhook auth fix...\n');

// Get one fresh prospect
const testedNames = ['Martin Redmond', 'David Pisarek', 'John P. Perkins', 'Vinci Ravindran', 'Simon Sokol', 'Paul Landry', 'Reid Hoffman', 'John P. Perkins, P.E.', 'Sean Meister', 'Mark Poppen', 'Erik McBain', 'Erik McBain, CFA', 'ZAKAR HOSSAIN', 'Maca Atencio', 'Russ Jarman Price', 'Emmett Cooper'];
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id')
  .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009');

const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, linkedin_url, company_name, title, campaign_id')
  .in('campaign_id', campaigns.map(c => c.id))
  .eq('status', 'pending')
  .is('contacted_at', null)
  .limit(50);

const fresh = prospects.find(p => !testedNames.includes(`${p.first_name} ${p.last_name}`));

if (!fresh) {
  console.error('❌ No fresh prospects');
  process.exit(1);
}

console.log(`Test prospect: ${fresh.first_name} ${fresh.last_name}`);
console.log(`LinkedIn: ${fresh.linkedin_url}\n`);

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
  console.log('⏳ 504 timeout - but workflow processing...\n');
} else if (!response.ok) {
  const error = await response.text();
  console.error(`❌ Error: ${error}`);
}

// Wait for N8N to process
console.log('⏳ Waiting 15 seconds for N8N + database update...\n');
await new Promise(resolve => setTimeout(resolve, 15000));

// Check database
const { data: updated } = await supabase
  .from('campaign_prospects')
  .select('status, contacted_at')
  .eq('id', fresh.id)
  .single();

console.log('📊 Database Result:');
console.log(`   Status: ${updated.status}`);
console.log(`   Contacted: ${updated.contacted_at || 'null'}\n`);

if (updated.status === 'connection_requested' && updated.contacted_at) {
  console.log('🎉 SUCCESS! DATABASE TRACKING WORKS!\n');
  console.log('✅ Invitations send to LinkedIn');
  console.log('✅ Database updates correctly\n');
  console.log(`🎯 Also check Tobias's LinkedIn for: ${fresh.first_name} ${fresh.last_name}\n`);
} else {
  console.log('❌ Database still not updated\n');
  console.log('May need to check N8N workflow or API endpoint logs.\n');
}
