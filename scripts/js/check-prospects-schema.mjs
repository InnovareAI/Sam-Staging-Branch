#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('\n📋 CAMPAIGN_PROSPECTS TABLE SCHEMA\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const { data, error } = await supabase
    .from('campaign_prospects')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log('Columns in campaign_prospects table:\n');
    Object.keys(data[0]).forEach((col, i) => {
      console.log(`   ${i + 1}. ${col}`);
    });
  } else {
    console.log('No data found. Checking via RPC...');
    
    // Alternative: Get columns via database introspection
    const { data: columns } = await supabase.rpc('get_table_columns', {
      table_name: 'campaign_prospects'
    }).single();
    
    if (columns) {
      console.log('Columns:', columns);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

checkSchema();
