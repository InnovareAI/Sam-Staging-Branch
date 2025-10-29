#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: campaign } = await supabase
  .from('campaigns')
  .select('*')
  .eq('id', '8ba7f767-42a9-4c44-808a-b244e9afdd32')
  .single();

console.log('📋 Campaign Follow-Up Configuration\n');
console.log('Campaign:', campaign.name);
console.log('Current Step:', campaign.current_step);
console.log();

console.log('Follow-Up Messages:');
if (campaign.message_templates?.follow_up_messages) {
  campaign.message_templates.follow_up_messages.forEach((msg, i) => {
    console.log(`\n${i + 1}. ${msg.substring(0, 100)}...`);
  });
  console.log(`\nTotal follow-ups defined: ${campaign.message_templates.follow_up_messages.length}`);
} else {
  console.log('  None configured');
}

console.log('\n\n📊 Prospect Status Distribution:\n');

const { data: statusCounts } = await supabase
  .from('campaign_prospects')
  .select('status')
  .eq('campaign_id', campaign.id);

const counts = {};
statusCounts?.forEach(p => {
  counts[p.status] = (counts[p.status] || 0) + 1;
});

Object.entries(counts).forEach(([status, count]) => {
  console.log(`  ${status}: ${count}`);
});

console.log('\n\n🤔 Follow-Up Triggers:\n');
console.log('When does follow-up happen?');
console.log('  1. Connection accepted → status: "connected"');
console.log('  2. Then what? Checking for automation...\n');
