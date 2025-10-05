'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CreditCard, Lock } from 'lucide-react'

interface StripePaymentSetupProps {
  plan: 'startup' | 'sme'
  workspaceId: string
  userId: string
  onSuccess: () => void
}

const PLAN_DETAILS = {
  startup: { amount: 99, name: 'Startup' },
  sme: { amount: 399, name: 'SME' }
}

/**
 * Stripe Payment Setup Component
 *
 * Note: This is a simplified version. Full implementation requires:
 * 1. npm install @stripe/stripe-js @stripe/react-stripe-js
 * 2. Stripe Elements integration
 * 3. Stripe account setup with price IDs
 *
 * For now, this shows the UI and flow structure.
 */
export default function StripePaymentSetup({
  plan,
  workspaceId,
  userId,
  onSuccess
}: StripePaymentSetupProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const planDetails = PLAN_DETAILS[plan]
  const trialEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // TODO: Implement full Stripe integration
      // For now, simulate success after delay
      await new Promise(resolve => setTimeout(resolve, 1500))

      /* Full implementation:
      const response = await fetch('/api/stripe/create-trial-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          userId,
          priceId: process.env.NEXT_PUBLIC_STRIPE_STARTUP_PRICE_ID,
          trialDays: 14
        })
      })

      const { clientSecret, error: apiError } = await response.json()
      if (apiError) throw new Error(apiError)

      // Confirm payment setup with Stripe
      const { error: stripeError } = await stripe.confirmSetup({
        elements,
        clientSecret,
        confirmParams: { return_url: `${window.location.origin}/signup/complete` },
        redirect: 'if_required'
      })

      if (stripeError) throw new Error(stripeError.message)
      */

      onSuccess()

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment setup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Information
        </CardTitle>
        <div className="space-y-2 pt-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Plan:</span>
            <span className="font-semibold">{planDetails.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Monthly Price:</span>
            <span className="font-semibold">${planDetails.amount}/month</span>
          </div>
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg mt-3">
            <p className="text-sm text-green-800">
              <strong>14-day free trial</strong>
            </p>
            <p className="text-xs text-green-700 mt-1">
              First charge on {trialEndDate.toLocaleDateString()}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Stripe Payment Element will go here */}
          <div className="p-6 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 text-center">
            <CreditCard className="h-12 w-12 mx-auto text-slate-400 mb-3" />
            <p className="text-sm text-slate-600 mb-1">
              Stripe Payment Element
            </p>
            <p className="text-xs text-slate-500">
              Requires Stripe integration setup
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Start 14-Day Free Trial
              </>
            )}
          </Button>

          <div className="text-center space-y-2">
            <p className="text-xs text-slate-500">
              🔒 Secure payment processing by Stripe
            </p>
            <p className="text-xs text-slate-500">
              Cancel anytime during your trial with no charge
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
