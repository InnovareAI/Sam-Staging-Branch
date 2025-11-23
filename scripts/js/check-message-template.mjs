#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const { data: campaign } = await supabase
  .from('campaigns')
  .select('message_templates')
  .eq('id', '0a56408b-be39-4144-870f-2b0dce45b620')
  .single();

console.log('Campaign message templates:');
console.log(JSON.stringify(campaign.message_templates, null, 2));
