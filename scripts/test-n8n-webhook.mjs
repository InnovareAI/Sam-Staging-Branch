#!/usr/bin/env node

/**
 * Test N8N webhook with actual campaign data to diagnose execution failure
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

// Test with Charissa's campaign
const campaignId = '683f9214-8a3f-4015-98fe-aa3ae76a9ebe';
const workspaceId = '7f0341da-88db-476b-ae0a-fc0da5b70861';
const unipileAccountId = '4nt1J-blSnGUPBjH2Nfjpg';

console.log('🧪 Testing N8N Webhook Execution');
console.log('================================\n');

// Get campaign details
const { data: campaign } = await supabase
  .from('campaigns')
  .select('message_templates')
  .eq('id', campaignId)
  .single();

// Get one pending prospect
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', campaignId)
  .eq('status', 'pending')
  .limit(1);

if (!prospects || prospects.length === 0) {
  console.log('❌ No pending prospects found');
  process.exit(1);
}

const prospect = prospects[0];
console.log('📋 Test Prospect:');
console.log(`   Name: ${prospect.first_name} ${prospect.last_name}`);
console.log(`   LinkedIn: ${prospect.linkedin_url}`);
console.log(`   Company: ${prospect.company_name}\n`);

// Build payload exactly as the script does
const payload = {
  workspaceId: workspaceId,
  campaignId: campaignId,
  channel: 'linkedin',
  campaignType: 'connector',
  unipileAccountId: unipileAccountId,
  unipile_account_id: unipileAccountId,

  accountTracking: {
    dailyMessageLimit: 20,
    messagesSentToday: 0,
    lastMessageDate: new Date().toISOString(),
    remainingToday: 20
  },

  scheduleSettings: {
    timezone: 'America/Los_Angeles',
    workingHoursStart: 5,
    workingHoursEnd: 18,
    skipWeekends: false,
    skipHolidays: false
  },

  prospects: [{
    id: prospect.id,
    prospect_id: prospect.id,
    linkedin_url: prospect.linkedin_url,
    linkedin_username: prospect.linkedin_url?.split('/in/')[1]?.replace(/\/$/, ''),
    first_name: prospect.first_name || '',
    last_name: prospect.last_name || '',
    company_name: prospect.company_name || '',
    sendDelayMinutes: 0,
    send_delay_minutes: 0
  }],

  messages: {
    connectionRequest: campaign.message_templates?.connection_request || '',
    connection_request: campaign.message_templates?.connection_request || '',
    cr: campaign.message_templates?.connection_request || '',
    follow_up_1: campaign.message_templates?.follow_up_messages?.[0] || '',
    follow_up_2: campaign.message_templates?.follow_up_messages?.[1] || '',
    follow_up_3: campaign.message_templates?.follow_up_messages?.[2] || '',
    follow_up_4: campaign.message_templates?.follow_up_messages?.[3] || '',
    goodbye_message: campaign.message_templates?.follow_up_messages?.[4] || '',
    alternative_message: campaign.message_templates?.alternative_message || ''
  },

  timing: {
    fu1DelayDays: 2,
    fu2DelayDays: 5,
    fu3DelayDays: 7,
    fu4DelayDays: 5,
    gbDelayDays: 7
  },

  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  unipileDsn: process.env.UNIPILE_DSN,
  unipile_dsn: process.env.UNIPILE_DSN,
  unipileApiKey: process.env.UNIPILE_API_KEY,
  unipile_api_key: process.env.UNIPILE_API_KEY
};

console.log('📤 Sending payload to N8N...');
console.log(`   Webhook: https://workflows.innovareai.com/webhook/connector-campaign`);
console.log(`   Prospect ID: ${payload.prospects[0].id}`);
console.log(`   LinkedIn URL: ${payload.prospects[0].linkedin_url}\n`);

try {
  const response = await fetch('https://workflows.innovareai.com/webhook/connector-campaign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  console.log(`📥 Response: HTTP ${response.status}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Error: ${errorText}`);

    console.log('\n🔍 Debugging Info:');
    console.log('   - Check N8N workflow is active');
    console.log('   - Check webhook path is /webhook/connector-campaign');
    console.log('   - Check N8N has UNIPILE_DSN and UNIPILE_API_KEY env vars');
    console.log('   - Check N8N execution logs at https://workflows.innovareai.com');

    process.exit(1);
  }

  const result = await response.json();
  console.log('✅ Webhook accepted!\n');
  console.log('📊 Response:', JSON.stringify(result, null, 2));

  console.log('\n⏳ Waiting 10 seconds for N8N to process...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Check if prospect status changed
  const { data: updatedProspect } = await supabase
    .from('campaign_prospects')
    .select('status')
    .eq('id', prospect.id)
    .single();

  console.log('🔍 Prospect Status Check:');
  console.log(`   Before: pending`);
  console.log(`   After: ${updatedProspect.status}`);

  if (updatedProspect.status === 'pending') {
    console.log('\n⚠️  WARNING: Prospect still "pending" after 10 seconds');
    console.log('   This means N8N accepted the webhook but did NOT process it!');
    console.log('\n🔎 DIAGNOSIS:');
    console.log('   1. N8N webhook URL is CORRECT ✅');
    console.log('   2. Payload format is CORRECT ✅');
    console.log('   3. N8N workflow has INTERNAL ERROR ❌');
    console.log('\n📋 Next Steps:');
    console.log('   1. Go to https://workflows.innovareai.com');
    console.log('   2. Check "Executions" tab for recent failures');
    console.log('   3. Look for errors in workflow nodes');
    console.log('   4. Common issues:');
    console.log('      - Missing UNIPILE_DSN environment variable');
    console.log('      - Missing UNIPILE_API_KEY environment variable');
    console.log('      - Workflow not active');
    console.log('      - Unipile node configuration wrong');
  } else if (updatedProspect.status === 'cr_sent') {
    console.log('\n✅ SUCCESS! Connection request sent!');
  } else if (updatedProspect.status === 'queued_in_n8n') {
    console.log('\n✅ Prospect queued in N8N (status changed)');
  } else {
    console.log(`\n⚠️  Unexpected status: ${updatedProspect.status}`);
  }

} catch (error) {
  console.error('❌ Fetch Error:', error.message);
  process.exit(1);
}
