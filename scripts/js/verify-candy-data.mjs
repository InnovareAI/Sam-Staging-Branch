#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyData() {
  try {
    console.log('🔍 Checking database for Candy Alexander in campaign_prospects table...\n');

    const { data, error } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, title, company_name, updated_at, linkedin_url')
      .eq('campaign_id', '0a56408b-be39-4144-870f-2b0dce45b620')
      .ilike('first_name', '%Candy%')
      .single();

    if (error) {
      console.log('❌ Error:', error.message);
      return;
    }

    console.log('✅ Found in campaign_prospects table:');
    console.log('  ID:', data.id);
    console.log('  Name:', data.first_name, data.last_name);
    console.log('  title field:', JSON.stringify(data.title));
    console.log('  company_name field:', JSON.stringify(data.company_name));
    console.log('  linkedin_url field:', JSON.stringify(data.linkedin_url));
    console.log('  updated_at:', data.updated_at);
    console.log('\nFull record:');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

verifyData();
