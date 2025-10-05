'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

/**
 * Stripe Payment Completion Page
 * Handles redirect after Stripe payment confirmation
 */
function SignupCompleteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const setupIntentId = searchParams.get('setup_intent')
    const setupIntentClientSecret = searchParams.get('setup_intent_client_secret')
    const redirectStatus = searchParams.get('redirect_status')

    // Check if payment setup succeeded
    if (redirectStatus === 'succeeded' && setupIntentId) {
      // Payment setup successful - redirect to main SAM interface
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } else {
      // Payment failed or was cancelled
      setTimeout(() => {
        router.push('/signup/innovareai')
      }, 3000)
    }
  }, [searchParams, router])

  const redirectStatus = searchParams.get('redirect_status')

  if (redirectStatus === 'succeeded') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="pt-12 pb-12 text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
            <p className="text-slate-600 mb-4">
              Your 14-day trial has started. You won't be charged until day 14.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Redirecting to your workspace...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <Card className="w-full max-w-md shadow-xl">
        <CardContent className="pt-12 pb-12 text-center">
          <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Payment Failed</h1>
          <p className="text-slate-600 mb-4">
            There was an issue setting up your payment method.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Redirecting back to signup...</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignupCompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="pt-12 pb-12 text-center">
            <Loader2 className="h-16 w-16 animate-spin mx-auto text-[#8907FF] mb-4" />
            <p className="text-slate-600">Loading...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <SignupCompleteContent />
    </Suspense>
  )
}
