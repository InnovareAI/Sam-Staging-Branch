# DPA Implementation Guide - Signup with Payment Upfront

**Status**: Ready to implement
**Decision**: Collect payment info at signup (before trial starts)
**DPA Timing**: Between plan selection and Stripe payment setup (EU only)
**Flow**: Email → Plan → DPA (EU) → Payment → 14-day Trial → Auto-charge

---

## Why Payment Info at Signup?

**Conversion Rate Optimization:**
- ✅ **60-80% conversion** (card on file) vs **10-20%** (chase after trial)
- ✅ User is hot and committed at signup (higher intent)
- ✅ No chasing users for payment info after trial
- ✅ Stripe auto-charges at trial end (zero friction)
- ✅ Industry best practice for B2B SaaS trials

**DPA Compliance:**
- ✅ DPA signed before payment processing begins
- ✅ EU customers expect legal docs before entering payment
- ✅ Compliant with GDPR before any financial transaction

---

## Complete Signup Flow

### For EU Customers:
```
1. Email signup
   ↓
2. Detect EU country (IP geolocation or ask during signup)
   ↓
3. Choose plan (Startup $99/mo or SME $399/mo)
   ↓
4. ✅ SIGN DPA ← NEW STEP
   ↓
5. Enter payment info (Stripe setup intent, card saved but NOT charged)
   ↓
6. 14-day trial starts (full product access, card on file)
   ↓
7. Day 14: Stripe auto-charges card → Paid subscription active
```

### For Non-EU Customers:
```
1. Email signup
   ↓
2. Choose plan
   ↓
3. Enter payment info (no DPA needed)
   ↓
4. 14-day trial starts
   ↓
5. Day 14: Auto-charge → Paid subscription
```

---

## Implementation

### Step 1: Multi-Step Signup Component

```typescript
// /app/signup/page.tsx or /components/SignupFlow.tsx

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DpaSigningModal from '@/components/dpa/DpaSigningModal'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type SignupStep = 'email' | 'plan' | 'dpa' | 'payment' | 'complete'

export default function SignupFlow() {
  const [step, setStep] = useState<SignupStep>('email')
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<'startup' | 'sme'>('startup')
  const [isEu, setIsEu] = useState(false)
  const [country, setCountry] = useState('')
  const router = useRouter()

  // Step 1: Email signup
  const handleEmailSignup = async (email: string, password: string) => {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })

    const data = await response.json()

    if (response.ok) {
      setEmail(email)
      setUserId(data.user.id)
      setWorkspaceId(data.workspace.id)
      setIsEu(data.isEu)
      setCountry(data.country)
      setStep('plan')  // Move to plan selection
    }
  }

  // Step 2: Plan selection
  const handlePlanSelected = (plan: 'startup' | 'sme') => {
    setSelectedPlan(plan)

    if (isEu) {
      setStep('dpa')  // EU customers: show DPA first
    } else {
      setStep('payment')  // Non-EU: skip to payment
    }
  }

  // Step 3: DPA signed (EU only)
  const handleDpaSigned = () => {
    setStep('payment')  // Proceed to Stripe after DPA
  }

  // Step 4: Payment setup complete
  const handlePaymentSetup = () => {
    setStep('complete')
    router.push(`/workspace/${workspaceId}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 p-6">
      {/* Step 1: Email Signup */}
      {step === 'email' && (
        <EmailSignupForm onSuccess={handleEmailSignup} />
      )}

      {/* Step 2: Plan Selection */}
      {step === 'plan' && (
        <PlanSelector
          onPlanSelected={handlePlanSelected}
          showEuBadge={isEu}
        />
      )}

      {/* Step 3: DPA Signing (EU only) */}
      {step === 'dpa' && (
        <div className="w-full max-w-4xl">
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              🇪🇺 As an EU customer, please review and sign our Data Processing Agreement
              before proceeding to payment.
            </p>
          </div>
          <DpaSigningModal
            isOpen={true}
            workspaceId={workspaceId}
            onClose={() => {}}  // Can't skip - required
            onSuccess={handleDpaSigned}
          />
        </div>
      )}

      {/* Step 4: Payment Setup (Stripe) */}
      {step === 'payment' && (
        <Elements stripe={stripePromise}>
          <StripePaymentSetup
            plan={selectedPlan}
            workspaceId={workspaceId}
            userId={userId}
            onSuccess={handlePaymentSetup}
          />
        </Elements>
      )}

      {/* Step 5: Complete */}
      {step === 'complete' && (
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Welcome to SAM AI! 🎉</h2>
          <p>Your 14-day trial has started. Redirecting to your workspace...</p>
        </div>
      )}
    </div>
  )
}
```

---

### Step 2: Email Signup Component

```typescript
// /components/signup/EmailSignupForm.tsx

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface EmailSignupFormProps {
  onSuccess: (email: string, password: string) => Promise<void>
}

