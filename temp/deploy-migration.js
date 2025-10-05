#!/usr/bin/env node
/**
 * Deploy prospect approval system migration to Supabase
 * Uses service role key to execute SQL directly
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Create Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deployMigration() {
  console.log('🚀 Deploying Prospect Approval System Migration...\n');

  // Read the migration file
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20251002000000_create_prospect_approval_system.sql'
  );

  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log('📄 Migration file loaded:', migrationPath);
  console.log('📏 SQL length:', sql.length, 'characters\n');

  // Execute the migration
  console.log('⏳ Executing SQL migration...');

  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sql
    });

    if (error) {
      // Try alternative: Use the SQL editor endpoint
      console.log('⚠️  RPC failed, trying direct SQL execution...');

      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ sql_query: sql })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP Error:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Migration executed successfully via REST API');
      console.log('📊 Result:', result);
    } else {
      console.log('✅ Migration executed successfully via RPC');
      console.log('📊 Result:', data);
    }

    // Verify tables were created
    console.log('\n🔍 Verifying tables...');
    await verifyTables();

    // Record migration
    console.log('\n📝 Recording migration in schema_migrations...');
    await recordMigration();

    console.log('\n✨ Deployment complete!');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

async function verifyTables() {
  const tables = [
    'prospect_approval_sessions',
    'prospect_approval_data',
    'prospect_approval_decisions',
    'prospect_learning_logs',
    'prospect_exports',
    'sam_learning_models'
  ];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(0);

    if (error) {
      console.log(`  ❌ ${table}: NOT FOUND (${error.message})`);
    } else {
      console.log(`  ✅ ${table}: EXISTS`);
    }
  }
}

async function recordMigration() {
  const { error } = await supabase
    .from('supabase_migrations.schema_migrations')
    .insert({
      version: '20251002000000',
      name: 'create_prospect_approval_system',
      executed_at: new Date().toISOString()
    });

  if (error) {
    console.log('⚠️  Could not record migration:', error.message);
    console.log('   (This is OK if already recorded)');
  } else {
    console.log('✅ Migration recorded');
  }
}

// Run deployment
deployMigration().catch(console.error);
