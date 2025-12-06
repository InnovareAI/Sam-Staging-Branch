/**
 * Migration: Add country filtering columns to LinkedIn commenting tables
 *
 * Run with: node scripts/migrations/add-country-filtering.js
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

async function runMigration() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('🔄 Running country filtering migration...\n');

  // Test connection by reading a monitor
  const { data: monitor, error: testError } = await supabase
    .from('linkedin_post_monitors')
    .select('id')
    .limit(1);

  if (testError) {
    console.error('❌ Connection test failed:', testError);
    return;
  }
  console.log('✅ Connected to Supabase');

  // Try to insert/update with the new columns to see if they exist
  // If they don't exist, we'll get an error, if they do, it will just be a no-op

  // Test 1: Check if target_countries column exists on monitors
  console.log('\n📊 Checking linkedin_post_monitors.target_countries...');
  const { data: monitorTest, error: monitorError } = await supabase
    .from('linkedin_post_monitors')
    .select('id, target_countries')
    .limit(1);

  if (monitorError && monitorError.message.includes('target_countries')) {
    console.log('   ❌ Column does not exist - needs migration');
  } else {
    console.log('   ✅ Column exists or no error');
  }

  // Test 2: Check if author_country column exists on discovered posts
  console.log('\n📊 Checking linkedin_posts_discovered.author_country...');
  const { data: postTest, error: postError } = await supabase
    .from('linkedin_posts_discovered')
    .select('id, author_country')
    .limit(1);

  if (postError && postError.message.includes('author_country')) {
    console.log('   ❌ Column does not exist - needs migration');
  } else {
    console.log('   ✅ Column exists or no error');
  }

  console.log('\n📋 Migration SQL (run in Supabase SQL Editor):');
  console.log('--------------------------------------------');
  console.log(`
-- Add target_countries to monitors (NULL means all countries)
ALTER TABLE linkedin_post_monitors
  ADD COLUMN IF NOT EXISTS target_countries TEXT[] DEFAULT NULL;

-- Add author_country to discovered posts
ALTER TABLE linkedin_posts_discovered
  ADD COLUMN IF NOT EXISTS author_country TEXT DEFAULT NULL;

-- Comments
COMMENT ON COLUMN linkedin_post_monitors.target_countries IS
  'Array of country names to filter posts by (NULL = all countries). E.g. ["United States", "United Kingdom", "Australia"]';
COMMENT ON COLUMN linkedin_posts_discovered.author_country IS
  'Country of the post author (from LinkedIn profile location)';
`);
  console.log('--------------------------------------------');

  console.log('\n✅ Migration script completed');
  console.log('   Run the SQL above in Supabase Dashboard > SQL Editor');
}

runMigration().catch(console.error);