export default function EmailSignupForm({ onSuccess }: EmailSignupFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await onSuccess(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Start Your 14-Day Trial</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Continue'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

---

### Step 3: Plan Selection Component

```typescript
// /components/signup/PlanSelector.tsx

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle } from 'lucide-react'

interface PlanSelectorProps {
  onPlanSelected: (plan: 'startup' | 'sme') => void
  showEuBadge?: boolean
}

export default function PlanSelector({ onPlanSelected, showEuBadge }: PlanSelectorProps) {
  return (
    <div className="w-full max-w-4xl">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2">Choose Your Plan</h2>
        <p className="text-slate-600">14-day free trial • No credit card charge until trial ends</p>
        {showEuBadge && (
          <Badge className="mt-2 bg-blue-100 text-blue-700">
            🇪🇺 EU Customer - DPA signature required before payment
          </Badge>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Startup Plan */}
        <Card className="border-2 hover:border-indigo-500 transition-colors">
          <CardHeader>
            <CardTitle>Startup</CardTitle>
            <div className="text-3xl font-bold">$99<span className="text-lg text-slate-600">/mo</span></div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>Up to 5 team members</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>1,000 prospects/month</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>LinkedIn + Email campaigns</span>
              </li>
            </ul>
            <Button
              className="w-full"
              onClick={() => onPlanSelected('startup')}
            >
              Start Trial
            </Button>
          </CardContent>
        </Card>

        {/* SME Plan */}
        <Card className="border-2 border-indigo-500">
          <CardHeader>
            <Badge className="mb-2 w-fit">Most Popular</Badge>
            <CardTitle>SME</CardTitle>
            <div className="text-3xl font-bold">$399<span className="text-lg text-slate-600">/mo</span></div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>Unlimited team members</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>5,000 prospects/month</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>Advanced analytics</span>
              </li>
            </ul>
            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              onClick={() => onPlanSelected('sme')}
            >
              Start Trial
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

---

### Step 4: Stripe Payment Setup Component

```typescript
// /components/signup/StripePaymentSetup.tsx

'use client'

import { useState } from 'react'
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface StripePaymentSetupProps {
  plan: 'startup' | 'sme'
  workspaceId: string
  userId: string
  onSuccess: () => void
}

export default function StripePaymentSetup({
  plan,
  workspaceId,
  userId,
  onSuccess
}: StripePaymentSetupProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const planPrices = {
    startup: { amount: 99, priceId: process.env.NEXT_PUBLIC_STRIPE_STARTUP_PRICE_ID },
    sme: { amount: 399, priceId: process.env.NEXT_PUBLIC_STRIPE_SME_PRICE_ID }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) return

    setLoading(true)
    setError('')

    try {
      // Create subscription with trial
      const response = await fetch('/api/stripe/create-trial-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          userId,
          priceId: planPrices[plan].priceId,
          trialDays: 14
        })
      })

      const { clientSecret, error: apiError } = await response.json()

      if (apiError) {
        throw new Error(apiError)
      }

      // Confirm payment setup
      const { error: stripeError } = await stripe.confirmSetup({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/signup/complete`
        },
        redirect: 'if_required'
      })

      if (stripeError) {
        throw new Error(stripeError.message)
      }

      // Success - payment method saved, trial started
      onSuccess()

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment setup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Payment Information</CardTitle>
        <p className="text-sm text-slate-600">
          Your card will be charged ${planPrices[plan].amount}/month after your 14-day trial ends.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <PaymentElement />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={!stripe || loading}>
            {loading ? 'Setting up...' : 'Start 14-Day Trial'}
          </Button>
          <p className="text-xs text-center text-slate-500">
            You won't be charged until {new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString()}
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
```

---

### Step 5: Backend - Signup API with EU Detection

```typescript
// /app/api/auth/signup/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
]

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Create user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (authError) throw authError

    // Detect country from IP (use IP geolocation service)
    const ipCountry = await detectCountryFromIP(request)

    const isEu = EU_COUNTRIES.includes(ipCountry.toUpperCase())

    // Create user profile
    await supabase.from('users').insert({
      id: authData.user.id,
      email,
      profile_country: ipCountry
    })

    // Create workspace
    const { data: workspace } = await supabase.from('workspaces').insert({
      name: `${email.split('@')[0]}'s Workspace`,
      created_by: authData.user.id,
      status: 'trial'
    }).select().single()

    // Add user as workspace owner
    await supabase.from('workspace_members').insert({
      workspace_id: workspace.id,
      user_id: authData.user.id,
      role: 'owner'
    })

    // If EU, create DPA requirement
    if (isEu) {
      await supabase.from('workspace_dpa_requirements').insert({
        workspace_id: workspace.id,
        requires_dpa: true,
        detection_method: 'ip_geolocation',
        detected_country: ipCountry,
        detected_at: new Date().toISOString()
      })
    }

    return NextResponse.json({
      user: { id: authData.user.id, email },
      workspace: { id: workspace.id, name: workspace.name },
      isEu,
      country: ipCountry
    })

  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Signup failed' },
      { status: 500 }
    )
  }
}

