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
dotenv.config({ path: join(__dirname, '../.env.local') });

const CAMPAIGN_ID = '683f9214-8a3f-4015-98fe-aa3ae76a9ebe';
const WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861';
const N8N_WEBHOOK_URL = 'https://workflows.innovareai.com/webhook/connector-campaign';

console.log('🚀 Executing Charissa\'s campaign...\n');

// Build N8N payload matching execute-via-n8n API format
const payload = {
  workspaceId: WORKSPACE_ID,
  campaignId: CAMPAIGN_ID,
  channel: 'linkedin',
  campaignType: 'connector',
  unipileAccountId: '4nt1J-blSnGUPBjH2Nfjpg',

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
    skipWeekends: false,  // DISABLED for immediate test (Sunday)
    skipHolidays: false
  },

  prospects: [
    // Will be populated from database query
  ],

  // Messages will be populated from database templates
  messages: {},

  timing: {
    fu1DelayDays: 2,
    fu2DelayDays: 5,
    fu3DelayDays: 7,
    fu4DelayDays: 5,
    gbDelayDays: 7
  },

  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,  // N8N expects snake_case
  supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,  // N8N expects snake_case
  unipileDsn: process.env.UNIPILE_DSN,  // Don't add https:// here
  unipile_dsn: process.env.UNIPILE_DSN,  // N8N expects snake_case and adds https://
  unipileApiKey: process.env.UNIPILE_API_KEY,
  unipile_api_key: process.env.UNIPILE_API_KEY  // N8N expects snake_case
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
  .in('status', ['pending', 'approved', 'ready_to_message', 'queued_in_n8n'])
  .limit(1);  // TEST: Send only 1 prospect

if (error) {
  console.error('❌ Failed to fetch prospects:', error);
  process.exit(1);
}

if (!prospects || prospects.length === 0) {
  console.error('❌ No prospects found for campaign');
  process.exit(1);
}

console.log(`✅ Found ${prospects.length} prospects\n`);

// FETCH MESSAGE TEMPLATES FROM DATABASE
console.log('📝 Fetching message templates from database...');
const { data: campaignData, error: campaignError } = await supabase
  .from('campaigns')
  .select('message_templates')
  .eq('id', CAMPAIGN_ID)
  .single();

if (campaignError || !campaignData) {
  console.error('❌ Failed to fetch campaign templates:', campaignError);
  process.exit(1);
}

const templates = campaignData.message_templates;
console.log(`✅ Loaded message templates from database\n`);

// Populate messages with all templates (N8N expects snake_case)
payload.messages = {
  // Connection request
  connectionRequest: templates.connection_request,
  connection_request: templates.connection_request,
  cr: templates.connection_request,

  // Follow-up messages (N8N expects snake_case)
  follow_up_1: templates.follow_up_messages?.[0] || '',
  follow_up_2: templates.follow_up_messages?.[1] || '',
  follow_up_3: templates.follow_up_messages?.[2] || '',
  follow_up_4: templates.follow_up_messages?.[3] || '',
  goodbye_message: templates.follow_up_messages?.[4] || '',
  goodbye: templates.follow_up_messages?.[4] || '',  // N8N also checks this field

  // Alternative/acceptance message
  alternative_message: templates.alternative_message || templates.follow_up_messages?.[0] || '',
  acceptance_message: templates.alternative_message || templates.follow_up_messages?.[0] || ''  // N8N also checks this
};

// PRODUCTION-GRADE HUMAN RANDOMIZER
// Mimics natural human sending patterns with day-specific variations
async function calculateHumanSendDelay(prospectIndex, totalProspects, unipileAccountId) {
  // First message always immediate
  if (prospectIndex === 0) return 0;

  // Get account daily limit (20 for free LinkedIn)
  const dailyLimit = 20;

  // Generate day-specific randomization seed
  const today = new Date().toISOString().split('T')[0];
  const dateSeed = parseInt(today.replace(/-/g, '')) + unipileAccountId.charCodeAt(0);
  const dayPattern = (dateSeed % 5); // 5 different day patterns

  // Determine today's sending pattern
  let hourlyRate; // messages per hour

  switch (dayPattern) {
    case 0: // Slow day: 0-2 messages/hour
      hourlyRate = Math.random() * 2;
      console.log(`📊 Pattern: Slow day (${hourlyRate.toFixed(1)} msg/hr)`);
      break;
    case 1: // Medium day: 2-3 messages/hour
      hourlyRate = 2 + Math.random();
      console.log(`📊 Pattern: Medium day (${hourlyRate.toFixed(1)} msg/hr)`);
      break;
    case 2: // Busy day: 3-5 messages/hour
      hourlyRate = 3 + Math.random() * 2;
      console.log(`📊 Pattern: Busy day (${hourlyRate.toFixed(1)} msg/hr)`);
      break;
    case 3: // Mixed: burst then pause
      hourlyRate = prospectIndex % 2 === 0 ? 4 + Math.random() : 1 + Math.random();
      console.log(`📊 Pattern: Mixed (${hourlyRate.toFixed(1)} msg/hr)`);
      break;
    case 4: // Variable: changes throughout day
      hourlyRate = 1 + Math.random() * 3;
      console.log(`📊 Pattern: Variable (${hourlyRate.toFixed(1)} msg/hr)`);
      break;
  }

  // Convert hourly rate to minutes between messages
  const avgMinutesBetween = 60 / hourlyRate;

  // Add ±30% random variation for natural feel
  const variation = (Math.random() - 0.5) * 0.6; // -30% to +30%
  const delayMinutes = Math.round(avgMinutesBetween * (1 + variation));

  // Safety bounds: 2-20 minutes between messages
  const boundedDelay = Math.max(2, Math.min(20, delayMinutes));

  console.log(`  → Prospect ${prospectIndex + 1}: ${boundedDelay} min delay`);

  return boundedDelay;
}

// Map prospects to N8N format with PRODUCTION-GRADE RANDOMIZATION
payload.prospects = await Promise.all(prospects.map(async (p, index) => {
  const sendDelay = await calculateHumanSendDelay(index, prospects.length, payload.unipileAccountId);

  // Extract LinkedIn username from URL for Unipile API
  const linkedinUsername = p.linkedin_url
    ? p.linkedin_url.split('/in/')[1]?.replace(/\/$/, '')
    : null;

  return {
    id: p.id,
    prospectId: p.id,
    campaignId: CAMPAIGN_ID,
    firstName: p.first_name,
    first_name: p.first_name,  // N8N expects snake_case
    lastName: p.last_name,
    last_name: p.last_name,  // N8N expects snake_case
    linkedinUrl: p.linkedin_url,
    linkedin_url: p.linkedin_url,  // N8N expects snake_case
    linkedinUsername: linkedinUsername,  // CRITICAL: Extract for Unipile API
    linkedin_username: linkedinUsername,  // N8N expects snake_case
    linkedinUserId: p.linkedin_user_id,
    linkedin_user_id: p.linkedin_user_id,  // N8N expects snake_case
    companyName: p.company_name,
    company_name: p.company_name,  // N8N expects snake_case
    title: p.title,
    sendDelayMinutes: sendDelay,
    send_delay_minutes: sendDelay  // N8N expects snake_case
  };
}));

console.log('📤 Sending to N8N webhook...');
console.log(`  Prospects: ${payload.prospects.length}`);
console.log(`  Campaign Type: ${payload.campaignType}`);
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
