import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia'
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const customerId = 'cus_TBgNIqFJqsjCt3';
const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

// Get subscription details
const subs = await stripe.subscriptions.list({ customer: customerId });
const sub = subs.data[0];

console.log('Subscription Details:');
console.log(`  ID: ${sub.id}`);
console.log(`  Status: ${sub.status}`);
console.log(`  Metadata plan: ${sub.metadata.plan || 'NOT SET'}`);
console.log(`  Trial end: ${sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : 'N/A'}`);
console.log(`  Current period: ${new Date(sub.current_period_start * 1000).toISOString()} to ${new Date(sub.current_period_end * 1000).toISOString()}`);

// Get the price to determine plan
if (sub.items.data[0]) {
  const price = await stripe.prices.retrieve(sub.items.data[0].price.id);
  console.log(`  Price ID: ${price.id}`);
  console.log(`  Product ID: ${price.product}`);
  console.log(`  Amount: $${(price.unit_amount / 100).toFixed(2)}`);

  // Determine plan based on amount
  let plan = 'startup'; // default
  if (price.unit_amount === 9900) plan = 'startup';
  else if (price.unit_amount === 49900) plan = 'sme';
  else if (price.unit_amount === 99900) plan = 'enterprise';

  console.log(`  Determined plan: ${plan}`);

  // Insert with correct plan
  const { data, error } = await supabase.from('workspace_subscriptions').insert({
    workspace_id: workspaceId,
    stripe_subscription_id: sub.id,
    status: sub.status,
    plan: plan,
    trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    cancel_at: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
    canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null
  });

  if (error) {
    console.error('❌ Error inserting subscription:', error);
  } else {
    console.log('✅ Subscription inserted successfully!');
  }
}
