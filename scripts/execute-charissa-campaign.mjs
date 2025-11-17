#!/usr/bin/env node

/**
 * Manually execute Charissa's campaign via N8N
 * Campaign: 20251117-IA4-Outreach Campaign
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment from project
dotenv.config({ path: join(__dirname, '../Dev_Master/InnovareAI/Sam-New-Sep-7/.env.local') });

const CAMPAIGN_ID = '683f9214-8a3f-4015-98fe-aa3ae76a9ebe';
const WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861';
const N8N_WEBHOOK_URL = 'https://workflows.innovareai.com/webhook/connector-campaign';

console.log('🚀 Executing Charissa\'s campaign...\n');

// Build N8N payload matching execute-via-n8n API format
const payload = {
  workspace_id: WORKSPACE_ID,
  campaign_id: CAMPAIGN_ID,
  channel: 'linkedin',
  campaign_type: 'connector',
  unipile_account_id: '4nt1J-blSnGUPBjH2Nfjpg',

  account_tracking: {
    daily_message_limit: 20,
    messages_sent_today: 0,
    last_message_date: new Date().toISOString(),
    remaining_today: 20
  },

  schedule_settings: {
    timezone: 'America/Los_Angeles',
    working_hours_start: 5,
    working_hours_end: 18,
    skip_weekends: true,
    skip_holidays: true
  },

  prospects: [
    // Will be populated from database query
  ],

  messages: {
    connection_request: "Hi {first_name}, \n\nI work with early-stage founders on scaling outbound without burning time or budget on traditional sales hires. Saw that you're building {company_name} and thought it might be worth connecting.\n\nOpen to it?"
  },

  timing: {
    fu1_delay_days: 2,
    fu2_delay_days: 5,
    fu3_delay_days: 7,
    fu4_delay_days: 5,
    gb_delay_days: 7
  },

  supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  unipile_dsn: `https://${process.env.UNIPILE_DSN}`,
  unipile_api_key: process.env.UNIPILE_API_KEY
};

console.log('📋 Campaign Details:');
console.log(`  Campaign ID: ${CAMPAIGN_ID}`);
console.log(`  Workspace ID: ${WORKSPACE_ID}`);
console.log(`  N8N Webhook: ${N8N_WEBHOOK_URL}`);
console.log('');

// Fetch prospects from database
console.log('📊 Fetching prospects from database...');

const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: prospects, error } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, email, company_name, title, linkedin_url, linkedin_user_id, status')
  .eq('campaign_id', CAMPAIGN_ID)
  .in('status', ['pending', 'approved', 'ready_to_message', 'queued_in_n8n']);

if (error) {
  console.error('❌ Failed to fetch prospects:', error);
  process.exit(1);
}

if (!prospects || prospects.length === 0) {
  console.error('❌ No prospects found for campaign');
  process.exit(1);
}

console.log(`✅ Found ${prospects.length} prospects\n`);

// Map prospects to N8N format
payload.prospects = prospects.map((p, index) => ({
  id: p.id,
  prospect_id: p.id,
  campaign_id: CAMPAIGN_ID,
  first_name: p.first_name,
  last_name: p.last_name,
  linkedin_url: p.linkedin_url,
  linkedin_user_id: p.linkedin_user_id,
  company_name: p.company_name,
  title: p.title,
  send_delay_minutes: index === 0 ? 0 : 5 // First immediate, rest 5 min apart
}));

console.log('📤 Sending to N8N webhook...');
console.log(`  Prospects: ${payload.prospects.length}`);
console.log(`  Campaign Type: ${payload.campaign_type}`);
console.log('');

// Call N8N webhook
try {
  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ N8N webhook failed:');
    console.error(`  Status: ${response.status}`);
    console.error(`  Response: ${errorText}`);
    process.exit(1);
  }

  const result = await response.json();
  console.log('✅ N8N accepted campaign!');
  console.log('  Result:', JSON.stringify(result, null, 2));
  console.log('');

  // Update prospect statuses
  console.log('📝 Updating prospect statuses to queued_in_n8n...');
  const { error: updateError } = await supabase
    .from('campaign_prospects')
    .update({ status: 'queued_in_n8n' })
    .eq('campaign_id', CAMPAIGN_ID)
    .in('status', ['pending', 'approved', 'ready_to_message']);

  if (updateError) {
    console.error('⚠️  Failed to update prospect statuses:', updateError);
  } else {
    console.log('✅ Prospect statuses updated');
  }

  // Update campaign
  console.log('📝 Updating campaign status...');
  const { error: campaignError } = await supabase
    .from('campaigns')
    .update({
      status: 'active',
      last_executed_at: new Date().toISOString()
    })
    .eq('id', CAMPAIGN_ID);

  if (campaignError) {
    console.error('⚠️  Failed to update campaign:', campaignError);
  } else {
    console.log('✅ Campaign status updated');
  }

  console.log('');
  console.log('🎉 Campaign execution complete!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Monitor N8N at https://workflows.innovareai.com');
  console.log('2. Check prospect statuses in database');
  console.log('3. Verify connection requests are being sent');

} catch (error) {
  console.error('❌ Error executing campaign:', error.message);
  console.error(error);
  process.exit(1);
}
