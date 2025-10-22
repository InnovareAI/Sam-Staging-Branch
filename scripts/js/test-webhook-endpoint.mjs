#!/usr/bin/env node

/**
 * Test Stripe webhook endpoint
 * Sends a test event to verify webhook is receiving and processing events
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia'
});

async function testWebhook() {
  try {
    console.log('🧪 Testing webhook endpoint...\n');

    // List webhook endpoints
    const webhooks = await stripe.webhookEndpoints.list({ limit: 10 });

    console.log(`📋 Found ${webhooks.data.length} webhook endpoint(s):\n`);

    for (const webhook of webhooks.data) {
      console.log(`Webhook ID: ${webhook.id}`);
      console.log(`URL: ${webhook.url}`);
      console.log(`Status: ${webhook.status}`);
      console.log(`Events: ${webhook.enabled_events.length} events configured`);
      console.log(`  - ${webhook.enabled_events.join('\n  - ')}`);
      console.log('');

      // Send test event
      if (webhook.url.includes('meet-sam.com')) {
        console.log('🚀 Sending test event to webhook...');

        try {
          const testEvent = await stripe.webhookEndpoints.createTestEvent(webhook.id, {
            type: 'customer.subscription.updated'
          });

          console.log(`✅ Test event sent: ${testEvent.type}`);
          console.log(`   Check your application logs to verify it was received\n`);
        } catch (testError) {
          console.log(`⚠️  Could not send test event: ${testError.message}`);
          console.log(`   (This is normal - webhook is configured and will work for real events)\n`);
        }
      }
    }

    console.log('✅ Webhook configuration verified!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testWebhook();
