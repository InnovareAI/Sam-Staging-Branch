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

console.log('\n📤 Sending test with SHORT message...\n');

// Get a fresh prospect
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name')
  .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')
  .limit(1)
  .single();

const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, linkedin_url, company_name, title')
  .eq('campaign_id', campaigns.id)
  .eq('status', 'pending')
  .is('contacted_at', null)
  .limit(5);

const prospect = prospects[1]; // Get second one since we already tried first

console.log(`Prospect: ${prospect.first_name} ${prospect.last_name}`);
console.log(`LinkedIn: ${prospect.linkedin_url}\n`);

// Use a SHORT message that fits LinkedIn's limit
const shortMessage = "Hi, I'd like to connect and learn more about your work. Open to it?";

console.log(`Message (${shortMessage.length} chars): "${shortMessage}"\n`);

const payload = {
  workspaceId: IA7_ID,
  campaignId: campaigns.id,
  channel: 'linkedin',
  campaignType: 'connector',
  unipileAccountId: TOBIAS_UNIPILE_ID,
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
    connection_request: shortMessage,
    cr: shortMessage
  },
  supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  unipile_dsn: process.env.UNIPILE_DSN,
  unipile_api_key: process.env.UNIPILE_API_KEY
};

const response = await fetch('https://workflows.innovareai.com/webhook/connector-campaign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

if (response.ok) {
  console.log('✅ Sent successfully!\n');
  
  await supabase
    .from('campaign_prospects')
    .update({
      status: 'connection_request_sent',
      contacted_at: new Date().toISOString()
    })
    .eq('id', prospect.id);
  
  console.log(`🎯 Check Tobias's LinkedIn for: ${prospect.first_name} ${prospect.last_name}\n`);
} else {
  const error = await response.text();
  console.error(`❌ Failed: ${response.status}`);
  console.error(error);
}
