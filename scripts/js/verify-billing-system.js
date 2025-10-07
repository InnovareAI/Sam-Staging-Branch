#!/usr/bin/env node
/**
 * Comprehensive Billing System Verification Script
 * Checks database tables, Stripe products, and API functionality
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

async function checkTable(tableName) {
  try {
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .limit(5);

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return { table: tableName, exists: false, error: 'Table does not exist', count: 0 };
      }
      return { table: tableName, exists: false, error: error.message, count: 0 };
    }

    return { table: tableName, exists: true, count: count || 0, sampleData: data };
  } catch (err) {
    return { table: tableName, exists: false, error: err.message, count: 0 };
  }
}

async function queryStripeProducts() {
  log(colors.cyan, '\n📦 Querying Stripe Products...');

  const { data, error } = await supabase
    .from('stripe_products')
    .select('*');

  if (error) {
    log(colors.red, '❌ Error querying stripe_products:', error.message);
    return { success: false, products: [], count: 0 };
  }

  if (!data || data.length === 0) {
    log(colors.yellow, '⚠️  No products found in stripe_products table');
    return { success: true, products: [], count: 0 };
  }

  log(colors.green, `✅ Found ${data.length} products:`);
  data.forEach(product => {
    console.log(`   - ${product.name} (${product.brand}) - ${product.stripe_product_id}`);
  });

  return { success: true, products: data, count: data.length };
}

async function queryStripePrices() {
  log(colors.cyan, '\n💰 Querying Stripe Prices...');

  const { data, error } = await supabase
    .from('stripe_prices')
    .select('*');

  if (error) {
    log(colors.red, '❌ Error querying stripe_prices:', error.message);
    return { success: false, prices: [], count: 0 };
  }

  if (!data || data.length === 0) {
    log(colors.yellow, '⚠️  No prices found in stripe_prices table');
    return { success: true, prices: [], count: 0 };
  }

  log(colors.green, `✅ Found ${data.length} pricing plans:`);
  data.forEach(price => {
    console.log(`   - $${price.unit_amount / 100}/${price.interval} - ${price.stripe_price_id}`);
  });

  return { success: true, prices: data, count: data.length };
}

async function testBillingAPI() {
  log(colors.cyan, '\n🔌 Testing Billing API Endpoints...');

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL.includes('localhost')
    ? 'http://localhost:3000'
    : 'https://app.meet-sam.com';

  const endpoints = [
    '/api/billing/products',
    '/api/billing/health'
  ];

  const results = [];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${baseUrl}${endpoint}`);
      const status = response.status;
      let body = null;

      try {
        body = await response.json();
      } catch {
        body = await response.text();
      }

      const success = status >= 200 && status < 300;

      results.push({
        endpoint,
        status,
        success,
        body: typeof body === 'string' ? body.substring(0, 100) : body
      });

      if (success) {
        log(colors.green, `   ✅ ${endpoint} - ${status}`);
      } else {
        log(colors.yellow, `   ⚠️  ${endpoint} - ${status}`);
      }
    } catch (err) {
      results.push({
        endpoint,
        status: 0,
        success: false,
        error: err.message
      });
      log(colors.red, `   ❌ ${endpoint} - ${err.message}`);
    }
  }

  return results;
}

async function calculateReadiness() {
  const requiredTables = [
    'tenants',
    'tenant_subscriptions',
    'tenant_invoices',
    'stripe_products',
    'stripe_prices',
    'workspace_tier_mapping'
  ];

  const checks = {
    tablesExist: 0,
    productsExist: false,
    pricesExist: false,
    apiWorking: false
  };

  // Check tables
  const tableResults = await Promise.all(requiredTables.map(checkTable));
  checks.tablesExist = tableResults.filter(r => r.exists).length;

  // Check products
  if (checks.tablesExist >= 4) {
    const productsResult = await queryStripeProducts();
    checks.productsExist = productsResult.count > 0;

    const pricesResult = await queryStripePrices();
    checks.pricesExist = pricesResult.count > 0;
  }

  // Check API
  const apiResults = await testBillingAPI();
  checks.apiWorking = apiResults.some(r => r.success);

  // Calculate percentage
  const maxScore = 4; // tables, products, prices, API
  let score = 0;

  if (checks.tablesExist === 6) score += 1;
  if (checks.productsExist) score += 1;
  if (checks.pricesExist) score += 1;
  if (checks.apiWorking) score += 1;

  return {
    percentage: Math.round((score / maxScore) * 100),
    checks,
    tableResults
  };
}

async function main() {
  log(colors.magenta, '╔════════════════════════════════════════════════════════╗');
  log(colors.magenta, '║   COMPREHENSIVE BILLING SYSTEM VERIFICATION REPORT    ║');
  log(colors.magenta, '╚════════════════════════════════════════════════════════╝');

  // 1. Check all tables
  log(colors.cyan, '\n🗄️  DATABASE TABLES VERIFICATION');
  log(colors.cyan, '═══════════════════════════════════════\n');

  const billingTables = [
    'tenants',
    'tenant_subscriptions',
    'tenant_invoices',
    'stripe_products',
    'stripe_prices',
    'workspace_tier_mapping'
  ];

  const tableResults = await Promise.all(billingTables.map(checkTable));
  const existingTables = tableResults.filter(r => r.exists);
  const missingTables = tableResults.filter(r => !r.exists);

  log(colors.green, '✅ EXISTING TABLES:');
  existingTables.forEach(r => {
    console.log(`   ✓ ${r.table} (${r.count} rows)`);
  });

  if (missingTables.length > 0) {
    log(colors.red, '\n❌ MISSING TABLES:');
    missingTables.forEach(r => {
      console.log(`   ✗ ${r.table}`);
    });
  }

  log(colors.blue, `\n📊 Table Status: ${existingTables.length}/${billingTables.length} billing tables exist`);

  // 2. Query Stripe products (if table exists)
  let productsResult = { success: false, count: 0, products: [] };
  let pricesResult = { success: false, count: 0, prices: [] };

  if (existingTables.some(t => t.table === 'stripe_products')) {
    productsResult = await queryStripeProducts();

    if (existingTables.some(t => t.table === 'stripe_prices')) {
      pricesResult = await queryStripePrices();
    }
  } else {
    log(colors.yellow, '\n⚠️  Skipping product queries - stripe_products table does not exist');
  }

  // 3. Test API endpoints
  const apiResults = await testBillingAPI();

  // 4. Calculate readiness
  log(colors.cyan, '\n📈 BILLING SYSTEM READINESS ASSESSMENT');
  log(colors.cyan, '═══════════════════════════════════════\n');

  const readiness = await calculateReadiness();

  console.log(`Tables Created:     ${readiness.checks.tablesExist}/6 ${readiness.checks.tablesExist === 6 ? '✅' : '❌'}`);
  console.log(`Products Exist:     ${readiness.checks.productsExist ? 'Yes ✅' : 'No ❌'}`);
  console.log(`Prices Exist:       ${readiness.checks.pricesExist ? 'Yes ✅' : 'No ❌'}`);
  console.log(`API Functional:     ${readiness.checks.apiWorking ? 'Yes ✅' : 'No ❌'}`);

  log(colors.magenta, `\n🎯 OVERALL READINESS: ${readiness.percentage}%`);

  // 5. Blockers and next steps
  log(colors.cyan, '\n🚧 REMAINING BLOCKERS');
  log(colors.cyan, '═══════════════════════════════════════\n');

  const blockers = [];

  if (missingTables.length > 0) {
    blockers.push({
      severity: 'CRITICAL',
      issue: `${missingTables.length} billing tables missing from database`,
      action: 'Apply migration: supabase/migrations/20251005000002_create_3cubed_billing.sql',
      tables: missingTables.map(t => t.table)
    });
  }

  if (existingTables.length === 6 && productsResult.count === 0) {
    blockers.push({
      severity: 'HIGH',
      issue: 'No Stripe products found in database',
      action: 'Run seed script to create Stripe products and sync to database'
    });
  }

  if (existingTables.length === 6 && pricesResult.count === 0) {
    blockers.push({
      severity: 'HIGH',
      issue: 'No Stripe prices found in database',
      action: 'Run seed script to create pricing plans and sync to database'
    });
  }

  if (!readiness.checks.apiWorking) {
    blockers.push({
      severity: 'MEDIUM',
      issue: 'Billing API endpoints not responding correctly',
      action: 'Debug API routes after database is properly seeded'
    });
  }

  if (blockers.length === 0) {
    log(colors.green, '✅ No blockers found! Billing system is ready.');
  } else {
    blockers.forEach((blocker, i) => {
      const severityColor = blocker.severity === 'CRITICAL' ? colors.red :
                            blocker.severity === 'HIGH' ? colors.yellow :
                            colors.blue;

      log(severityColor, `${i + 1}. [${blocker.severity}] ${blocker.issue}`);
      console.log(`   Action: ${blocker.action}`);
      if (blocker.tables) {
        console.log(`   Tables: ${blocker.tables.join(', ')}`);
      }
      console.log('');
    });
  }

  // 6. Summary
  log(colors.magenta, '\n╔════════════════════════════════════════════════════════╗');
  log(colors.magenta, '║                    SUMMARY REPORT                      ║');
  log(colors.magenta, '╚════════════════════════════════════════════════════════╝\n');

  console.log(`Database Tables:    ${existingTables.length}/${billingTables.length} created`);
  console.log(`Stripe Products:    ${productsResult.count} products found`);
  console.log(`Stripe Prices:      ${pricesResult.count} pricing plans found`);
  console.log(`API Status:         ${readiness.checks.apiWorking ? 'Functional' : 'Not functional'}`);
  console.log(`Overall Readiness:  ${readiness.percentage}%`);
  console.log(`Blockers:           ${blockers.length} remaining\n`);

  if (readiness.percentage === 100) {
    log(colors.green, '🎉 SUCCESS! Billing system is fully operational.');
  } else if (readiness.percentage >= 50) {
    log(colors.yellow, '⚠️  Billing system is partially ready. Complete remaining blockers.');
  } else {
    log(colors.red, '❌ Billing system is not ready. Critical issues must be resolved.');
  }

  return {
    readiness: readiness.percentage,
    blockers: blockers.length,
    tablesFound: existingTables.length,
    productsFound: productsResult.count,
    pricesFound: pricesResult.count
  };
}

// Run verification
main()
  .then(stats => {
    process.exit(stats.blockers > 0 ? 1 : 0);
  })
  .catch(err => {
    log(colors.red, '\n❌ Verification failed:', err);
    process.exit(1);
  });
