#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 INVESTIGATING SARA RITCHIE REPLY');
console.log('='.repeat(70));

// 1. Find Sara Ritchie prospect
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select(`
    *,
    campaigns!inner (
      name,
      workspace_id,
      linkedin_account_id,
      workspace_accounts!linkedin_account_id (
        unipile_account_id,
        account_name
      )
    )
  `)
  .ilike('first_name', '%sara%')
  .ilike('last_name', '%ritchie%');

console.log('\n1️⃣ PROSPECT SEARCH:');
console.log(`   Found ${prospects?.length || 0} prospects matching "Sara Ritchie"`);

for (const p of prospects || []) {
  console.log(`\n   👤 ${p.first_name} ${p.last_name}`);
  console.log(`      ID: ${p.id}`);
  console.log(`      Status: ${p.status}`);
  console.log(`      Campaign: ${p.campaigns?.name}`);
  console.log(`      Workspace: ${p.campaigns?.workspace_id}`);
  console.log(`      LinkedIn URL: ${p.linkedin_url}`);
  console.log(`      LinkedIn User ID: ${p.linkedin_user_id}`);
  console.log(`      Responded At: ${p.responded_at || 'NOT SET'}`);
  console.log(`      Updated At: ${p.updated_at}`);

  // Check for reply_agent_drafts
  const { data: drafts } = await supabase
    .from('reply_agent_drafts')
    .select('*')
    .eq('prospect_id', p.id);

  console.log(`\n   📝 Reply Agent Drafts: ${drafts?.length || 0}`);
  for (const d of drafts || []) {
    console.log(`      - Status: ${d.status}`);
    console.log(`        Inbound: "${d.inbound_message_text?.slice(0, 80)}..."`);
  }

  // Check linkedin_messages
  const { data: messages } = await supabase
    .from('linkedin_messages')
    .select('*')
    .eq('prospect_id', p.id)
    .order('sent_at', { ascending: false });

  console.log(`\n   💬 LinkedIn Messages: ${messages?.length || 0}`);
  for (const m of messages || []) {
    console.log(`      - ${m.direction}: "${m.content?.slice(0, 60)}..." (${m.sent_at})`);
  }
}

// 2. Check Charissa's workspace for any Sara
const { data: charissaWs } = await supabase
  .from('workspaces')
  .select('id')
  .eq('name', 'Charissa Saniel')
  .single();

if (charissaWs) {
  console.log('\n' + '─'.repeat(70));
  console.log('2️⃣ ALL "SARA" PROSPECTS IN CHARISSA\'S WORKSPACE:');

  const { data: saras } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status, responded_at, linkedin_user_id')
    .eq('workspace_id', charissaWs.id)
    .ilike('first_name', '%sara%');

  for (const s of saras || []) {
    console.log(`   - ${s.first_name} ${s.last_name}: ${s.status} (responded: ${s.responded_at || 'NO'})`);
  }

  // 3. Check Charissa's LinkedIn account for recent messages
  console.log('\n' + '─'.repeat(70));
  console.log('3️⃣ CHARISSA\'S LINKEDIN ACCOUNT:');

  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', charissaWs.id)
    .eq('account_type', 'linkedin');

  for (const acc of accounts || []) {
    console.log(`   Account: ${acc.account_name}`);
    console.log(`   Unipile ID: ${acc.unipile_account_id}`);
    console.log(`   Status: ${acc.connection_status}`);
  }
}

console.log('\n' + '='.repeat(70));
