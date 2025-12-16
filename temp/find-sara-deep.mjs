#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 DEEP SEARCH FOR SARA RITCHIE');
console.log('='.repeat(70));

// 1. Search ALL prospects across ALL workspaces
console.log('\n1️⃣ SEARCHING ALL WORKSPACES FOR SARA...');

const { data: allSaras } = await supabase
  .from('campaign_prospects')
  .select('*, campaigns(name, workspace_id, workspaces(name))')
  .or('first_name.ilike.%sara%,last_name.ilike.%ritchie%');

console.log(`   Found ${allSaras?.length || 0} prospects with "sara" or "ritchie"`);

for (const p of allSaras || []) {
  console.log(`\n   👤 ${p.first_name} ${p.last_name}`);
  console.log(`      Workspace: ${p.campaigns?.workspaces?.name}`);
  console.log(`      Campaign: ${p.campaigns?.name}`);
  console.log(`      Status: ${p.status}`);
  console.log(`      LinkedIn URL: ${p.linkedin_url}`);
  console.log(`      LinkedIn User ID: ${p.linkedin_user_id}`);
}

// 2. Search send_queue for any message to sara-ritchie URL
console.log('\n' + '─'.repeat(70));
console.log('2️⃣ SEARCHING SEND_QUEUE FOR SARA...');

const { data: queueItems } = await supabase
  .from('send_queue')
  .select('*, campaign_prospects(first_name, last_name, linkedin_url)')
  .or('linkedin_user_id.ilike.%sara%,linkedin_user_id.ilike.%ritchie%,linkedin_user_id.ilike.%6a24b834%');

console.log(`   Found ${queueItems?.length || 0} queue items`);

for (const q of queueItems || []) {
  console.log(`   - ${q.linkedin_user_id} | ${q.status}`);
}

// 3. Search campaign_messages for any message to Sara
console.log('\n' + '─'.repeat(70));
console.log('3️⃣ SEARCHING CAMPAIGN_MESSAGES FOR SARA...');

const { data: messages } = await supabase
  .from('campaign_messages')
  .select('*')
  .or('recipient_name.ilike.%sara%,recipient_name.ilike.%ritchie%,recipient_linkedin_profile.ilike.%sara-ritchie%');

console.log(`   Found ${messages?.length || 0} messages`);

for (const m of messages || []) {
  console.log(`   - To: ${m.recipient_name} | ${m.recipient_linkedin_profile}`);
  console.log(`     Sent: ${m.sent_at}`);
}

// 4. Search linkedin_messages
console.log('\n' + '─'.repeat(70));
console.log('4️⃣ SEARCHING LINKEDIN_MESSAGES FOR SARA...');

const { data: linkedinMsgs } = await supabase
  .from('linkedin_messages')
  .select('*')
  .or('recipient_name.ilike.%sara%,sender_name.ilike.%sara%,recipient_linkedin_url.ilike.%sara-ritchie%');

console.log(`   Found ${linkedinMsgs?.length || 0} messages`);

for (const m of linkedinMsgs || []) {
  console.log(`   - ${m.direction}: ${m.recipient_name || m.sender_name}`);
  console.log(`     Content: ${m.content?.slice(0, 50)}...`);
}

// 5. Check prospect_approval_data (raw CSV uploads)
console.log('\n' + '─'.repeat(70));
console.log('5️⃣ SEARCHING PROSPECT_APPROVAL_DATA (RAW CSV)...');

const { data: approvalData } = await supabase
  .from('prospect_approval_data')
  .select('*')
  .or('first_name.ilike.%sara%,last_name.ilike.%ritchie%,linkedin_url.ilike.%sara-ritchie%');

console.log(`   Found ${approvalData?.length || 0} raw prospects`);

for (const p of approvalData || []) {
  console.log(`   - ${p.first_name} ${p.last_name} | ${p.status} | ${p.linkedin_url}`);
}

// 6. Check with provider ID directly
console.log('\n' + '─'.repeat(70));
console.log('6️⃣ SEARCHING BY PROVIDER ID (ACoAAAcxZNoB...)...');

const providerId = 'ACoAAAcxZNoBOO3uKSFEtKndR6hFtahdCk0Gj_Y';

const { data: byProvider } = await supabase
  .from('campaign_prospects')
  .select('*')
  .ilike('linkedin_user_id', `%${providerId.slice(0, 15)}%`);

console.log(`   Found ${byProvider?.length || 0} by provider ID prefix`);

// 7. Check what linkedin_user_ids look like in Charissa's campaigns
console.log('\n' + '─'.repeat(70));
console.log('7️⃣ SAMPLE LINKEDIN_USER_IDS IN CHARISSA\'S CAMPAIGNS...');

const { data: charissaSamples } = await supabase
  .from('campaign_prospects')
  .select('first_name, last_name, linkedin_user_id, linkedin_url')
  .eq('workspace_id', '7f0341da-88db-476b-ae0a-fc0da5b70861')
  .not('linkedin_user_id', 'is', null)
  .limit(10);

for (const p of charissaSamples || []) {
  console.log(`   - ${p.first_name} ${p.last_name}`);
  console.log(`     linkedin_user_id: ${p.linkedin_user_id}`);
  console.log(`     linkedin_url: ${p.linkedin_url}`);
}

console.log('\n' + '='.repeat(70));
