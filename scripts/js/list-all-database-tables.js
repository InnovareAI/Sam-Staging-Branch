#!/usr/bin/env node
/**
 * List All Database Tables
 * Queries the database schema to see all tables that actually exist
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listAllTables() {
  console.log('🔍 Querying database schema...\n');

  const { data, error } = await supabase.rpc('get_all_tables', {});

  if (error) {
    // If the function doesn't exist, use a direct query
    console.log('⚠️  Custom function not found, using direct schema query...\n');

    const { data: tables, error: queryError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');

    if (queryError) {
      console.error('❌ Error querying schema:', queryError.message);

      // Try alternative approach with raw SQL
      console.log('\n⚠️  Trying alternative query method...\n');

      const { data: rawData, error: rawError } = await supabase.rpc('exec_sql', {
        query: `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_name;
        `
      });

      if (rawError) {
        console.error('❌ Alternative method also failed:', rawError.message);
        console.log('\n💡 Try running this SQL directly in Supabase SQL editor:');
        console.log(`
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name;
        `);
        return;
      }

      displayTables(rawData);
      return;
    }

    displayTables(tables.map(t => ({ table_name: t.table_name })));
    return;
  }

  displayTables(data);
}

function displayTables(tables) {
  if (!tables || tables.length === 0) {
    console.log('❌ No tables found or unable to retrieve table list');
    return;
  }

  console.log(`✅ Found ${tables.length} tables in public schema:\n`);

  // Group tables by category
  const categories = {
    billing: [],
    workspace: [],
    campaign: [],
    crm: [],
    knowledge: [],
    auth: [],
    integration: [],
    other: []
  };

  tables.forEach(t => {
    const name = t.table_name;

    if (name.includes('stripe') || name.includes('billing') || name.includes('invoice') ||
        name.includes('subscription') || name.includes('tenant')) {
      categories.billing.push(name);
    } else if (name.includes('workspace')) {
      categories.workspace.push(name);
    } else if (name.includes('campaign')) {
      categories.campaign.push(name);
    } else if (name.includes('crm')) {
      categories.crm.push(name);
    } else if (name.includes('knowledge')) {
      categories.knowledge.push(name);
    } else if (name.includes('auth') || name.includes('user') || name.includes('magic_link')) {
      categories.auth.push(name);
    } else if (name.includes('integration') || name.includes('unipile') || name.includes('n8n')) {
      categories.integration.push(name);
    } else {
      categories.other.push(name);
    }
  });

  // Display categorized tables
  for (const [category, tableList] of Object.entries(categories)) {
    if (tableList.length > 0) {
      console.log(`📁 ${category.toUpperCase()} TABLES (${tableList.length}):`);
      tableList.forEach(table => console.log(`   - ${table}`));
      console.log('');
    }
  }

  // Check for specific billing tables
  console.log('🔍 BILLING TABLE CHECK:');
  const billingTables = [
    'tenants',
    'tenant_subscriptions',
    'tenant_invoices',
    'stripe_products',
    'stripe_prices',
    'workspace_tier_mapping',
    'organizations',
    'workspace_usage',
    'workspace_invoices',
    'workspace_stripe_customers',
    'workspace_subscriptions'
  ];

  const allTableNames = tables.map(t => t.table_name);
  billingTables.forEach(table => {
    const exists = allTableNames.includes(table);
    console.log(`   ${exists ? '✅' : '❌'} ${table}`);
  });
}

listAllTables()
  .catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
