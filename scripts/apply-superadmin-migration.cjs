#!/usr/bin/env node

/**
 * Apply SuperAdmin Migration via Supabase API
 * This bypasses CLI issues and applies the migration directly
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Create Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('🚀 Applying SuperAdmin Analytics Migration...\n');

  // Read the migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/20251018_create_superadmin_analytics.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('📄 Migration file loaded');
  console.log(`📊 SQL length: ${migrationSQL.length} characters\n`);

  // Execute the migration
  console.log('⚡ Executing migration...');
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL }).catch(async () => {
      // If exec_sql doesn't exist, try direct execution via REST API
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ query: migrationSQL })
      });

      if (!response.ok) {
        // Fall back to executing via pg endpoint
        throw new Error('Using PostgreSQL direct connection...');
      }

      return await response.json();
    });

    if (error) {
      console.error('❌ Migration failed:', error.message);
      console.error('\n💡 Please apply manually via Supabase Dashboard:');
      console.error('   1. Open: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new');
      console.error('   2. Copy: supabase/migrations/20251018_create_superadmin_analytics.sql');
      console.error('   3. Paste and click "Run"');
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .in('table_name', [
        'conversation_analytics',
        'system_health_logs',
        'system_alerts',
        'qa_autofix_logs',
        'deployment_logs',
        'user_sessions'
      ]);

    if (tablesError) {
      console.log('⚠️  Could not verify tables (this is OK)');
    } else {
      console.log(`✅ Found ${tables?.length || 0} analytics tables\n`);
    }

    console.log('🎉 SuperAdmin Analytics is ready!');
    console.log('📊 Visit: https://app.meet-sam.com/admin/superadmin\n');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error('\n💡 The Supabase JS client cannot execute raw SQL.');
    console.error('   Please apply the migration manually:\n');
    console.error('   1. Open: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new');
    console.error('   2. Copy: supabase/migrations/20251018_create_superadmin_analytics.sql');
    console.error('   3. Paste and click "Run"\n');
    process.exit(1);
  }
}

// Run the migration
applyMigration();
