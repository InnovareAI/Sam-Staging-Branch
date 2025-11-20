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

console.log('\n✅ Verifying IA7 setup...\n');

// Verify workspace
const { data: workspace } = await supabase
  .from('workspaces')
  .select('id, name, slug')
  .eq('id', IA7_ID)
  .single();

console.log(`Workspace: ${workspace.name} (${workspace.slug})`);
console.log(`   ID: ${workspace.id}\n`);

// Verify account
const { data: account } = await supabase
  .from('workspace_accounts')
  .select('id, account_name, unipile_account_id, connection_status')
  .eq('workspace_id', IA7_ID)
  .eq('account_type', 'linkedin')
  .single();

console.log(`Account: ${account.account_name}`);
console.log(`   Unipile ID: ${account.unipile_account_id}`);
console.log(`   Status: ${account.connection_status}\n`);

console.log('🎯 IA7 is ready!\n');
console.log('Now sending ONE test connection request from Tobias...\n');

// We need a campaign in IA7 first - let's use a campaign from IA1 for testing
// Or create a simple test campaign

// For now, let's just find a fresh prospect from IA1 campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, connection_message, message_templates')
  .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')
  .limit(1)
  .single();

if (!campaigns) {
  console.error('❌ No campaigns found to test with');
  process.exit(1);
}

console.log(`Using campaign: ${campaigns.name}\n`);

// Get ONE fresh prospect that hasn't been tested
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, linkedin_url, company_name, title')
  .eq('campaign_id', campaigns.id)
  .eq('status', 'pending')
  .is('contacted_at', null)
  .limit(10);

if (!prospects || prospects.length === 0) {
  console.error('❌ No fresh prospects');
  process.exit(1);
}

const prospect = prospects[0];

console.log(`Selected prospect: ${prospect.first_name} ${prospect.last_name}`);
console.log(`   LinkedIn: ${prospect.linkedin_url}\n`);

// Send via N8N
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
    connection_request: campaigns.message_templates?.connection_request || campaigns.connection_message || '',
    cr: campaigns.message_templates?.connection_request || campaigns.connection_message || ''
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
  console.log('✅ N8N webhook triggered successfully!\n');
  
  // Update prospect status
  await supabase
    .from('campaign_prospects')
    .update({
      status: 'connection_request_sent',
      contacted_at: new Date().toISOString()
    })
    .eq('id', prospect.id);
  
  console.log('🎯 Check Tobias\'s LinkedIn → My Network → Sent Invitations\n');
  console.log(`   Look for: ${prospect.first_name} ${prospect.last_name}\n`);
} else {
  const error = await response.text();
  console.error(`❌ Failed: ${response.status}`);
  console.error(error);
}
