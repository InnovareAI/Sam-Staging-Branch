#!/usr/bin/env node

/**
 * Check if approval_status column exists in prospect_approval_data table
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Checking prospect_approval_data table schema\n');

// Query information_schema to check if approval_status column exists
const { data, error } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'prospect_approval_data'
    ORDER BY ordinal_position;
  `
});

if (error) {
  console.log('⚠️  RPC not available, using alternative method...\n');

  // Try to select a record with approval_status
  const { data: testData, error: testError } = await supabase
    .from('prospect_approval_data')
    .select('approval_status')
    .limit(1);

  if (testError) {
    console.error('❌ Error checking column:', testError);
    console.log('\n🚨 The approval_status column does NOT exist!');
    console.log('\nYou need to apply the migration:');
    console.log('  supabase/migrations/20251024000001_add_approval_status_to_prospect_approval_data.sql');
    process.exit(1);
  } else {
    console.log('✅ approval_status column EXISTS!');
    console.log('Sample data:', testData);
  }
} else {
  console.log('Table columns:');
  data.forEach(col => {
    const highlight = col.column_name === 'approval_status' ? ' ✅ ' : '   ';
    console.log(`${highlight}${col.column_name} (${col.data_type})`);
  });

  const hasColumn = data.some(col => col.column_name === 'approval_status');

  if (hasColumn) {
    console.log('\n✅ approval_status column EXISTS!');
  } else {
    console.log('\n🚨 The approval_status column does NOT exist!');
    console.log('\nYou need to apply the migration:');
    console.log('  supabase/migrations/20251024000001_add_approval_status_to_prospect_approval_data.sql');
  }
}
