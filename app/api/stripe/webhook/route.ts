import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/app/lib/supabase'
import { apiError, handleApiError, apiSuccess } from '@/lib/api-error-handler'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia'
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

/**
 * POST /api/stripe/webhook
 *
 * Stripe webhook handler for subscription lifecycle events
 * Handles: subscription updates, payments, trial endings, cancellations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      throw apiError.validation('Missing Stripe signature header')
    }

    if (!webhookSecret) {
      throw apiError.internal('Stripe webhook secret not configured')
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (verifyError) {
      console.error('⚠️ Webhook signature verification failed:', verifyError)
      throw apiError.validation(`Webhook signature verification failed: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`)
    }

    console.log(`✅ Received Stripe event: ${event.type}`)

    const supabase = supabaseAdmin()

    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdate(supabase, subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(supabase, subscription)
        break
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription
        await handleTrialEnding(supabase, subscription)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentSucceeded(supabase, invoice)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(supabase, invoice)
        break
      }

      case 'customer.updated': {
        const customer = event.data.object as Stripe.Customer
        await handleCustomerUpdated(supabase, customer)
        break
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`)
    }

    return apiSuccess({ received: true, event_type: event.type })

  } catch (error) {
    return handleApiError(error, 'stripe_webhook')
  }
}

/**
 * Handle subscription created/updated events
 */
async function handleSubscriptionUpdate(supabase: any, subscription: Stripe.Subscription) {
  const workspaceId = subscription.metadata.workspace_id

  if (!workspaceId) {
    console.error('❌ Subscription missing workspace_id in metadata:', subscription.id)
    return
  }

  const subscriptionData = {
    workspace_id: workspaceId,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    plan: subscription.metadata.plan || 'perseat',
    trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
    canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null
  }

  // Upsert subscription
  const { error } = await supabase
    .from('workspace_subscriptions')
    .upsert(subscriptionData, {
      onConflict: 'stripe_subscription_id'
    })

  if (error) {
    console.error('❌ Failed to upsert subscription:', error)
    throw apiError.database('subscription upsert', error)
  }

  // Update workspace fields
  const { error: workspaceError } = await supabase
    .from('workspaces')
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      billing_starts_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null
    })
    .eq('id', workspaceId)

  if (workspaceError) {
    console.error('❌ Failed to update workspace:', workspaceError)
  }

  console.log(`✅ Updated subscription for workspace ${workspaceId}: ${subscription.status}`)
}

/**
 * Handle subscription deleted (canceled) events
 */
async function handleSubscriptionDeleted(supabase: any, subscription: Stripe.Subscription) {
  const { error } = await supabase
    .from('workspace_subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('❌ Failed to mark subscription as canceled:', error)
    throw apiError.database('subscription cancellation', error)
  }

  // Update workspace
  const { data: sub } = await supabase
    .from('workspace_subscriptions')
    .select('workspace_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (sub) {
    await supabase
      .from('workspaces')
      .update({
        subscription_status: 'canceled',
        subscription_cancelled_at: new Date().toISOString()
      })
      .eq('id', sub.workspace_id)
  }

  console.log(`✅ Marked subscription ${subscription.id} as canceled`)
}

/**
 * Handle trial ending soon (3 days before)
 */
async function handleTrialEnding(supabase: any, subscription: Stripe.Subscription) {
  console.log(`⚠️ Trial ending soon for subscription ${subscription.id}`)

  // TODO: Send notification email to customer
  // Get workspace owner's email and send trial ending notification

  const { data: sub } = await supabase
    .from('workspace_subscriptions')
    .select('workspace_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (sub) {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('owner_id, name')
      .eq('id', sub.workspace_id)
      .single()

    if (workspace) {
      const { data: user } = await supabase
        .from('users')
        .select('email, first_name')
        .eq('id', workspace.owner_id)
        .single()

      console.log(`📧 TODO: Send trial ending email to ${user?.email} for workspace ${workspace.name}`)
    }
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(supabase: any, invoice: Stripe.Invoice) {
  console.log(`✅ Payment succeeded for invoice ${invoice.id}`)

  if (invoice.subscription) {
    // Update subscription status to active if it was past_due
    const { error } = await supabase
      .from('workspace_subscriptions')
      .update({ status: 'active' })
      .eq('stripe_subscription_id', invoice.subscription)
      .eq('status', 'past_due')

    if (error) {
      console.error('❌ Failed to update subscription status:', error)
    }
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(supabase: any, invoice: Stripe.Invoice) {
  console.error(`❌ Payment failed for invoice ${invoice.id}`)

  if (invoice.subscription) {
    // Mark subscription as past_due
    const { error } = await supabase
      .from('workspace_subscriptions')
      .update({ status: 'past_due' })
      .eq('stripe_subscription_id', invoice.subscription)

    if (error) {
      console.error('❌ Failed to update subscription status:', error)
    }

    // Update workspace
    const { data: sub } = await supabase
      .from('workspace_subscriptions')
      .select('workspace_id')
      .eq('stripe_subscription_id', invoice.subscription)
      .single()

    if (sub) {
      await supabase
        .from('workspaces')
        .update({ subscription_status: 'past_due' })
        .eq('id', sub.workspace_id)

      // TODO: Send payment failed notification email
      console.log(`📧 TODO: Send payment failed email for workspace ${sub.workspace_id}`)
    }
  }
}

/**
 * Handle customer updated events
 */
async function handleCustomerUpdated(supabase: any, customer: Stripe.Customer) {
  console.log(`ℹ️ Customer updated: ${customer.id}`)

  // Update customer email if changed
  const { error } = await supabase
    .from('workspace_stripe_customers')
    .update({ updated_at: new Date().toISOString() })
    .eq('stripe_customer_id', customer.id)

  if (error) {
    console.error('❌ Failed to update customer record:', error)
  }
}
