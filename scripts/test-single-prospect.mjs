#!/usr/bin/env node

/**
 * Test sending a single prospect through N8N after workflow update
 */

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

const WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861'; // IA4
const UNIPILE_ACCOUNT_ID = '4nt1J-blSnGUPBjH2Nfjpg'; // Charissa
const CAMPAIGN_ID = '683f9214-8a3f-4015-98fe-aa3ae76a9ebe'; // 20251117-IA4-Outreach Campaign

console.log('🧪 Testing Single Prospect through N8N\n');

// Get first pending prospect
const { data: prospects, error } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, linkedin_url, company_name, title')
  .eq('campaign_id', CAMPAIGN_ID)
  .eq('status', 'pending')
  .limit(1);

if (error || !prospects || prospects.length === 0) {
  console.error('❌ No pending prospects found');
  process.exit(1);
}

const prospect = prospects[0];

// Get campaign details
const { data: campaign } = await supabase
  .from('campaigns')
  .select('name, connection_message, message_templates')
  .eq('id', CAMPAIGN_ID)
  .single();

console.log(`📋 Test Prospect: ${prospect.first_name} ${prospect.last_name}`);
console.log(`📋 Campaign: ${campaign.name}`);
console.log(`📋 LinkedIn: ${prospect.linkedin_url}\n`);

// Prepare payload (NO unipile_dsn or unipileApiKey - N8N will use env vars)
const payload = {
  workspaceId: WORKSPACE_ID,
  campaignId: CAMPAIGN_ID,
  channel: 'linkedin',
  campaignType: 'connector',
  unipileAccountId: UNIPILE_ACCOUNT_ID,
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
  supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY
};

console.log('🚀 Sending to N8N webhook...\n');

// Send to N8N (fire-and-forget)
fetch('https://workflows.innovareai.com/webhook/connector-campaign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
}).catch(err => {
  console.error(`⚠️  N8N trigger warning: ${err.message}`);
});

// Mark as queued
await supabase
  .from('campaign_prospects')
  .update({
    status: 'queued',
    scheduled_send_at: new Date().toISOString()
  })
  .eq('id', prospect.id);

console.log('✅ Test prospect sent to N8N!');
console.log('\n📌 Next Steps:');
console.log('1. Check N8N executions at: https://workflows.innovareai.com/workflow/aVG6LC4ZFRMN7Bw6/executions');
console.log('2. Check Charissa\'s LinkedIn for the connection request');
console.log('3. If successful, run the cron job for all remaining prospects\n');
