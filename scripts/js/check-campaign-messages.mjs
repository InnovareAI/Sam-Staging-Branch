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
  .ilike('name', '%test 9%')
  .single();

console.log('📋 Campaign: ' + campaign.name + '\n');
console.log('Messages configured:');
console.log('  connection_message:', campaign.connection_message ? '✅ YES' : '❌ NO');
console.log('  alternative_message:', campaign.alternative_message ? '✅ YES' : '❌ NO');
console.log('  message_templates:', campaign.message_templates ? '✅ YES' : '❌ NO');
console.log('  follow_up_messages:', campaign.follow_up_messages?.length || 0);

if (!campaign.connection_message && !campaign.message_templates?.connection_request) {
  console.log('\n❌ NO CONNECTION MESSAGE CONFIGURED!');
  console.log('This is why execution fails.\n');
  console.log('Solution: Create campaign through Campaign Hub with messages.');
}
