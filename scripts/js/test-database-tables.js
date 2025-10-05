#!/usr/bin/env node
/**
 * Test Database Tables Script
 * Verifies all recently created tables exist in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTable(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return { table: tableName, exists: false, error: 'Table does not exist' };
      }
      return { table: tableName, exists: false, error: error.message };
    }

    return { table: tableName, exists: true, rowCount: data ? data.length : 0 };
  } catch (err) {
    return { table: tableName, exists: false, error: err.message };
  }
}

async function testAllTables() {
  console.log('🔍 Testing Database Tables...\n');

  const tablesToTest = [
    // Billing tables
    'tenants',
    'tenant_subscriptions',
    'tenant_invoices',
    'stripe_products',
    'stripe_prices',
    'workspace_tier_mapping',

    // CRM tables
    'crm_connections',
    'crm_field_mappings',
    'crm_sync_logs',

    // Auth tables
    'magic_link_tokens',

    // Existing core tables (sanity check)
    'workspaces',
    'workspace_members',
    'users'
  ];

  const results = await Promise.all(tablesToTest.map(checkTable));

  // Group results
  const existing = results.filter(r => r.exists);
  const missing = results.filter(r => !r.exists);

  console.log('✅ EXISTING TABLES:');
  existing.forEach(r => {
    console.log(`   ✓ ${r.table} (${r.rowCount} sample rows)`);
  });

  if (missing.length > 0) {
    console.log('\n❌ MISSING TABLES:');
    missing.forEach(r => {
      console.log(`   ✗ ${r.table} - ${r.error}`);
    });
  }

  console.log(`\n📊 Summary: ${existing.length}/${tablesToTest.length} tables exist`);

  if (missing.length > 0) {
    console.log('\n⚠️  ACTION REQUIRED: Some tables are missing. Run migrations:');
    missing.forEach(r => {
      if (r.table.startsWith('tenant') || r.table.includes('stripe')) {
        console.log('   - supabase/migrations/20251005000002_create_3cubed_billing.sql');
      } else if (r.table.startsWith('crm_')) {
        console.log('   - supabase/migrations/20251005000004_create_crm_integration_tables.sql');
      } else if (r.table === 'magic_link_tokens') {
        console.log('   - supabase/migrations/20251005000001_create_magic_link_tokens.sql');
      }
    });
  }

  return { total: tablesToTest.length, existing: existing.length, missing: missing.length };
}

// Run test
testAllTables()
  .then(stats => {
    process.exit(stats.missing > 0 ? 1 : 0);
  })
  .catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
