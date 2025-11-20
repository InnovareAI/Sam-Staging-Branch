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

console.log('\n📤 Sending CR with NO message text...\n');

// Get fresh prospect
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, linkedin_url, company_name, title, campaign_id')
  .in('campaign_id', (await supabase.from('campaigns').select('id').eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')).data.map(c => c.id))
  .eq('status', 'pending')
  .is('contacted_at', null)
  .not('first_name', 'in', '(Martin,David)')
  .limit(1)
  .single();

if (!prospects) {
  console.error('❌ No fresh prospects');
  process.exit(1);
}

console.log(`Prospect: ${prospects.first_name} ${prospects.last_name}`);
console.log(`LinkedIn: ${prospects.linkedin_url}`);
console.log(`Message: (empty)\n`);

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

const response = await fetch('https://workflows.innovareai.com/webhook/connector-campaign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

if (response.ok) {
  console.log('✅ Sent!\n');
  console.log(`🎯 Check Tobias's LinkedIn for: ${prospects.first_name} ${prospects.last_name}\n`);
} else {
  const error = await response.text();
  console.error(`❌ Error: ${response.status}`);
  console.error(error);
}
