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

console.log('Campaign Name:', campaign.name);
console.log('\nMessage Fields:');
console.log('connection_message:', campaign.connection_message);
console.log('alternative_message:', campaign.alternative_message);
console.log('message_templates:', JSON.stringify(campaign.message_templates, null, 2));
console.log('\nFull Campaign Object:');
console.log(JSON.stringify(campaign, null, 2));
