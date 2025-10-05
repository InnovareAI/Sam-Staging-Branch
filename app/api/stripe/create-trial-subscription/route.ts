import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/app/lib/supabase'
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
    const supabase = createServerClient()

    const body = await request.json()
    const { workspaceId, userId, plan } = body // plan: 'perseat' | 'sme'

    // Validate input
    if (!workspaceId || !userId || !plan) {
      return NextResponse.json({
        error: 'Missing required fields: workspaceId, userId, plan'
      }, { status: 400 })
    }

    // Verify workspace membership
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'User is not a member of this workspace' }, { status: 403 })
    }

    // Get workspace and user details
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single()

    const { data: profile } = await supabase
      .from('users')
      .select('email, first_name, last_name')
      .eq('id', userId)
      .single()

    // Determine price ID based on plan
    const priceId = plan === 'perseat'
      ? process.env.NEXT_PUBLIC_STRIPE_PERSEAT_MONTHLY_PRICE_ID
      : process.env.NEXT_PUBLIC_STRIPE_SME_MONTHLY_PRICE_ID

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
      const customerName = profile?.first_name && profile?.last_name
        ? `${profile.first_name} ${profile.last_name}`
        : workspace?.name || 'Unknown'

      const customer = await stripe.customers.create({
        email: profile?.email || '',
        name: customerName,
        metadata: {
          workspace_id: workspaceId,
          user_id: userId
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

    // Create SetupIntent for saving payment method (credit card only)
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],  // Only credit cards, no bank accounts
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
