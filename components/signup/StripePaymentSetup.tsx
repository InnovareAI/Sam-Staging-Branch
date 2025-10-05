'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CreditCard, Lock } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

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

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

/**
 * Stripe Payment Setup Component
 * Collects payment method for 14-day trial (no charge until trial ends)
 */
export default function StripePaymentSetup(props: StripePaymentSetupProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    // Create trial subscription on mount
    const createSubscription = async () => {
      try {
        const response = await fetch('/api/stripe/create-trial-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: props.workspaceId,
            plan: props.plan
          })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create subscription')
        }

        setClientSecret(data.setupIntent.clientSecret)

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Setup failed')
      }
    }

    createSubscription()
  }, [props.workspaceId, props.plan])

  if (error) {
    return (
      <Card className="w-full max-w-md shadow-xl">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (!clientSecret) {
    return (
      <Card className="w-full max-w-md shadow-xl">
        <CardContent className="pt-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
          <p className="mt-4 text-slate-600">Setting up payment...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentForm {...props} />
    </Elements>
  )
}

/**
 * Payment Form Component (must be inside Elements provider)
 */
function PaymentForm({
  plan,
  workspaceId,
  userId,
  onSuccess
}: StripePaymentSetupProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const planDetails = PLAN_DETAILS[plan]
  const trialEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setLoading(true)
    setError('')

    try {
      // Confirm payment setup with Stripe
      const { error: stripeError } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/signup/complete`
        },
        redirect: 'if_required'
      })

      if (stripeError) {
        throw new Error(stripeError.message)
      }

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
          {/* Stripe Payment Element */}
          <div className="p-4 border border-slate-200 rounded-lg bg-white">
            <PaymentElement />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={loading || !stripe || !elements}>
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
