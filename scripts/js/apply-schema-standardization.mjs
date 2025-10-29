#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { readFileSync } from 'fs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔧 Applying Schema Standardization Migration\n');
console.log('This will rename columns in workspace_prospects to match campaign_prospects');
console.log('Ensuring ONE consistent naming convention across ALL workspaces\n');

// Read the migration SQL
const migrationSQL = readFileSync('./sql/standardize-prospect-schema.sql', 'utf8');

console.log('📋 Migration steps:');
console.log('  1. Rename linkedin_profile_url → linkedin_url');
console.log('  2. Rename email_address → email');
console.log('  3. Rename job_title → title');
console.log('  4. Update indexes and constraints');
console.log('  5. Update database functions\n');

console.log('⚠️  This migration will affect ALL workspaces!\n');

// Check current schema before migration
console.log('📊 Current workspace_prospects schema:');
const { data: beforeColumns } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'workspace_prospects'
      AND column_name IN ('linkedin_url', 'linkedin_profile_url', 'email', 'email_address', 'title', 'job_title')
    ORDER BY column_name;
  `
});

if (beforeColumns) {
  beforeColumns.forEach(col => {
    console.log(`   ${col.column_name}: ${col.data_type}`);
  });
} else {
  // Try direct query if RPC doesn't work
  console.log('   Using Supabase admin to check schema...');
}

console.log('\n🚀 Applying migration...\n');

try {
  // Execute migration SQL
  // Note: This needs to be run directly in Supabase SQL editor
  // since Supabase client doesn't support DDL commands

  console.log('❌ Cannot execute DDL via Supabase client');
  console.log('\n✅ NEXT STEPS:');
  console.log('   1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new');
  console.log('   2. Copy the contents of: sql/standardize-prospect-schema.sql');
  console.log('   3. Paste into SQL editor');
  console.log('   4. Click "Run"');
  console.log('   5. Verify changes with: node scripts/js/verify-schema-standardization.mjs');
  console.log('\n📄 Migration file location:');
  console.log('   /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/sql/standardize-prospect-schema.sql');

} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}
