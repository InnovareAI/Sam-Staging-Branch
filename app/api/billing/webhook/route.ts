import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, endpointSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const workspaceId = session.metadata?.workspace_id
  const tierType = session.metadata?.tier_type as 'startup' | 'sme' | 'enterprise'
  const userId = session.metadata?.user_id

  if (!workspaceId || !tierType || !userId) {
    console.error('Missing metadata in checkout session:', session.id)
    return
  }

  // Log the successful checkout
  await supabase
    .from('billing_audit_log')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      action: 'checkout_completed',
      details: {
        session_id: session.id,
        tier_type: tierType,
        customer_id: session.customer,
        subscription_id: session.subscription,
      },
    })
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const workspaceId = subscription.metadata.workspace_id
  const tierType = subscription.metadata.tier_type as 'startup' | 'sme' | 'enterprise'
  const userId = subscription.metadata.user_id

  if (!workspaceId || !tierType || !userId) {
    console.error('Missing metadata in subscription:', subscription.id)
    return
  }

  // Cancel any existing active subscriptions for this workspace
  await supabase
    .from('workspace_subscriptions')
    .update({ 
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')

  // Create new subscription record
  const { error } = await supabase
    .from('workspace_subscriptions')
    .insert({
      workspace_id: workspaceId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      tier_type: tierType,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      created_by: userId,
    })

  if (error) {
    console.error('Failed to create subscription record:', error)
    return
  }

  // Update workspace tier
  await supabase
    .from('workspace_tiers')
    .upsert({
      workspace_id: workspaceId,
      tier_type: tierType,
      effective_date: new Date().toISOString(),
      updated_by: userId,
    })

  // Log the subscription creation
  await supabase
    .from('billing_audit_log')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      action: 'subscription_created',
      details: {
        subscription_id: subscription.id,
        tier_type: tierType,
        status: subscription.status,
      },
    })
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const workspaceId = subscription.metadata.workspace_id
  const tierType = subscription.metadata.tier_type as 'startup' | 'sme' | 'enterprise'
  const userId = subscription.metadata.user_id

  if (!workspaceId) {
    console.error('Missing workspace_id in subscription metadata:', subscription.id)
    return
  }

  // Update subscription record
  const { error } = await supabase
    .from('workspace_subscriptions')
    .update({
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      cancelled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('Failed to update subscription record:', error)
    return
  }

  // Update workspace tier if needed
  if (tierType) {
    await supabase
      .from('workspace_tiers')
      .upsert({
        workspace_id: workspaceId,
        tier_type: tierType,
        effective_date: new Date().toISOString(),
        updated_by: userId || null,
      })
  }

  // Log the subscription update
  await supabase
    .from('billing_audit_log')
    .insert({
      workspace_id: workspaceId,
      user_id: userId || null,
      action: 'subscription_updated',
      details: {
        subscription_id: subscription.id,
        status: subscription.status,
        tier_type: tierType,
      },
    })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const workspaceId = subscription.metadata.workspace_id
  const userId = subscription.metadata.user_id

  if (!workspaceId) {
    console.error('Missing workspace_id in subscription metadata:', subscription.id)
    return
  }

  // Update subscription status
  const { error } = await supabase
    .from('workspace_subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('Failed to update cancelled subscription:', error)
    return
  }

  // Downgrade workspace to free tier or suspend
  await supabase
    .from('workspace_tiers')
    .upsert({
      workspace_id: workspaceId,
      tier_type: 'startup', // Fallback to startup tier
      effective_date: new Date().toISOString(),
      updated_by: userId || null,
    })

  // Log the subscription cancellation
  await supabase
    .from('billing_audit_log')
    .insert({
      workspace_id: workspaceId,
      user_id: userId || null,
      action: 'subscription_cancelled',
      details: {
        subscription_id: subscription.id,
        cancelled_at: new Date().toISOString(),
      },
    })
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string
  
  if (!subscriptionId) return

  // Get subscription details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const workspaceId = subscription.metadata.workspace_id
  const userId = subscription.metadata.user_id

  if (!workspaceId) return

  // Log successful payment
  await supabase
    .from('billing_audit_log')
    .insert({
      workspace_id: workspaceId,
      user_id: userId || null,
      action: 'payment_succeeded',
      details: {
        invoice_id: invoice.id,
        subscription_id: subscriptionId,
        amount_paid: invoice.amount_paid,
        currency: invoice.currency,
      },
    })
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string
  
  if (!subscriptionId) return

  // Get subscription details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const workspaceId = subscription.metadata.workspace_id
  const userId = subscription.metadata.user_id

  if (!workspaceId) return

  // Log failed payment
  await supabase
    .from('billing_audit_log')
    .insert({
      workspace_id: workspaceId,
      user_id: userId || null,
      action: 'payment_failed',
      details: {
        invoice_id: invoice.id,
        subscription_id: subscriptionId,
        amount_due: invoice.amount_due,
        currency: invoice.currency,
        attempt_count: invoice.attempt_count,
      },
    })

  // TODO: Send notification email to workspace admins about failed payment
  // TODO: Implement grace period logic before suspending access
}