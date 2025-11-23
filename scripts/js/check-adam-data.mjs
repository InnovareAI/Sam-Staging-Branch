#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const { data } = await supabase
  .from('campaign_prospects')
  .select('first_name, last_name, title, company_name')
  .eq('campaign_id', '0a56408b-be39-4144-870f-2b0dce45b620')
  .ilike('first_name', '%Adam%')
  .single();

console.log('Adam Steed data:');
console.log(JSON.stringify(data, null, 2));
