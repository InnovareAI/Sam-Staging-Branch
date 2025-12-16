#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHARISSA_WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861';
const SARA_PROVIDER_ID = 'ACoAAAcxZNoBOO3uKSFEtKndR6hFtahdCk0Gj_Y';

console.log('🔍 DETAILED SEND_QUEUE ANALYSIS');
console.log('='.repeat(70));

// Get Charissa's campaign IDs
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID);

const campaignIds = campaigns?.map(c => c.id) || [];

// Search for Sara's provider_id in send_queue
console.log('\n1️⃣ Searching for Sara\'s provider_id in send_queue...');
const { data: saraInQueue } = await supabase
  .from('send_queue')
  .select('*')
  .or(`linkedin_user_id.eq.${SARA_PROVIDER_ID},linkedin_user_id.ilike.%sara-ritchie%`);

console.log(`   Found: ${saraInQueue?.length || 0}`);

// Check send_queue items sent around Dec 2 15:16
console.log('\n2️⃣ Send queue items sent Dec 2 (14:00-17:00)...');
const { data: queueDec2 } = await supabase
  .from('send_queue')
  .select(`
    *,
    campaign_prospects!prospect_id (
      first_name, 
      last_name,
      linkedin_url
    )
  `)
  .in('campaign_id', campaignIds)
  .eq('status', 'sent')
  .gte('sent_at', '2025-12-02T14:00:00Z')
  .lte('sent_at', '2025-12-02T17:00:00Z');

console.log(`   Sent between 14:00-17:00: ${queueDec2?.length || 0}`);
for (const q of queueDec2 || []) {
  const p = q.campaign_prospects;
  console.log(`   - ${p?.first_name || 'UNKNOWN'} | ${q.sent_at} | ${p?.linkedin_url}`);
}

// Check ALL send_queue items for Dec 2
console.log('\n3️⃣ All send_queue scheduled for Dec 2...');
const { data: allDec2 } = await supabase
  .from('send_queue')
  .select(`
    *,
    campaign_prospects!prospect_id (
      first_name, 
      last_name,
      linkedin_url
    )
  `)
  .in('campaign_id', campaignIds)
  .gte('scheduled_for', '2025-12-02T00:00:00Z')
  .lte('scheduled_for', '2025-12-02T23:59:59Z');

console.log(`   Scheduled for Dec 2: ${allDec2?.length || 0}`);
for (const q of allDec2 || []) {
  const p = q.campaign_prospects;
  console.log(`   - ${p?.first_name || 'UNKNOWN'} | Status: ${q.status} | Scheduled: ${q.scheduled_for}`);
}

// Check the message that WAS sent to Sara - what campaign would it be in?
// The message: "Hi Sara, I work for InnovareAI..."
console.log('\n4️⃣ Search for "InnovareAI" in send_queue messages...');
const { data: innovareInQueue } = await supabase
  .from('send_queue')
  .select('*')
  .in('campaign_id', campaignIds)
  .ilike('message', '%InnovareAI%');

console.log(`   Messages with "InnovareAI": ${innovareInQueue?.length || 0}`);
for (const q of innovareInQueue || []) {
  console.log(`   - ${q.linkedin_user_id} | ${q.message?.slice(0, 80)}...`);
}

// Check campaign message templates for "InnovareAI"
console.log('\n5️⃣ Campaign templates containing "InnovareAI"...');
const { data: templatesWithInnovare } = await supabase
  .from('campaigns')
  .select('id, name, message_templates, connection_request_message')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID);

for (const c of templatesWithInnovare || []) {
  const templates = JSON.stringify(c.message_templates || {}) + (c.connection_request_message || '');
  if (templates.toLowerCase().includes('innovareai')) {
    console.log(`   ✓ Found in: ${c.name}`);
    console.log(`     CR Message: ${c.connection_request_message?.slice(0, 100)}`);
    console.log(`     Templates: ${JSON.stringify(c.message_templates).slice(0, 200)}`);
  }
}

console.log('\n' + '='.repeat(70));
