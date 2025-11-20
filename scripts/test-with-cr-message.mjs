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

const prospectId = 'aee63a0b-70bb-4ee7-bfa8-14de8b5c0870';
const campaignId = '9fcfcab0-7007-4628-b49b-1636ba5f781f';

// Get prospect
const { data: prospect } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('id', prospectId)
  .single();

// Get campaign with CR message
const { data: campaign } = await supabase
  .from('campaigns')
  .select('*')
  .eq('id', campaignId)
  .single();

console.log('\n✅ Test Prospect: ' + prospect.first_name + ' ' + prospect.last_name);
console.log('   Company: ' + prospect.company_name);
console.log('\n📝 CR Message (with placeholders):');
console.log(campaign.message_templates.connection_request);

const crMessage = campaign.message_templates.connection_request
  .replace('{first_name}', prospect.first_name)
  .replace('{last_name}', prospect.last_name)
  .replace('{company_name}', prospect.company_name)
  .replace('{title}', prospect.title || '');

console.log('\n📝 CR Message (personalized):');
console.log(crMessage);

const payload = {
  workspaceId: '85e80099-12f9-491a-a0a1-ad48d086a9f0', // IA7
  campaignId: prospect.campaign_id,
  channel: 'linkedin',
  campaignType: 'connector',
  unipileAccountId: 'v8-RaHZzTD60o6EVwqcpvg', // Tobias
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

console.log('\n📤 Sending to N8N with ACTUAL CR message...\n');

const response = await fetch('https://workflows.innovareai.com/webhook/connector-campaign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

console.log(`Response: ${response.status}\n`);

console.log('⏳ Waiting 15 seconds...\n');
await new Promise(resolve => setTimeout(resolve, 15000));

const { data: updated } = await supabase
  .from('campaign_prospects')
  .select('status, contacted_at')
  .eq('id', prospect.id)
  .single();

console.log('📊 Database Result:');
console.log(`   Status: ${updated.status}`);
console.log(`   Contacted: ${updated.contacted_at || 'null'}\n`);

if (updated.status === 'connection_requested' && updated.contacted_at) {
  console.log('🎉 SUCCESS! Check Tobias LinkedIn for CR with message!\n');
} else {
  console.log('❌ Database not updated\n');
}
