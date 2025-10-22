import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia'
});

try {
  console.log('🔧 Creating Stripe webhook endpoint...\n');

  const webhook = await stripe.webhookEndpoints.create({
    url: 'https://app.meet-sam.com/api/stripe/webhook',
    enabled_events: [
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'customer.subscription.trial_will_end',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'customer.updated'
    ],
    description: 'SAM AI Platform - Subscription lifecycle events',
    api_version: '2024-12-18.acacia'
  });

  console.log('✅ Webhook endpoint created successfully!\n');
  console.log(`Webhook ID: ${webhook.id}`);
  console.log(`URL: ${webhook.url}`);
  console.log(`Status: ${webhook.status}`);
  console.log(`\n🔑 IMPORTANT - Webhook Signing Secret:`);
  console.log(`${webhook.secret}`);
  console.log(`\n⚠️  Add this to your Netlify environment variables as:`);
  console.log(`STRIPE_WEBHOOK_SECRET=${webhook.secret}`);

} catch (error) {
  if (error.code === 'url_invalid') {
    console.error('❌ Webhook URL already exists or is invalid');
    // List existing webhooks
    const webhooks = await stripe.webhookEndpoints.list({ limit: 10 });
    console.log('\n📋 Existing webhooks:');
    webhooks.data.forEach(wh => {
      console.log(`  ${wh.id}: ${wh.url} (${wh.status})`);
    });
  } else {
    console.error('❌ Error creating webhook:', error.message);
  }
}
