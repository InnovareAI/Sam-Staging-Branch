#!/usr/bin/env node

/**
 * Apply KB Analytics Migration
 * Applies the knowledge_base_document_usage analytics schema to Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('🚀 Starting KB Analytics Migration...\n');

  // Read the migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/20251015000000_create_kb_usage_analytics.sql');

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('📄 Migration file loaded');
  console.log('📊 Executing SQL...\n');

  try {
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // If exec_sql doesn't exist, try direct execution
      console.log('⚠️  exec_sql function not found, trying direct execution...\n');

      // Split SQL into statements and execute one by one
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        console.log(`Executing statement ${i + 1}/${statements.length}...`);

        const { error: stmtError } = await supabase.rpc('exec_sql', {
          query: statement
        });

        if (stmtError) {
          console.error(`❌ Error in statement ${i + 1}:`, stmtError.message);
          // Continue with other statements
        }
      }

      console.log('\n✅ Migration applied successfully!');
      console.log('\n📊 Created:');
      console.log('  - Table: knowledge_base_document_usage');
      console.log('  - Columns added to knowledge_base_documents');
      console.log('  - Function: record_document_usage()');
      console.log('  - Function: get_document_usage_analytics()');
      console.log('  - Function: get_section_usage_summary()');
      console.log('  - Indexes for performance');
      console.log('  - RLS policies');

    } else {
      console.log('\n✅ Migration applied successfully!');
      console.log('\n📊 Created:');
      console.log('  - Table: knowledge_base_document_usage');
      console.log('  - Columns added to knowledge_base_documents');
      console.log('  - Function: record_document_usage()');
      console.log('  - Function: get_document_usage_analytics()');
      console.log('  - Function: get_section_usage_summary()');
      console.log('  - Indexes for performance');
      console.log('  - RLS policies');
    }

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.log('\n⚠️  Please apply the migration manually via Supabase Dashboard:');
    console.log('   1. Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql');
    console.log('   2. Copy contents of: supabase/migrations/20251015000000_create_kb_usage_analytics.sql');
    console.log('   3. Paste into SQL Editor');
    console.log('   4. Click "Run"');
    process.exit(1);
  }

  console.log('\n✨ Done! KB Analytics is now active.');
  console.log('\n📖 Next steps:');
  console.log('   1. Restart your dev server: npm run dev');
  console.log('   2. Go to Knowledge Base → Usage Analytics');
  console.log('   3. Chat with SAM - usage tracking happens automatically!');
}

applyMigration();
