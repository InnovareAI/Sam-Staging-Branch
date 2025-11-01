#!/usr/bin/env node

/**
 * Check if enrichment_jobs table exists in production database
 */

import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Checking if enrichment_jobs table exists...\n');

try {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/enrichment_jobs?limit=0`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'count=exact'
      }
    }
  );

  console.log(`Response status: ${response.status}`);

  if (response.status === 200) {
    const countHeader = response.headers.get('content-range');
    console.log('✅ Table exists!');
    console.log(`   Total rows: ${countHeader || '0'}`);
    console.log('\n🎉 Database is ready for enrichment!');
  } else if (response.status === 404 || response.status === 406) {
    console.error('❌ Table does NOT exist!');
    console.error('\n🔧 You need to run the migration:');
    console.error('   1. Go to Supabase SQL Editor');
    console.error('   2. Run the SQL from: supabase/migrations/20251101000003_enrichment_job_queue.sql');
    console.error('   Or use the SQL saved at: /tmp/apply-enrichment-migration.sql');
  } else {
    const errorText = await response.text();
    console.error(`❌ Unexpected error: ${response.status}`);
    console.error(errorText);
  }
} catch (error) {
  console.error('❌ Failed to check table:', error.message);
}
