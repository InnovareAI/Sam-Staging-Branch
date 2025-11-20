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

const prospectId = '930eb36a-6d11-4214-a123-4d10ca569fb9'; // David Murumbi
const campaignId = '9fcfcab0-7007-4628-b49b-1636ba5f781f';

const { data: prospect } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('id', prospectId)
  .single();

const { data: campaign } = await supabase
  .from('campaigns')
  .select('*')
  .eq('id', campaignId)
  .single();

console.log(`\n✅ Final Test: ${prospect.first_name} ${prospect.last_name}`);
console.log(`   Company: ${prospect.company_name || 'N/A'}`);
console.log(`   LinkedIn: ${prospect.linkedin_url}`);
console.log(`   Using: Tobias Linz account (IA7)\n`);

const crMessage = campaign.message_templates.connection_request
  .replace(/{first_name}/g, prospect.first_name)
  .replace(/{last_name}/g, prospect.last_name)
  .replace(/{company_name}/g, prospect.company_name || 'your company')
  .replace(/{title}/g, prospect.title || '');

console.log('📝 Personalized Message:');
console.log(crMessage);

const payload = {
  workspaceId: '85e80099-12f9-491a-a0a1-ad48d086a9f0',
  campaignId: campaignId,
  channel: 'linkedin',
  campaignType: 'connector',
  unipileAccountId: 'v8-RaHZzTD60o6EVwqcpvg',
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
    connection_request: campaign.message_templates.connection_request,
    cr: campaign.message_templates.connection_request
  },
  supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  unipile_dsn: process.env.UNIPILE_DSN,
  unipile_api_key: process.env.UNIPILE_API_KEY
};

console.log('\n📤 Sending to N8N workflow...');
const response = await fetch('https://workflows.innovareai.com/webhook/connector-campaign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

console.log(`   Response: ${response.status} ${response.statusText}\n`);

console.log('⏳ Waiting 20 seconds for workflow to complete...\n');
await new Promise(resolve => setTimeout(resolve, 20000));

const { data: updated } = await supabase
  .from('campaign_prospects')
  .select('status, contacted_at')
  .eq('id', prospectId)
  .single();

console.log('📊 Database Result:');
console.log(`   Status: ${updated.status}`);
console.log(`   Contacted At: ${updated.contacted_at || 'null'}\n`);

if (updated.status === 'connection_requested' && updated.contacted_at) {
  console.log('🎉 SUCCESS! End-to-end test PASSED!');
  console.log('   ✅ Connection request sent to LinkedIn');
  console.log('   ✅ Database tracking updated correctly');
  console.log('   ✅ Timestamp recorded');
  console.log(`\n   Check Tobias Linz LinkedIn for CR to: ${prospect.first_name} ${prospect.last_name}\n`);
} else {
  console.log('❌ TEST FAILED');
  console.log(`   Expected: status='connection_requested' with timestamp`);
  console.log(`   Got: status='${updated.status}', contacted_at=${updated.contacted_at}\n`);
  process.exit(1);
}
