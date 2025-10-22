import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia'
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// List recent customers to find Stan
const customers = await stripe.customers.list({ limit: 20 });
console.log(`Found ${customers.data.length} customers\n`);

for (const customer of customers.data) {
  console.log(`${customer.email || 'no email'} - ${customer.name || 'no name'} - ${customer.id}`);

  if (customer.email && customer.email.includes('signali')) {
    console.log(`\n✅ Found Stan! Customer ID: ${customer.id}`);

    // Get subscriptions
    const subs = await stripe.subscriptions.list({ customer: customer.id });
    if (subs.data.length > 0) {
      const sub = subs.data[0];
      console.log(`Subscription: ${sub.id}, Status: ${sub.status}`);

      // Sync to database
      const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

      // Insert customer
      await supabase.from('workspace_stripe_customers').upsert({
        workspace_id: workspaceId,
        stripe_customer_id: customer.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'workspace_id' });

      // Insert subscription
      await supabase.from('workspace_subscriptions').upsert({
        workspace_id: workspaceId,
        stripe_subscription_id: sub.id,
        status: sub.status,
        plan: sub.metadata.plan || 'perseat',
        trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'workspace_id' });

      // Update workspace
      await supabase.from('workspaces').update({
        stripe_customer_id: customer.id,
        stripe_subscription_id: sub.id,
        subscription_status: sub.status,
        trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null
      }).eq('id', workspaceId);

      console.log(`✅ Synced to database!`);
    }
  }
}
