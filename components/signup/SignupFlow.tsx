'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import EmailSignupForm from './EmailSignupForm'
import PlanSelector from './PlanSelector'
import StripePaymentSetup from './StripePaymentSetup'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type SignupStep = 'email' | 'plan' | 'payment' | 'complete'

/**
 * Multi-Step Signup Flow for InnovareAI
 *
 * Flow for all customers:
 * 1. Email signup → Auto-detect country (for DPA tracking)
 * 2. Plan selection (Startup $99 or SME $399)
 * 3. Payment setup (Stripe, card saved but not charged)
 * 4. Trial starts (14 days)
 * 5. Day 14: Auto-charge payment method
 * 6. EU customers: DPA signature required within 30 days of first charge
 *
 * Note: DPA is NOT required during signup. It's collected post-payment
 * with a 30-day grace period for EU/EEA/UK/CH customers.
 */
export default function SignupFlow() {
  const [step, setStep] = useState<SignupStep>('email')
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<'perseat' | 'sme'>('perseat')
  const [isEu, setIsEu] = useState(false)
  const [country, setCountry] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  // Progress indicator (same for all customers)
  const steps = [
    { id: 'email', label: 'Account Creation' },
    { id: 'plan', label: 'Plan Selection' },
    { id: 'payment', label: 'Get Started' }
  ]

  const currentStepIndex = steps.findIndex(s => s.id === step)

  // Step 1: Email signup
  const handleEmailSignup = async (email: string, password: string, userId: string, workspaceId?: string) => {
    // EmailSignupForm has already called the API and created the user
    // We just need to save the data and move to next step
    setEmail(email)
    setUserId(userId)

    // If workspace was created during signup, use it
    if (workspaceId) {
      setWorkspaceId(workspaceId)
    }

    setStep('plan')
  }

  // Step 2: Plan selection
  const handlePlanSelected = (plan: 'perseat' | 'sme') => {
    setSelectedPlan(plan)
    setStep('payment')  // All customers proceed directly to payment
  }

  // Step 3: Payment setup complete
  const handlePaymentSetup = () => {
    setStep('complete')

    // Notify parent window if embedded in iframe (for WordPress modal integration)
    if (window.parent !== window) {
      window.parent.postMessage(
        { type: 'SAM_SIGNUP_COMPLETE', workspaceId },
        'https://innovareai.com'
      )
    }

    // Redirect to main SAM interface after brief success message
    setTimeout(() => {
      router.push('/')
    }, 2000)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      {/* Progress Indicator */}
      {step !== 'complete' && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl mb-8"
        >
          <div className="flex items-center justify-between">
            {steps.map((s, index) => (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                    ${index <= currentStepIndex
                      ? 'bg-[#8907FF] text-white'
                      : 'bg-slate-200 text-gray-700'
                    }
                  `}>
                    {index < currentStepIndex ? (
                      <CheckCircle className="h-6 w-6" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className={`text-xs mt-2 ${
                    index <= currentStepIndex ? 'text-[#8907FF] font-medium' : 'text-gray-700'
                  }`}>
                    {s.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 ${
                    index < currentStepIndex ? 'bg-[#8907FF]' : 'bg-slate-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="w-full max-w-2xl mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {/* Step 1: Email Signup */}
        {step === 'email' && (
          <motion.div
            key="email"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <EmailSignupForm onSuccess={handleEmailSignup} />
          </motion.div>
        )}

        {/* Step 2: Plan Selection */}
        {step === 'plan' && (
          <motion.div
            key="plan"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <PlanSelector
              onPlanSelected={handlePlanSelected}
              showEuBadge={false}
            />
          </motion.div>
        )}

        {/* Step 3: Payment Setup */}
        {step === 'payment' && (
          <motion.div
            key="payment"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {workspaceId && userId ? (
              <StripePaymentSetup
                plan={selectedPlan}
                workspaceId={workspaceId}
                userId={userId}
                onSuccess={handlePaymentSetup}
              />
            ) : (
              <Card className="w-full max-w-md shadow-xl bg-white border-0">
                <CardContent className="pt-6 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#8907FF]" />
                  <p className="mt-4 text-gray-900">Setting up your account...</p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center bg-white p-12 rounded-2xl shadow-2xl max-w-md"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              <CheckCircle className="h-20 w-20 text-green-600 mx-auto mb-6" />
            </motion.div>
            <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-[#6600FF] to-[#8907FF] bg-clip-text text-transparent">
              Welcome to SAM AI! 🎉
            </h2>
            <p className="text-gray-900 mb-4">
              Your 14-day trial has started.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Redirecting to your workspace...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
