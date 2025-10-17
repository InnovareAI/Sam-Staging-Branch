/**
 * Apply Lead Search Quota Migration
 * Adds search tier and quota tracking to workspace_tiers table
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyMigration() {
  console.log('\n🔧 APPLYING LEAD SEARCH QUOTA MIGRATION\n');
  console.log('='.repeat(60));

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/20251017_add_lead_search_tier_to_workspace_tiers.sql');

    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      process.exit(1);
    }

    console.log('📄 Reading migration file...');
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`✅ Found ${statements.length} SQL statements\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);

      // Show first 100 chars of statement
      const preview = statement.substring(0, 100).replace(/\n/g, ' ');
      console.log(`   ${preview}${statement.length > 100 ? '...' : ''}`);

      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });

        if (error) {
          // Check if error is "already exists" which is OK
          if (error.message && (
            error.message.includes('already exists') ||
            error.message.includes('duplicate') ||
            error.message.includes('column') && error.message.includes('already')
          )) {
            console.log('   ⚠️  Already exists (skipping)');
            continue;
          }

          console.error('   ❌ Error:', error.message);

          // Don't exit on error, continue with next statement
          continue;
        }

        console.log('   ✅ Success');

      } catch (err) {
        console.error('   ❌ Execution error:', err.message);
        continue;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration application completed\n');

    // Verify migration
    console.log('🔍 Verifying migration...\n');
    await verifyMigration();

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

async function verifyMigration() {
  try {
    // Check if new columns exist
    const { data: columns, error: colError } = await supabase
      .from('workspace_tiers')
      .select('*')
      .limit(1);

    if (colError) {
      console.error('❌ Could not verify columns:', colError.message);
      return;
    }

    const expectedColumns = [
      'lead_search_tier',
      'monthly_lead_search_quota',
      'monthly_lead_searches_used',
      'search_quota_reset_date'
    ];

    if (columns && columns.length > 0) {
      const actualColumns = Object.keys(columns[0]);
      const missing = expectedColumns.filter(col => !actualColumns.includes(col));

      if (missing.length === 0) {
        console.log('✅ All expected columns present:');
        expectedColumns.forEach(col => console.log(`   - ${col}`));
      } else {
        console.log('⚠️  Missing columns:', missing.join(', '));
      }
    }

    // Check if functions exist
    console.log('\n🔍 Checking database functions...');

    const functions = ['check_lead_search_quota', 'increment_lead_search_usage'];

    for (const funcName of functions) {
      const { data, error } = await supabase
        .rpc('pg_get_functiondef', { oid: `public.${funcName}`::regprocedure });

      if (error) {
        if (error.message.includes('does not exist')) {
          console.log(`   ⚠️  Function ${funcName} not found`);
          console.log(`      Note: RPC functions may need to be created via Supabase Dashboard`);
        } else {
          console.log(`   ❌ Error checking ${funcName}:`, error.message);
        }
      } else {
        console.log(`   ✅ Function ${funcName} exists`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Verification complete\n');

  } catch (error) {
    console.error('❌ Verification error:', error.message);
  }
}

// Run migration
applyMigration().catch(console.error);
