#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHARISSA_WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861';
const PROSPECT_ID = '7849e385-0b15-43cd-8f93-a9fc3cc29340';
const CAMPAIGN_ID = 'd53a5d1a-5432-4724-9574-f795863805d5';
const SARA_LINKEDIN_URL = 'https://www.linkedin.com/in/sara-ritchie-6a24b834/';

console.log('📨 Creating reply agent draft for Sara...');

const { data: draft, error: draftError } = await supabase
  .from('reply_agent_drafts')
  .insert({
    workspace_id: CHARISSA_WORKSPACE_ID,
    prospect_id: PROSPECT_ID,
    campaign_id: CAMPAIGN_ID,
    inbound_message_text: 'I would be happy to connect. Do you have a link to book a call?',
    inbound_message_at: '2025-12-16T00:11:34.603Z',
    status: 'pending_generation',
    channel: 'linkedin',
    prospect_name: 'Sara Ritchie',
    prospect_linkedin_url: SARA_LINKEDIN_URL,
    prospect_title: 'Fractional COO for Dental Practices & Companies',
    created_at: new Date().toISOString()
  })
  .select()
  .single();

if (draftError) {
  console.log(`❌ Error creating draft: ${draftError.message}`);
} else {
  console.log(`✅ Created draft: ${draft.id}`);
  console.log(`   Status: ${draft.status}`);
}

// Also record the outbound message we sent
console.log('\n💬 Recording outbound message...');
const { error: msgError } = await supabase
  .from('campaign_messages')
  .insert({
    workspace_id: CHARISSA_WORKSPACE_ID,
    campaign_id: CAMPAIGN_ID,
    prospect_id: PROSPECT_ID,
    recipient_name: 'Sara Ritchie',
    recipient_linkedin_profile: SARA_LINKEDIN_URL,
    platform: 'linkedin',
    message_content: `Hi Sara,

I work for InnovareAI, an AI company known for its innovative workflow automation and AI agent solutions. I'm always interested in connecting with like-minded individuals who want to learn all things AI.

Would you be open to connecting?`,
    sent_at: '2025-12-02T15:16:55.919Z',
    delivery_status: 'sent',
    reply_received_at: '2025-12-16T00:11:34.603Z',
    reply_count: 1
  });

if (msgError) {
  console.log(`⚠️ Error recording message: ${msgError.message}`);
} else {
  console.log(`✅ Message history recorded`);
}

console.log('\n' + '='.repeat(70));
console.log('✅ DRAFT CREATED - Reply Agent will generate response on next cron run');
console.log('='.repeat(70));
