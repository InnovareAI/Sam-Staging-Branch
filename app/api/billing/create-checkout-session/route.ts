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

interface CheckoutSessionRequest {
  priceId: string
  workspaceId: string
  tierType: 'startup' | 'sme' | 'enterprise'
  userId: string
  successUrl: string
  cancelUrl: string
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckoutSessionRequest = await request.json()
    const { priceId, workspaceId, tierType, userId, successUrl, cancelUrl } = body

    if (!priceId || !workspaceId || !tierType || !userId || !successUrl || !cancelUrl) {
      return NextResponse.json({
        error: 'Missing required parameters: priceId, workspaceId, tierType, userId, successUrl, cancelUrl'
      }, { status: 400 })
    }

    // Verify user has access to the workspace
    const { data: workspaceMember, error: memberError } = await supabase
      .from('workspace_members')
      .select('role, workspace_id')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single()

    if (memberError || !workspaceMember) {
      return NextResponse.json({
        error: 'User does not have access to this workspace'
      }, { status: 403 })
    }

    // Check if user is admin or owner
    if (!['admin', 'owner'].includes(workspaceMember.role)) {
      return NextResponse.json({
        error: 'Only workspace admins and owners can manage billing'
      }, { status: 403 })
    }

    // Get workspace details for customer info
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('name, slug')
      .eq('id', workspaceId)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json({
        error: 'Workspace not found'
      }, { status: 404 })
    }

    // Get user details for customer info
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId)
    
    if (userError || !user.user) {
      return NextResponse.json({
        error: 'User not found'
      }, { status: 404 })
    }

    // Check if workspace already has an active subscription
    const { data: existingSubscription, error: subError } = await supabase
      .from('workspace_subscriptions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .single()

    // Create or retrieve Stripe customer
    let stripeCustomerId: string

    // Check if workspace already has a Stripe customer
    const { data: existingCustomer } = await supabase
      .from('workspace_stripe_customers')
      .select('stripe_customer_id')
      .eq('workspace_id', workspaceId)
      .single()

    if (existingCustomer) {
      stripeCustomerId = existingCustomer.stripe_customer_id
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.user.email!,
        name: workspace.name,
        metadata: {
          workspace_id: workspaceId,
          workspace_slug: workspace.slug,
          user_id: userId,
        },
      })

      stripeCustomerId = customer.id

      // Save customer ID to database
      await supabase
        .from('workspace_stripe_customers')
        .insert({
          workspace_id: workspaceId,
          stripe_customer_id: stripeCustomerId,
          created_by: userId,
        })
    }

    // Create checkout session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        workspace_id: workspaceId,
        tier_type: tierType,
        user_id: userId,
      },
      subscription_data: {
        metadata: {
          workspace_id: workspaceId,
          tier_type: tierType,
          user_id: userId,
        },
        trial_period_days: 14, // 14-day free trial
      },
      allow_promotion_codes: true,
    }

    // If upgrading, include the existing subscription
    if (existingSubscription) {
      sessionParams.subscription_data = {
        ...sessionParams.subscription_data,
        metadata: {
          ...sessionParams.subscription_data?.metadata,
          previous_subscription_id: existingSubscription.stripe_subscription_id,
        },
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    // Log the checkout session creation
    await supabase
      .from('billing_audit_log')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        action: 'checkout_session_created',
        details: {
          session_id: session.id,
          tier_type: tierType,
          price_id: priceId,
          customer_id: stripeCustomerId,
        },
      })

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    })

  } catch (error) {
    console.error('Stripe checkout session creation error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to create checkout session'
    }, { status: 500 })
  }
}