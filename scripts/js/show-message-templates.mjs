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
console.log('message_templates content:');
console.log(JSON.stringify(campaign.message_templates, null, 2));
