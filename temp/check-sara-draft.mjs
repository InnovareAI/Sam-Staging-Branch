#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SARA_DRAFT_ID = '9301679d-5c5d-48b3-9fb2-90246f1078cf';

const { data: draft } = await supabase
  .from('reply_agent_drafts')
  .select('*')
  .eq('id', SARA_DRAFT_ID)
  .single();

console.log('📨 SARA RITCHIE DRAFT');
console.log('='.repeat(70));
console.log(`\nStatus: ${draft.status}`);
console.log(`Intent: ${draft.intent_detected}`);
console.log(`\n📥 INBOUND MESSAGE:`);
console.log(`"${draft.inbound_message_text}"`);
console.log(`\n📤 AI DRAFT REPLY:`);
console.log(`"${draft.draft_text}"`);
console.log(`\n🔗 Approval Token: ${draft.approval_token}`);
console.log(`⏰ Expires: ${draft.expires_at}`);
console.log('\n' + '='.repeat(70));
