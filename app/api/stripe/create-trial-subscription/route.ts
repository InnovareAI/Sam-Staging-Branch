import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia'
})

/**
 * POST /api/stripe/create-trial-subscription
 *
 * Create a Stripe subscription with 14-day trial
 * Saves payment method but doesn't charge until trial ends
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workspaceId, plan } = body // plan: 'startup' | 'sme'

    // Verify workspace membership
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get workspace and user details
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single()

    const { data: profile } = await supabase
      .from('users')
      .select('profile_name, profile_email')
      .eq('id', user.id)
      .single()

    // Determine price ID based on plan
    const priceId = plan === 'startup'
      ? process.env.NEXT_PUBLIC_STRIPE_STARTUP_PRICE_ID
      : process.env.NEXT_PUBLIC_STRIPE_SME_PRICE_ID

    if (!priceId) {
      return NextResponse.json({
        error: 'Stripe price ID not configured'
      }, { status: 500 })
    }

    // Create or retrieve Stripe customer
    let customerId: string

    const { data: existingCustomer } = await supabase
      .from('workspace_stripe_customers')
      .select('stripe_customer_id')
      .eq('workspace_id', workspaceId)
      .single()

    if (existingCustomer?.stripe_customer_id) {
      customerId = existingCustomer.stripe_customer_id
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: profile?.profile_email || user.email,
        name: profile?.profile_name || workspace?.name,
        metadata: {
          workspace_id: workspaceId,
          user_id: user.id
        }
      })

      customerId = customer.id

      // Save customer ID to database
      await supabase
        .from('workspace_stripe_customers')
        .insert({
          workspace_id: workspaceId,
          stripe_customer_id: customerId
        })
    }

    // Create SetupIntent for saving payment method
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      metadata: {
        workspace_id: workspaceId,
        plan: plan
      }
    })

    // Create subscription with trial (payment method attached later)
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: 14,
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription'
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        workspace_id: workspaceId,
        plan: plan
      }
    })

    // Save subscription to database
    await supabase
      .from('workspace_subscriptions')
      .insert({
        workspace_id: workspaceId,
        stripe_subscription_id: subscription.id,
        status: 'trialing',
        plan: plan,
        trial_end: new Date(subscription.trial_end! * 1000).toISOString()
      })

    return NextResponse.json({
      setupIntent: {
        clientSecret: setupIntent.client_secret,
        id: setupIntent.id
      },
      subscription: {
        id: subscription.id,
        status: subscription.status,
        trial_end: subscription.trial_end
      }
    })

  } catch (error) {
    console.error('Stripe trial subscription error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create trial subscription'
      },
      { status: 500 }
    )
  }
}
