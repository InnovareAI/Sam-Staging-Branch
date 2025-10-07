#!/usr/bin/env node
/**
 * Query Stripe Products and Prices
 * Shows all Stripe products and pricing plans in the database
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🔍 Querying Stripe Products and Prices...\n');

  // Query stripe_products
  const { data: products, error: productsError } = await supabase
    .from('stripe_products')
    .select('*')
    .order('created_at');

  if (productsError) {
    console.error('❌ Error querying stripe_products:', productsError.message);
    return;
  }

  console.log(`📦 STRIPE PRODUCTS (${products.length} found):\n`);

  if (products.length === 0) {
    console.log('   ⚠️  No products found in database\n');
  } else {
    products.forEach((product, i) => {
      console.log(`${i + 1}. ${product.name || 'Unnamed Product'}`);
      console.log(`   ID: ${product.id}`);
      console.log(`   Stripe Product ID: ${product.stripe_product_id || 'Not set'}`);
      console.log(`   Brand: ${product.brand || 'Not set'}`);
      console.log(`   Active: ${product.active !== false ? 'Yes' : 'No'}`);
      console.log(`   Created: ${new Date(product.created_at).toLocaleDateString()}`);
      console.log('');
    });
  }

  // Query stripe_prices
  const { data: prices, error: pricesError } = await supabase
    .from('stripe_prices')
    .select('*')
    .order('unit_amount');

  if (pricesError) {
    console.error('❌ Error querying stripe_prices:', pricesError.message);
    return;
  }

  console.log(`💰 STRIPE PRICES (${prices.length} found):\n`);

  if (prices.length === 0) {
    console.log('   ⚠️  No prices found in database\n');
  } else {
    prices.forEach((price, i) => {
      const amount = price.unit_amount ? `$${price.unit_amount / 100}` : 'Free';
      const interval = price.recurring_interval || 'one-time';

      console.log(`${i + 1}. ${amount}/${interval}`);
      console.log(`   ID: ${price.id}`);
      console.log(`   Stripe Price ID: ${price.stripe_price_id || 'Not set'}`);
      console.log(`   Product ID: ${price.product_id || 'Not linked'}`);
      console.log(`   Plan Tier: ${price.plan_tier || 'Not set'}`);
      console.log(`   Active: ${price.active !== false ? 'Yes' : 'No'}`);
      console.log(`   Created: ${new Date(price.created_at).toLocaleDateString()}`);
      console.log('');
    });
  }

  // Summary
  console.log('📊 SUMMARY:\n');
  console.log(`Total Products: ${products.length}`);
  console.log(`Total Prices: ${prices.length}`);

  const innovareProducts = products.filter(p => p.brand === 'innovareai' || p.brand === 'innovare');
  const cubedProducts = products.filter(p => p.brand === '3cubed');

  console.log(`\nInnovareAI Products: ${innovareProducts.length}`);
  console.log(`3cubed Products: ${cubedProducts.length}`);

  // Group prices by product
  if (products.length > 0 && prices.length > 0) {
    console.log('\n💡 PRODUCT-PRICE MAPPING:\n');

    products.forEach(product => {
      const productPrices = prices.filter(p => p.product_id === product.id);
      console.log(`${product.name} (${product.brand}):`);

      if (productPrices.length === 0) {
        console.log('   ⚠️  No prices configured');
      } else {
        productPrices.forEach(price => {
          const amount = price.unit_amount ? `$${price.unit_amount / 100}` : 'Free';
          const interval = price.recurring_interval || 'one-time';
          console.log(`   - ${amount}/${interval} (${price.plan_tier || 'no tier'})`);
        });
      }
      console.log('');
    });
  }

  // Check readiness
  console.log('🎯 BILLING SYSTEM READINESS:\n');

  const hasProducts = products.length > 0;
  const hasPrices = prices.length > 0;
  const hasInnovareProducts = innovareProducts.length > 0;
  const has3cubedProducts = cubedProducts.length > 0;

  console.log(`Products exist: ${hasProducts ? '✅' : '❌'}`);
  console.log(`Prices exist: ${hasPrices ? '✅' : '❌'}`);
  console.log(`InnovareAI products: ${hasInnovareProducts ? '✅' : '❌'}`);
  console.log(`3cubed products: ${has3cubedProducts ? '✅' : '❌'}`);

  if (hasProducts && hasPrices && hasInnovareProducts && has3cubedProducts) {
    console.log('\n✅ Billing system is FULLY CONFIGURED');
  } else if (!hasProducts) {
    console.log('\n❌ CRITICAL: No products in database - run seed script');
  } else if (!hasPrices) {
    console.log('\n❌ CRITICAL: No prices in database - run seed script');
  } else if (!hasInnovareProducts || !has3cubedProducts) {
    console.log('\n⚠️  WARNING: Missing products for one or both brands');
  }
}

main()
  .catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
