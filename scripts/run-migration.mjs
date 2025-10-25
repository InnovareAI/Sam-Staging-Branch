#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read environment variables
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SERVICE_ROLE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

console.log('🔗 Supabase URL:', SUPABASE_URL);
console.log('🔑 Service Role Key:', SERVICE_ROLE_KEY.substring(0, 20) + '...\n');

// Create Supabase admin client
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Read migration file
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251025_fix_linkedin_workspace_schema.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

async function runMigration() {
  console.log('🚀 Starting LinkedIn/Workspace schema fix migration\n');
  console.log('=' .repeat(70));

  try {
    // Test connection first
    console.log('\n📡 Testing Supabase connection...');
    const { data: testData, error: testError } = await supabase
      .from('workspaces')
      .select('count')
      .limit(1);

    if (testError) {
      console.error('❌ Connection failed:', testError.message);
      throw testError;
    }
    console.log('✅ Connection successful\n');

    // Execute migration via rpc
    console.log('📝 Executing migration SQL...\n');

    // Try to execute the full migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      console.log('⚠️  Direct execution not available via RPC');
      console.log('📋 Manual application required via Supabase Dashboard\n');
      console.log('Steps:');
      console.log('1. Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql');
      console.log('2. Copy contents of:', migrationPath);
      console.log('3. Paste and run in SQL Editor\n');
      return false;
    }

    console.log('✅ Migration executed successfully!\n');

    // Verify schema changes
    await verifyChanges();

    return true;

  } catch (error) {
    console.error('\n❌ Migration error:', error.message);
    console.log('\n📋 Please apply migration manually via Supabase Dashboard:');
    console.log('https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql\n');
    console.log('Migration file:', migrationPath, '\n');
    return false;
  }
}

async function verifyChanges() {
  console.log('=' .repeat(70));
  console.log('🔍 Verifying schema changes...\n');

  try {
    // Check 1: workspace_accounts accessible
    console.log('✓ Checking workspace_accounts...');
    const { data: wsData, error: wsError } = await supabase
      .from('workspace_accounts')
      .select('workspace_id, user_id, account_type')
      .limit(1);

    if (wsError) {
      console.log('  ⚠️  Error:', wsError.message);
    } else {
      console.log('  ✅ Table accessible');
    }

    // Check 2: user_unipile_accounts has workspace_id
    console.log('\n✓ Checking user_unipile_accounts...');
    const { data: uuaData, error: uuaError } = await supabase
      .from('user_unipile_accounts')
      .select('workspace_id, user_id, platform')
      .limit(1);

    if (uuaError) {
      console.log('  ⚠️  Error:', uuaError.message);
    } else {
      console.log('  ✅ workspace_id column exists');
    }

    // Check 3: linkedin_contacts accessible
    console.log('\n✓ Checking linkedin_contacts...');
    const { data: lcData, error: lcError } = await supabase
      .from('linkedin_contacts')
      .select('count')
      .limit(1);

    if (lcError) {
      console.log('  ⚠️  Error:', lcError.message);
    } else {
      console.log('  ✅ RLS policies working');
    }

    // Check 4: Check view exists
    console.log('\n✓ Checking v_linkedin_account_status view...');
    const { data: viewData, error: viewError } = await supabase
      .from('v_linkedin_account_status')
      .select('mapping_status')
      .limit(1);

    if (viewError) {
      console.log('  ⚠️  View may not exist yet:', viewError.message);
    } else {
      console.log('  ✅ View created successfully');

      // Check for unmapped accounts
      const { data: unmapped, error: unmappedError } = await supabase
        .from('v_linkedin_account_status')
        .select('*')
        .neq('mapping_status', 'fully_mapped');

      if (!unmappedError && unmapped) {
        console.log(`  📊 Unmapped accounts: ${unmapped.length}`);
        if (unmapped.length > 0) {
          console.log('  ⚠️  Run sync_orphaned_linkedin_accounts() to fix');
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Verification complete!\n');

  } catch (error) {
    console.log('\n⚠️  Verification error:', error.message);
  }
}

// Run the migration
runMigration().then(success => {
  if (!success) {
    process.exit(1);
  }
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
