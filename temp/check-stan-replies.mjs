#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKSPACE_ID = '5b81ee67-4d41-4997-b5a4-e1432e060d12';

console.log('📬 STAN BOUNEV - PROSPECT REPLIES');
console.log('='.repeat(70));

// Get the replied prospects
const { data: repliedProspects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, responded_at, linkedin_url, linkedin_user_id, company_name, title')
  .eq('workspace_id', WORKSPACE_ID)
  .eq('status', 'replied')
  .order('responded_at', { ascending: false });

console.log(`\nFound ${repliedProspects?.length || 0} replied prospects\n`);

for (const p of repliedProspects || []) {
  console.log('─'.repeat(70));
  console.log(`👤 ${p.first_name} ${p.last_name}`);
  console.log(`   Title: ${p.title || 'N/A'}`);
  console.log(`   Company: ${p.company_name || 'N/A'}`);
  console.log(`   Responded: ${p.responded_at}`);
  console.log(`   LinkedIn: ${p.linkedin_url || 'N/A'}`);

  // Check for stored messages (incoming)
  const { data: messages } = await supabase
    .from('linkedin_messages')
    .select('*')
    .eq('prospect_id', p.id)
    .eq('direction', 'incoming')
    .order('sent_at', { ascending: true });

  if (messages && messages.length > 0) {
    console.log(`\n   💬 MESSAGES FROM PROSPECT:`);
    for (const msg of messages) {
      console.log(`   ────────────────────────────────────────────────────`);
      console.log(`   📅 ${msg.sent_at}`);
      console.log(`   📝 "${msg.content}"`);
    }
  } else {
    console.log(`\n   ⚠️  No stored messages found for this prospect`);
  }

  // Also check reply_agent_drafts for any AI responses
  const { data: drafts } = await supabase
    .from('reply_agent_drafts')
    .select('*')
    .eq('prospect_id', p.id)
    .order('created_at', { ascending: true });

  if (drafts && drafts.length > 0) {
    console.log(`\n   🤖 REPLY AGENT DRAFTS:`);
    for (const draft of drafts) {
      console.log(`   ────────────────────────────────────────────────────`);
      console.log(`   Status: ${draft.status}`);
      console.log(`   Inbound: "${draft.inbound_message_text?.slice(0, 100)}..."`);
      console.log(`   Draft: "${draft.draft_text?.slice(0, 100)}..."`);
    }
  }

  console.log();
}

console.log('='.repeat(70));
