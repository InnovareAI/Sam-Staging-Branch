#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHARISSA_WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861';

console.log('🔍 CHECKING MESSENGER CAMPAIGNS FOR CHARISSA');
console.log('='.repeat(70));

// Check messenger campaigns
const { data: messengerCampaigns } = await supabase
  .from('campaigns')
  .select('*')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .eq('campaign_type', 'messenger');

console.log(`\nFound ${messengerCampaigns?.length || 0} messenger campaigns:`);

for (const c of messengerCampaigns || []) {
  console.log('\n' + '─'.repeat(70));
  console.log(`Campaign: ${c.name} (ID: ${c.id})`);
  console.log(`Status: ${c.status}`);
  console.log(`Created: ${c.created_at}`);
  console.log(`Message Templates: ${JSON.stringify(c.message_templates)}`);
  
  // Get prospects
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('first_name, last_name, linkedin_url, status')
    .eq('campaign_id', c.id);
  
  console.log(`\nProspects (${prospects?.length || 0}):`);
  for (const p of prospects || []) {
    console.log(`   - ${p.first_name} ${p.last_name} | ${p.status} | ${p.linkedin_url}`);
  }
}

// Check linkedin_messages table for any trace
console.log('\n' + '─'.repeat(70));
console.log('Checking linkedin_messages table...');

const { data: liMessages, error } = await supabase
  .from('linkedin_messages')
  .select('*')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .limit(10);

if (error) {
  console.log(`   Error: ${error.message}`);
} else {
  console.log(`   Found ${liMessages?.length || 0} messages`);
  for (const m of liMessages || []) {
    console.log(`   - To: ${m.recipient_name || m.recipient_linkedin_url}`);
  }
}

// Check campaign_messages table
console.log('\n' + '─'.repeat(70));
console.log('Checking campaign_messages table...');

const { data: campMessages } = await supabase
  .from('campaign_messages')
  .select('*')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .order('sent_at', { ascending: false })
  .limit(20);

console.log(`   Found ${campMessages?.length || 0} messages`);
for (const m of campMessages || []) {
  console.log(`   - ${m.recipient_name} | ${m.message_type} | ${m.sent_at}`);
}

console.log('\n' + '='.repeat(70));
