#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWorkspaceProspects() {
  try {
    console.log('🔍 Checking workspace_prospects for Candy Alexander...\n');

    const { data, error } = await supabase
      .from('workspace_prospects')
      .select('*')
      .ilike('first_name', '%Candy%')
      .limit(5);

    if (error) {
      console.log('❌ Error:', error.message);
      return;
    }

    console.log(`Found ${data.length} records:\n`);
    data.forEach(p => {
      console.log('Name:', p.first_name, p.last_name);
      console.log('Job Title:', p.title || p.job_title);
      console.log('Company:', p.company_name);
      console.log('All fields:', JSON.stringify(p, null, 2));
      console.log('');
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkWorkspaceProspects();
