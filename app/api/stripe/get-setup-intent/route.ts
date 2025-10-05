import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia'
})

/**
 * GET /api/stripe/get-setup-intent
 *
 * Retrieve SetupIntent metadata (including workspace_id) after payment redirect
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const setupIntentId = searchParams.get('setup_intent_id')

    if (!setupIntentId) {
      return NextResponse.json({
        error: 'Missing setup_intent_id parameter'
      }, { status: 400 })
    }

    // Retrieve SetupIntent from Stripe
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId)

    return NextResponse.json({
      id: setupIntent.id,
      status: setupIntent.status,
      metadata: setupIntent.metadata
    })

  } catch (error) {
    console.error('Get SetupIntent error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to retrieve SetupIntent'
      },
      { status: 500 }
    )
  }
}
