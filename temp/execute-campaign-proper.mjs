#!/usr/bin/env node

/**
 * Execute campaign via SAM's actual API endpoint
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CAMPAIGN_ID = '4cd9275f-b82d-47d6-a1d4-7207b992c4b7';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

console.log('🚀 Executing Campaign via SAM API\n');

// Step 1: Reset prospects
console.log('Step 1: Resetting failed/queued prospects...\n');

const { data: resetProspects } = await supabase
  .from('campaign_prospects')
  .update({ status: 'pending', contacted_at: null })
  .eq('campaign_id', CAMPAIGN_ID)
  .in('status', ['failed', 'queued_in_n8n'])
  .select();

console.log(`✅ Reset ${resetProspects.length} prospects to pending\n`);

// Step 2: Call the execute-live API
console.log('Step 2: Calling execute-live API...\n');

// We need to simulate an authenticated request
// For now, let's trigger via N8N webhook directly with proper payload

const { data: campaign } = await supabase
  .from('campaigns')
  .select('*')
  .eq('id', CAMPAIGN_ID)
  .single();

const { data: workspaceAccounts } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', campaign.workspace_id)
  .eq('is_active', true)
  .limit(1);

campaign.workspace_accounts = workspaceAccounts;

const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', CAMPAIGN_ID)
  .eq('status', 'pending')
  .limit(5);

console.log(`Campaign: ${campaign.name}`);
console.log(`Account: ${campaign.workspace_accounts[0]?.account_name}`);
console.log(`Unipile ID: ${campaign.workspace_accounts[0]?.unipile_account_id}`);
console.log(`Prospects to send: ${prospects.length}\n`);

// Build N8N payload (match exact format from SAM API)
const n8nPayload = {
  workspaceId: campaign.workspace_id,
  campaignId: campaign.id,
  unipileAccountId: campaign.workspace_accounts[0].unipile_account_id,
  prospects: prospects.map(p => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    company_name: p.company_name,
    linkedin_url: p.linkedin_url,
    email: p.email
  })),
  messages: {
    cr: campaign.message_templates?.connection_request || campaign.connection_message,
    fu1: campaign.message_templates?.follow_up_1,
    fu2: campaign.message_templates?.follow_up_2,
    fu3: campaign.message_templates?.follow_up_3,
    fu4: campaign.message_templates?.follow_up_4,
    fu5: campaign.message_templates?.follow_up_5,
    fu6: campaign.message_templates?.follow_up_6
  },
  timing: {
    fu1_delay_hours: 6,
    fu2_delay_days: 3,
    fu3_delay_days: 5,
    fu4_delay_days: 5,
    fu5_delay_days: 5,
    fu6_delay_days: 5
  },
  supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  unipile_dsn: `https://${process.env.UNIPILE_DSN}`,
  unipile_api_key: process.env.UNIPILE_API_KEY
};

console.log('Payload preview:');
console.log(`  - Campaign: ${n8nPayload.campaignId}`);
console.log(`  - Unipile Account: ${n8nPayload.unipileAccountId}`);
console.log(`  - Prospects: ${n8nPayload.prospects.length}`);
console.log(`  - CR Message: "${n8nPayload.messages.cr?.substring(0, 50)}..."`);
console.log('');

// Send to N8N
console.log('Sending to N8N webhook...\n');

const response = await fetch(process.env.N8N_CAMPAIGN_WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.N8N_API_KEY}`
  },
  body: JSON.stringify(n8nPayload)
});

console.log(`N8N Response: ${response.status} ${response.statusText}`);

if (response.ok) {
  const result = await response.text();
  console.log(`✅ Response: ${result || 'OK'}\n`);

  // Update prospects to queued
  await supabase
    .from('campaign_prospects')
    .update({ status: 'queued_in_n8n' })
    .in('id', prospects.map(p => p.id));

  console.log('✅ Prospects marked as queued_in_n8n\n');
  console.log('⏳ Monitoring N8N executions (check in 30 seconds)...');
  console.log('   https://workflows.innovareai.com/workflow/dsJ40aZYDOtSC1F7/executions\n');
} else {
  const error = await response.text();
  console.error(`❌ N8N Error: ${error}\n`);
  process.exit(1);
}
