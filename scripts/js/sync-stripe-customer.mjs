#!/usr/bin/env node

/**
 * Sync Stripe customer data to database
 * Finds customer by email and syncs subscription data
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia'
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncStripeCustomer(email) {
  try {
    console.log(`🔍 Searching Stripe for customer: ${email}`);

    // Search for customer by email
    const customers = await stripe.customers.list({
      email: email,
      limit: 1
    });

    if (customers.data.length === 0) {
      console.error(`❌ No Stripe customer found for ${email}`);
      return;
    }

    const customer = customers.data[0];
    console.log(`✅ Found Stripe customer: ${customer.id}`);
    console.log(`   Name: ${customer.name}`);
    console.log(`   Created: ${new Date(customer.created * 1000).toISOString()}`);

    // Get workspace by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (userError || !user) {
      console.error(`❌ User not found in database: ${email}`);
      return;
    }

    const { data: member, error: memberError } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(id, name)')
      .eq('user_id', user.id)
      .single();

    if (memberError || !member) {
      console.error(`❌ Workspace not found for user: ${email}`);
      return;
    }

    const workspaceId = member.workspace_id;
    const workspaceName = member.workspaces?.name;
    console.log(`📁 Workspace: ${workspaceName} (${workspaceId})`);

    // Get customer's subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      limit: 10
    });

    if (subscriptions.data.length === 0) {
      console.error(`❌ No subscriptions found for customer ${customer.id}`);
      return;
    }

    console.log(`\n📊 Found ${subscriptions.data.length} subscription(s):`);

    for (const subscription of subscriptions.data) {
      console.log(`\n   Subscription ID: ${subscription.id}`);
      console.log(`   Status: ${subscription.status}`);
      console.log(`   Plan: ${subscription.metadata.plan || 'unknown'}`);
      console.log(`   Trial End: ${subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : 'N/A'}`);
      console.log(`   Current Period: ${new Date(subscription.current_period_start * 1000).toISOString()} to ${new Date(subscription.current_period_end * 1000).toISOString()}`);

      if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
        console.log(`   ⚠️  PAYMENT ISSUE: Subscription is ${subscription.status}`);
      }

      // Get latest invoice
      if (subscription.latest_invoice) {
        const invoice = await stripe.invoices.retrieve(subscription.latest_invoice);
        console.log(`   Latest Invoice: ${invoice.id}`);
        console.log(`   Amount Due: $${(invoice.amount_due / 100).toFixed(2)}`);
        console.log(`   Invoice Status: ${invoice.status}`);

        if (invoice.status === 'open' && invoice.payment_intent) {
          const paymentIntent = await stripe.paymentIntents.retrieve(invoice.payment_intent);
          console.log(`   Payment Status: ${paymentIntent.status}`);
          if (paymentIntent.last_payment_error) {
            console.log(`   ❌ Payment Error: ${paymentIntent.last_payment_error.message}`);
          }
        }
      }
    }

    // Sync to database
    console.log(`\n💾 Syncing to database...`);

    // Insert/update customer record
    const { error: customerError } = await supabase
      .from('workspace_stripe_customers')
      .upsert({
        workspace_id: workspaceId,
        stripe_customer_id: customer.id,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id'
      });

    if (customerError) {
      console.error(`❌ Failed to sync customer:`, customerError);
      return;
    }
    console.log(`✅ Synced customer to workspace_stripe_customers`);

    // Sync most recent subscription
    const latestSubscription = subscriptions.data[0];
    const { error: subError } = await supabase
      .from('workspace_subscriptions')
      .upsert({
        workspace_id: workspaceId,
        stripe_subscription_id: latestSubscription.id,
        status: latestSubscription.status,
        plan: latestSubscription.metadata.plan || 'perseat',
        trial_end: latestSubscription.trial_end ? new Date(latestSubscription.trial_end * 1000).toISOString() : null,
        current_period_start: new Date(latestSubscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(latestSubscription.current_period_end * 1000).toISOString(),
        cancel_at: latestSubscription.cancel_at ? new Date(latestSubscription.cancel_at * 1000).toISOString() : null,
        canceled_at: latestSubscription.canceled_at ? new Date(latestSubscription.canceled_at * 1000).toISOString() : null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id'
      });

    if (subError) {
      console.error(`❌ Failed to sync subscription:`, subError);
      return;
    }
    console.log(`✅ Synced subscription to workspace_subscriptions`);

    // Update workspace table
    const { error: workspaceError } = await supabase
      .from('workspaces')
      .update({
        stripe_customer_id: customer.id,
        stripe_subscription_id: latestSubscription.id,
        subscription_status: latestSubscription.status,
        trial_ends_at: latestSubscription.trial_end ? new Date(latestSubscription.trial_end * 1000).toISOString() : null,
        billing_starts_at: latestSubscription.trial_end ? new Date(latestSubscription.trial_end * 1000).toISOString() : null
      })
      .eq('id', workspaceId);

    if (workspaceError) {
      console.error(`❌ Failed to update workspace:`, workspaceError);
    } else {
      console.log(`✅ Updated workspace table`);
    }

    console.log(`\n✅ Sync complete!`);

    // Print action items
    if (latestSubscription.status === 'past_due' || latestSubscription.status === 'unpaid') {
      console.log(`\n⚠️  ACTION REQUIRED:`);
      console.log(`   1. Customer needs to update payment method`);
      console.log(`   2. Send Stripe payment link: https://dashboard.stripe.com/customers/${customer.id}`);
      console.log(`   3. Or send billing portal link (create via API)`);
    }

  } catch (error) {
    console.error(`❌ Error:`, error.message);
  }
}

// Run with email from command line
const email = process.argv[2];
if (!email) {
  console.error('Usage: node sync-stripe-customer.mjs <email>');
  process.exit(1);
}

syncStripeCustomer(email);
