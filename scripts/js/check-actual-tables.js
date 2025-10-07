#!/usr/bin/env node
/**
 * Check Actual Database Tables
 * Tests if specific tables exist by querying them directly
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
    // Use a regular select (not head) to properly test if table exists
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .limit(1);

    if (error) {
      return { table: tableName, exists: false, error: error.message };
    }

    return { table: tableName, exists: true, count: count || 0 };
  } catch (err) {
    return { table: tableName, exists: false, error: err.message };
  }
}

async function main() {
  console.log('🔍 Checking Database Tables...\n');

  const tablesToCheck = [
    // Expected billing tables from verification script
    'tenants',
    'tenant_subscriptions',
    'tenant_invoices',
    'stripe_products',
    'stripe_prices',
    'workspace_tier_mapping',

    // Tables from 3cubed billing migration
    'organizations',
    'workspace_usage',
    'workspace_invoices',

    // Tables from tenant/stripe migration
    'workspace_stripe_customers',
    'workspace_subscriptions',

    // Core tables (should exist)
    'workspaces',
    'workspace_members',
    'users',

    // CRM tables
    'crm_connections',
    'crm_field_mappings',
    'crm_sync_logs'
  ];

  const results = await Promise.all(tablesToCheck.map(checkTable));

  const existing = results.filter(r => r.exists);
  const missing = results.filter(r => !r.exists);

  console.log('✅ EXISTING TABLES:\n');
  existing.forEach(r => {
    console.log(`   ✓ ${r.table} (${r.count} rows)`);
  });

  console.log('\n❌ MISSING TABLES:\n');
  missing.forEach(r => {
    console.log(`   ✗ ${r.table}`);
  });

  console.log(`\n📊 Summary: ${existing.length}/${tablesToCheck.length} tables exist\n`);

  // Analysis
  console.log('📋 ANALYSIS:\n');

  const has3cubedTables = ['organizations', 'workspace_usage', 'workspace_invoices']
    .every(t => existing.some(r => r.table === t));

  const hasTenantTables = ['workspace_stripe_customers', 'workspace_subscriptions']
    .every(t => existing.some(r => r.table === t));

  const hasStripeTables = ['stripe_products', 'stripe_prices']
    .every(t => existing.some(r => r.table === t));

  const hasOldBillingTables = ['tenants', 'tenant_subscriptions', 'tenant_invoices']
    .every(t => existing.some(r => r.table === t));

  console.log(`3cubed Billing Tables (organizations, workspace_usage, workspace_invoices): ${has3cubedTables ? '✅' : '❌'}`);
  console.log(`Tenant/Stripe Tables (workspace_stripe_customers, workspace_subscriptions): ${hasTenantTables ? '✅' : '❌'}`);
  console.log(`Stripe Product Tables (stripe_products, stripe_prices): ${hasStripeTables ? '✅' : '❌'}`);
  console.log(`Old Billing Tables (tenants, tenant_subscriptions, tenant_invoices): ${hasOldBillingTables ? '✅' : '❌'}`);

  console.log('\n💡 CONCLUSION:\n');

  if (has3cubedTables && hasTenantTables) {
    console.log('✅ Both billing migration schemas are present');
    if (!hasStripeTables) {
      console.log('⚠️  However, stripe_products and stripe_prices tables are MISSING');
      console.log('   These tables need to be created via a new migration');
    }
  } else if (has3cubedTables) {
    console.log('⚠️  Only 3cubed billing tables exist (organizations model)');
    console.log('   Tenant/Stripe tables are missing - run migration 20251006000000');
  } else if (hasTenantTables) {
    console.log('⚠️  Only tenant/Stripe tables exist (workspace subscription model)');
    console.log('   3cubed billing tables are missing - run migration 20251005000002');
  } else {
    console.log('❌ NO billing tables exist - migrations have not been applied');
    console.log('   Run both migrations:');
    console.log('   1. 20251005000002_create_3cubed_billing.sql');
    console.log('   2. 20251006000000_add_tenant_and_stripe_tables.sql');
  }

  if (!hasStripeTables && !hasOldBillingTables) {
    console.log('\n❌ CRITICAL: stripe_products and stripe_prices tables do NOT exist');
    console.log('   These tables were likely in a design document but never migrated');
    console.log('   Action: Create a new migration to add these tables');
  }
}

main()
  .catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
