#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🔧 Running database migration...\n');

  const sql = fs.readFileSync('temp/add-unipile-sources-column.sql', 'utf8');

  console.log('SQL:\n', sql, '\n');

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Migration failed:', error);
      return;
    }

    console.log('✅ Migration completed successfully!');
    console.log('   Added unipile_sources column to workspace_accounts');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

runMigration().catch(console.error);