async function detectCountryFromIP(request: NextRequest): Promise<string> {
  // Option 1: Use Netlify/Vercel headers
  const country = request.headers.get('x-vercel-ip-country') ||
                  request.headers.get('x-country')

  if (country) return country

  // Option 2: Use IP geolocation API (ipapi.co, ip-api.com, etc.)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
             request.headers.get('x-real-ip')

  if (ip) {
    try {
      const response = await fetch(`https://ipapi.co/${ip}/country/`)
      return await response.text()
    } catch {
      return 'US'  // Fallback
    }
  }

  return 'US'  // Default fallback
}
```

---

### Step 6: Stripe Trial Subscription API

```typescript
// /app/api/stripe/create-trial-subscription/route.ts

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia'
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, userId, priceId, trialDays } = await request.json()

    // Get user email
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single()

    // Create or get Stripe customer
    let customer
    const { data: existingCustomer } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single()

    if (existingCustomer) {
      customer = await stripe.customers.retrieve(existingCustomer.stripe_customer_id)
    } else {
      customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: userId,
          workspace_id: workspaceId
        }
      })

      // Save Stripe customer ID
      await supabase.from('stripe_customers').insert({
        user_id: userId,
        workspace_id: workspaceId,
        stripe_customer_id: customer.id
      })
    }

    // Create subscription with trial
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      trial_period_days: trialDays,
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription'
      },
      expand: ['latest_invoice.payment_intent']
    })

    const invoice = subscription.latest_invoice as Stripe.Invoice
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent

    // Save subscription to database
    await supabase.from('subscriptions').insert({
      workspace_id: workspaceId,
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customer.id,
      status: 'trialing',
      trial_end: new Date(subscription.trial_end! * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      subscriptionId: subscription.id
    })

  } catch (error) {
    console.error('Stripe subscription error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Subscription creation failed' },
      { status: 500 }
    )
  }
}
```

---

## Summary

**Complete signup flow for EU customers:**

1. ✅ Email signup
2. ✅ Auto-detect EU country from IP
3. ✅ Choose plan (Startup/SME)
4. ✅ **Sign DPA** (EU only)
5. ✅ Enter payment info (Stripe, card saved, NOT charged)
6. ✅ 14-day trial starts
7. ✅ Day 14: Auto-charge card → Paid subscription

**Benefits:**
- 🚀 **60-80% conversion rate** (vs 10-20% without card)
- ✅ GDPR compliant (DPA before payment)
- ✅ Zero friction trial-to-paid (auto-charge)
- ✅ No chasing users for payment info

**Implementation time:** ~3-4 hours for full flow

Ready to implement!
