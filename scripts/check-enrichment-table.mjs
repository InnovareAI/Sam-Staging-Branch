#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
  console.log('🔍 Checking enrichment_jobs table...\n');

  // Check if table exists by trying to select from it
  const { data, error } = await supabase
    .from('enrichment_jobs')
    .select('count')
    .limit(1);

  if (error) {
    console.error('❌ Table check failed:', error.message);
    console.error('Details:', error);
    return;
  }

  console.log('✅ Table exists!');

  // Try to get table info
  const { data: jobs, error: jobsError } = await supabase
    .from('enrichment_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (jobsError) {
    console.error('❌ Query failed:', jobsError);
  } else {
    console.log(`\n📊 Recent jobs: ${jobs?.length || 0}`);
    if (jobs && jobs.length > 0) {
      jobs.forEach(job => {
        console.log(`  - ${job.id}: ${job.status} (${job.total_prospects} prospects)`);
      });
    }
  }
}

checkTable();
