#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHARISSA_WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861';

console.log('🔍 ALL MESSAGES SENT DEC 1-3 FROM CHARISSA');
console.log('='.repeat(70));

// 1. Check campaign_messages
console.log('\n1️⃣ campaign_messages Dec 1-3...');
const { data: campMsgs } = await supabase
  .from('campaign_messages')
  .select('*')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .gte('sent_at', '2025-12-01T00:00:00Z')
  .lte('sent_at', '2025-12-03T23:59:59Z');

console.log(`   Found: ${campMsgs?.length || 0}`);
for (const m of campMsgs || []) {
  console.log(`   - ${m.recipient_name} | ${m.sent_at}`);
}

// 2. Check linkedin_messages
console.log('\n2️⃣ linkedin_messages Dec 1-3...');
const { data: liMsgs } = await supabase
  .from('linkedin_messages')
  .select('*')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .gte('sent_at', '2025-12-01T00:00:00Z')
  .lte('sent_at', '2025-12-03T23:59:59Z');

console.log(`   Found: ${liMsgs?.length || 0}`);
for (const m of liMsgs || []) {
  console.log(`   - ${m.recipient_name} | ${m.sent_at}`);
}

// 3. Check send_queue sent items
console.log('\n3️⃣ send_queue Dec 1-3 (sent items)...');
const { data: queueSent } = await supabase
  .from('send_queue')
  .select(`
    *,
    campaign_prospects!prospect_id (
      first_name, 
      last_name,
      linkedin_url
    )
  `)
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .eq('status', 'sent')
  .gte('sent_at', '2025-12-01T00:00:00Z')
  .lte('sent_at', '2025-12-03T23:59:59Z');

console.log(`   Found: ${queueSent?.length || 0}`);
for (const q of queueSent || []) {
  const prospect = q.campaign_prospects;
  console.log(`   - ${prospect?.first_name || 'UNKNOWN'} ${prospect?.last_name || ''} | ${q.sent_at}`);
  console.log(`     URL: ${prospect?.linkedin_url}`);
}

// 4. Check ALL prospects created Dec 1-3
console.log('\n4️⃣ All prospects created Dec 1-3...');
const { data: newProspects } = await supabase
  .from('campaign_prospects')
  .select('first_name, last_name, linkedin_url, status, created_at')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .gte('created_at', '2025-12-01T00:00:00Z')
  .lte('created_at', '2025-12-03T23:59:59Z');

console.log(`   Created Dec 1-3: ${newProspects?.length || 0}`);
for (const p of newProspects || []) {
  console.log(`   - ${p.first_name} ${p.last_name} | ${p.status} | ${p.linkedin_url}`);
}

// 5. Get Unipile chat history for that timeframe
console.log('\n5️⃣ Unipile outbound messages Dec 2 (around 3:16 PM)...');

const UNIPILE_BASE_URL = 'https://api6.unipile.com:13670';
const UNIPILE_API_KEY = '85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA=';
const CHARISSA_ACCOUNT_ID = '4nt1J-blSnGUPBjH2Nfjpg';

// Get chats and find ones with outbound messages around Dec 2
const chatsResponse = await fetch(
  `${UNIPILE_BASE_URL}/api/v1/chats?account_id=${CHARISSA_ACCOUNT_ID}&limit=100`,
  {
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  }
);

const chatsData = await chatsResponse.json();
const chats = chatsData.items || [];

// Check messages in each chat for Dec 2 sends
let found = 0;
for (const chat of chats) {
  const messagesResponse = await fetch(
    `${UNIPILE_BASE_URL}/api/v1/chats/${chat.id}/messages?limit=5`,
    {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    }
  );
  
  const msgData = await messagesResponse.json();
  for (const msg of msgData.items || []) {
    if (msg.is_sender === 1 && msg.timestamp) {
      const msgDate = new Date(msg.timestamp);
      if (msgDate >= new Date('2025-12-02T00:00:00Z') && 
          msgDate <= new Date('2025-12-03T00:00:00Z')) {
        found++;
        console.log(`   - To: ${chat.attendee_name || 'Unknown'}`);
        console.log(`     Time: ${msg.timestamp}`);
        console.log(`     Text: ${msg.text?.slice(0, 80)}...`);
      }
    }
  }
}

console.log(`\n   Total outbound Dec 2: ${found}`);

console.log('\n' + '='.repeat(70));
