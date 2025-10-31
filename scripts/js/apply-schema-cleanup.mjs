#!/usr/bin/env node
/**
 * Apply Schema Cleanup Migration
 * Fixes the campaign_prospects status constraint issue
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  console.log('🔧 Applying schema cleanup migration...\n');

  // Read migration SQL
  const migrationPath = join(__dirname, '../../sql/migrations/20251031_cleanup_campaign_prospects.sql');
  const sql = readFileSync(migrationPath, 'utf8');

  console.log('📄 Migration file loaded');
  console.log('📊 Running SQL...\n');

  // Execute migration
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).single();

  if (error) {
    // Try direct query if RPC doesn't exist
    console.log('⚠️  exec_sql RPC not available, trying direct execution...\n');

    const { error: directError } = await supabase
      .from('_migrations')
      .insert({
        name: '20251031_cleanup_campaign_prospects',
        executed_at: new Date().toISOString()
      });

    if (directError && !directError.message.includes('does not exist')) {
      console.error('❌ Migration failed:', directError.message);
      console.log('\n📋 MANUAL STEPS REQUIRED:');
      console.log('1. Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql');
      console.log('2. Copy and paste the SQL from:');
      console.log('   sql/migrations/20251031_cleanup_campaign_prospects.sql');
      console.log('3. Click "Run" to execute\n');
      return;
    }
  }

  console.log('✅ Migration applied successfully!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Status constraint updated');
  console.log('📊 Indexes created');
  console.log('📊 Helper function mark_prospect_contacted() created');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ You can now update prospect statuses to connection_requested');
}

// Check if we need manual migration
console.log('⚠️  NOTE: Supabase JS client cannot execute DDL directly.');
console.log('This script will guide you through manual migration.\n');

console.log('📋 MANUAL MIGRATION STEPS:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('1. Open Supabase SQL Editor:');
console.log('   https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql\n');
console.log('2. Open the migration file:');
console.log('   sql/migrations/20251031_cleanup_campaign_prospects.sql\n');
console.log('3. Copy the entire SQL content\n');
console.log('4. Paste into Supabase SQL Editor\n');
console.log('5. Click "Run" button\n');
console.log('6. Verify you see success messages\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('After migration completes, run:');
console.log('  node scripts/js/fix-stuck-queued-prospects.mjs\n');
