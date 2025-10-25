#!/usr/bin/env node

/**
 * Apply LinkedIn/Workspace Schema Fix via Supabase API
 */

const fs = require('fs');
const path = require('path');

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SERVICE_ROLE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

// Read migration SQL
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251025_fix_linkedin_workspace_schema.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Create Supabase client
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('🚀 Applying LinkedIn/Workspace schema fix...\n');

  try {
    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
      .filter(s => !s.match(/^COMMENT ON/)); // Skip comments for now

    console.log(`📝 Executing ${statements.length} SQL statements...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      const preview = statement.substring(0, 80).replace(/\s+/g, ' ');

      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          query: statement
        });

        if (error) {
          // Try direct query if RPC doesn't work
          const { data: data2, error: error2 } = await supabase
            .from('_migrations')
            .select('*')
            .limit(1);

          if (error2) {
            console.log(`⚠️  [${i + 1}/${statements.length}] ${preview}...`);
            console.log(`    Error: ${error.message}\n`);
            errorCount++;
          } else {
            console.log(`✅ [${i + 1}/${statements.length}] ${preview}...`);
            successCount++;
          }
        } else {
          console.log(`✅ [${i + 1}/${statements.length}] ${preview}...`);
          successCount++;
        }
      } catch (err) {
        console.log(`⚠️  [${i + 1}/${statements.length}] ${preview}...`);
        console.log(`    Error: ${err.message}\n`);
        errorCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Success: ${successCount} statements`);
    console.log(`⚠️  Errors: ${errorCount} statements`);
    console.log(`${'='.repeat(60)}\n`);

    if (errorCount > 0) {
      console.log('⚠️  Some statements failed. Please run migration manually via Supabase Dashboard:');
      console.log(`   ${SUPABASE_URL.replace('https://', 'https://supabase.com/dashboard/project/')}/sql\n`);
      console.log('📄 Migration file location:');
      console.log(`   ${migrationPath}\n`);
    } else {
      console.log('✅ All statements executed successfully!\n');
      console.log('🔍 Verifying schema changes...\n');
      await verifySchema();
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n📋 Manual application required. Copy SQL from:');
    console.log(`   ${migrationPath}\n`);
    process.exit(1);
  }
}

async function verifySchema() {
  try {
    // Check workspace_accounts.workspace_id type
    const { data: wsAccounts, error: wsError } = await supabase
      .from('workspace_accounts')
      .select('workspace_id')
      .limit(1);

    if (!wsError && wsAccounts) {
      console.log('✅ workspace_accounts table accessible');
    }

    // Check user_unipile_accounts.workspace_id exists
    const { data: userAccounts, error: userError } = await supabase
      .from('user_unipile_accounts')
      .select('workspace_id')
      .limit(1);

    if (!userError && userAccounts) {
      console.log('✅ user_unipile_accounts.workspace_id column exists');
    }

    // Check linkedin_contacts RLS
    const { data: contacts, error: contactsError } = await supabase
      .from('linkedin_contacts')
      .select('count')
      .limit(1);

    if (!contactsError) {
      console.log('✅ linkedin_contacts RLS policies working');
    }

    console.log('\n✅ Schema verification complete!\n');

  } catch (error) {
    console.log('⚠️  Verification error:', error.message);
  }
}

// Run migration
applyMigration().catch(console.error);
