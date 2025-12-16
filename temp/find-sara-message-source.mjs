#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHARISSA_WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861';
const SARA_PROVIDER_ID = 'ACoAAAcxZNoBOO3uKSFEtKndR6hFtahdCk0Gj_Y';

console.log('🔍 DEEP SEARCH FOR SARA RITCHIE EVIDENCE');
console.log('='.repeat(70));

// 1. Search ALL prospects that were ever created in Charissa's workspace
console.log('\n1️⃣ Total prospects ever in Charissa workspace...');
const { count: totalProspects } = await supabase
  .from('campaign_prospects')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', CHARISSA_WORKSPACE_ID);

console.log(`   Total prospects: ${totalProspects}`);

// 2. Check send_queue for Sara's provider_id
console.log('\n2️⃣ Checking send_queue for Sara\'s provider_id...');
const { data: queueBySara } = await supabase
  .from('send_queue')
  .select('*')
  .ilike('linkedin_user_id', `%${SARA_PROVIDER_ID}%`);

console.log(`   Found in send_queue: ${queueBySara?.length || 0}`);

// 3. Check if provider_id was ever stored for any prospect
console.log('\n3️⃣ Checking if Sara\'s provider_id exists in any prospect...');
const { data: prospectsByProviderId } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, linkedin_user_id')
  .eq('linkedin_user_id', SARA_PROVIDER_ID);

console.log(`   Prospects with Sara's provider_id: ${prospectsByProviderId?.length || 0}`);

// 4. Check unipile_messages for any messages to Sara
console.log('\n4️⃣ Checking unipile_messages table...');
const { data: unipileMsgs } = await supabase
  .from('unipile_messages')
  .select('*')
  .or(`recipient_provider_id.eq.${SARA_PROVIDER_ID},recipient_linkedin_url.ilike.%sara-ritchie%`);

console.log(`   Messages to Sara: ${unipileMsgs?.length || 0}`);

// 5. Check if message matches any existing prospect messages
console.log('\n5️⃣ Checking sent messages with similar text...');
const { data: similarMessages } = await supabase
  .from('send_queue')
  .select('id, message, prospect_id, campaign_id, status, sent_at, linkedin_user_id')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .ilike('message', '%InnovareAI%')
  .ilike('message', '%workflow automation%')
  .limit(10);

console.log(`   Messages with "InnovareAI" and "workflow automation": ${similarMessages?.length || 0}`);
for (const m of similarMessages || []) {
  // Get prospect name
  const { data: prospect } = await supabase
    .from('campaign_prospects')
    .select('first_name, last_name')
    .eq('id', m.prospect_id)
    .single();
  
  console.log(`\n   Prospect: ${prospect?.first_name || 'UNKNOWN'} ${prospect?.last_name || ''}`);
  console.log(`   Provider ID: ${m.linkedin_user_id}`);
  console.log(`   Status: ${m.status} | Sent: ${m.sent_at}`);
  console.log(`   Message: ${m.message?.slice(0, 100)}...`);
}

// 6. Check campaign stats around Dec 2
console.log('\n6️⃣ Campaign "IA- Canada- Startup 5" prospects...');
const { data: startup5 } = await supabase
  .from('campaigns')
  .select('id')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .ilike('name', '%Startup 5%')
  .single();

if (startup5) {
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('first_name, last_name, linkedin_url, linkedin_user_id, status')
    .eq('campaign_id', startup5.id);
  
  console.log(`   Found ${prospects?.length || 0} prospects:`);
  for (const p of prospects || []) {
    console.log(`   - ${p.first_name} ${p.last_name} | ${p.status} | ${p.linkedin_url}`);
  }
}

// 7. Check if prospect was deleted (using audit log if exists)
console.log('\n7️⃣ Checking for audit/activity logs about deletions...');
const { data: auditLogs } = await supabase
  .from('system_activity_log')
  .select('*')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .or('action_type.ilike.%delete%,action_type.ilike.%remove%')
  .order('created_at', { ascending: false })
  .limit(20);

console.log(`   Recent delete/remove activities: ${auditLogs?.length || 0}`);
for (const log of auditLogs || []) {
  console.log(`   - ${log.action_type}: ${JSON.stringify(log.details).slice(0, 100)}`);
}

console.log('\n' + '='.repeat(70));
