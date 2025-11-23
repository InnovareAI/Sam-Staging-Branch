#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const { data } = await supabase
  .from('campaign_prospects')
  .select('first_name, last_name, linkedin_url, provider_id')
  .eq('campaign_id', '0a56408b-be39-4144-870f-2b0dce45b620')
  .ilike('first_name', '%Candy%')
  .single();

console.log('LinkedIn URL:', data.linkedin_url);
console.log('Provider ID:', data.provider_id);
