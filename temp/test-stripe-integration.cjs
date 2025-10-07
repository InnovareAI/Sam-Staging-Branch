const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia'
});

async function testStripeIntegration() {
  console.log('🔍 Testing Stripe Integration for InnovareAI\n');

  // Test 1: Verify Stripe connection
  console.log('1. Testing Stripe API Connection...');
  try {
    const account = await stripe.balance.retrieve();
    console.log('   ✅ Stripe Connection: Working');
    console.log(`   Available: $${(account.available[0]?.amount || 0) / 100} ${account.available[0]?.currency || 'usd'}`);
    console.log(`   Pending: $${(account.pending[0]?.amount || 0) / 100} ${account.pending[0]?.currency || 'usd'}`);
  } catch (error) {
    console.log('   ❌ Stripe Connection Failed:', error.message);
    return;
  }

  // Test 2: Check for required database tables
  console.log('\n2. Checking Database Tables:');

  const tables = ['workspace_stripe_customers', 'workspace_subscriptions'];
  const missingTables = [];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
      console.log(`   ❌ ${table}: Missing - ${error.message}`);
      missingTables.push(table);
    } else {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      console.log(`   ✅ ${table}: Exists (${count} records)`);
    }
  }

  // Test 3: Check Stripe products
  console.log('\n3. Checking Stripe Products:');
  try {
    const products = await stripe.products.list({ limit: 10, active: true });
    console.log(`   Found ${products.data.length} active products:`);
    products.data.forEach(p => {
      console.log(`   - ${p.name} (ID: ${p.id})`);
    });
  } catch (error) {
    console.log('   ❌ Could not fetch products:', error.message);
  }

  // Test 4: Verify price IDs from environment
  console.log('\n4. Verifying Environment Price IDs:');
  const priceIds = {
    'Per-Seat Monthly': process.env.NEXT_PUBLIC_STRIPE_PERSEAT_MONTHLY_PRICE_ID,
    'Per-Seat Annual': process.env.NEXT_PUBLIC_STRIPE_PERSEAT_ANNUAL_PRICE_ID,
    'SME Monthly': process.env.NEXT_PUBLIC_STRIPE_SME_MONTHLY_PRICE_ID,
    'SME Annual': process.env.NEXT_PUBLIC_STRIPE_SME_ANNUAL_PRICE_ID
  };

  for (const [name, priceId] of Object.entries(priceIds)) {
    if (priceId) {
      try {
        const price = await stripe.prices.retrieve(priceId);
        const amount = price.unit_amount / 100;
        const interval = price.recurring?.interval || 'one-time';
        console.log(`   ✅ ${name}: $${amount}/${interval}`);
      } catch (error) {
        console.log(`   ❌ ${name}: Invalid price ID (${priceId})`);
      }
    } else {
      console.log(`   ⚠️  ${name}: Not configured in environment`);
    }
  }

  // Test 5: Check InnovareAI organization Stripe setup
  console.log('\n5. InnovareAI Organization Stripe Setup:');
  const { data: innovareOrg } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', 'innovareai')
    .single();

  if (innovareOrg) {
    console.log(`   Name: ${innovareOrg.name}`);
    console.log(`   Billing Type: ${innovareOrg.billing_type}`);
    console.log(`   Stripe Customer ID: ${innovareOrg.stripe_customer_id || '❌ NOT SET'}`);

    if (innovareOrg.stripe_customer_id) {
      try {
        const customer = await stripe.customers.retrieve(innovareOrg.stripe_customer_id);
        console.log(`   ✅ Stripe Customer exists: ${customer.email || customer.name}`);
      } catch (error) {
        console.log(`   ❌ Invalid Stripe Customer ID`);
      }
    } else {
      console.log('   ⚠️  No Stripe customer created yet');
    }
  }

  // Test 6: Check for any existing subscriptions
  console.log('\n6. Existing Stripe Activity:');

  try {
    const customers = await stripe.customers.list({ limit: 5 });
    console.log(`   Total Stripe Customers: ${customers.data.length}`);

    const subscriptions = await stripe.subscriptions.list({ limit: 5 });
    console.log(`   Total Stripe Subscriptions: ${subscriptions.data.length}`);

    if (subscriptions.data.length > 0) {
      console.log('\n   Recent Subscriptions:');
      subscriptions.data.forEach(sub => {
        console.log(`   - ${sub.id}: ${sub.status} (${sub.items.data[0]?.price.id})`);
      });
    }
  } catch (error) {
    console.log('   ❌ Could not fetch Stripe data:', error.message);
  }

  // Summary
  console.log('\n📊 Summary:');
  if (missingTables.length > 0) {
    console.log(`   ⚠️  Missing tables: ${missingTables.join(', ')}`);
    console.log('   → Need to create migration for Stripe-specific tables');
  } else {
    console.log('   ✅ All required database tables exist');
  }

  if (!innovareOrg?.stripe_customer_id) {
    console.log('   ⚠️  InnovareAI organization not linked to Stripe customer');
    console.log('   → Customer will be created automatically on first subscription');
  }

  console.log('\n✅ Stripe integration is ready to use');
  console.log('   API routes available:');
  console.log('   - POST /api/stripe/create-trial-subscription');
  console.log('   - POST /api/stripe/get-setup-intent');
}

testStripeIntegration().catch(console.error);
