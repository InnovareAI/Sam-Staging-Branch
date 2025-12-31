import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool } from '@/lib/auth'
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
    // Authenticate user
    const authContext = await verifyAuth(request);
    const { userId } = authContext;

    const body = await request.json()
    const { workspaceId, plan } = body // plan: 'perseat' | 'sme'

    // Validate input
    if (!workspaceId || !plan) {
      return NextResponse.json({
        error: 'Missing required fields: workspaceId, plan'
      }, { status: 400 })
    }

    // Check workspace access directly via DB since we have the context
    // Ideally verifyAuth already checks if they have access if workspaceId header is passed, 
    // but here workspaceId is in body. So we verify membership manually.

    const memberResult = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: 'User is not a member of this workspace' }, { status: 403 })
    }

    // Get workspace details
    const workspaceResult = await pool.query(
      'SELECT name FROM workspaces WHERE id = $1',
      [workspaceId]
    );
    const workspace = workspaceResult.rows[0];

    // Get user details
    const userResult = await pool.query(
      'SELECT email, first_name, last_name FROM users WHERE id = $1',
      [userId]
    );
    const profile = userResult.rows[0];

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

    const existingCustomerResult = await pool.query(
      'SELECT stripe_customer_id FROM workspace_stripe_customers WHERE workspace_id = $1',
      [workspaceId]
    );

    if (existingCustomerResult.rows.length > 0) {
      customerId = existingCustomerResult.rows[0].stripe_customer_id
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
      await pool.query(
        'INSERT INTO workspace_stripe_customers (workspace_id, stripe_customer_id) VALUES ($1, $2)',
        [workspaceId, customerId]
      );
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
    await pool.query(
      `INSERT INTO workspace_subscriptions 
       (workspace_id, stripe_subscription_id, status, plan, trial_end) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        workspaceId,
        subscription.id,
        'trialing',
        plan,
        new Date(subscription.trial_end! * 1000).toISOString()
      ]
    );

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
