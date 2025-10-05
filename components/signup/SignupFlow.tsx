'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import EmailSignupForm from './EmailSignupForm'
import PlanSelector from './PlanSelector'
import StripePaymentSetup from './StripePaymentSetup'
import DpaSigningModal from '@/components/dpa/DpaSigningModal'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type SignupStep = 'email' | 'plan' | 'dpa' | 'payment' | 'complete'

/**
 * Multi-Step Signup Flow with DPA Integration
 *
 * Flow for EU/EEA/UK/CH customers:
 * 1. Email signup → Auto-detect country
 * 2. Plan selection
 * 3. Sign DPA (EU/EEA/UK/CH only)
 * 4. Payment setup (Stripe, card saved but not charged)
 * 5. Trial starts (14 days)
 *
 * Flow for non-EU customers:
 * 1. Email signup
 * 2. Plan selection
 * 3. Payment setup (skip DPA)
 * 4. Trial starts
 */
export default function SignupFlow() {
  const [step, setStep] = useState<SignupStep>('email')
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<'startup' | 'sme'>('startup')
  const [isEu, setIsEu] = useState(false)
  const [country, setCountry] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  // Progress indicator
  const steps = [
    { id: 'email', label: 'Account' },
    { id: 'plan', label: 'Plan' },
    ...(isEu ? [{ id: 'dpa', label: 'DPA' }] : []),
    { id: 'payment', label: 'Payment' }
  ]

  const currentStepIndex = steps.findIndex(s => s.id === step)

  // Step 1: Email signup
  const handleEmailSignup = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Signup failed')
      }

      const data = await response.json()

      setEmail(email)
      setUserId(data.user.id)
      setWorkspaceId(data.workspace.id)
      setIsEu(data.isEu || false)
      setCountry(data.country || '')
      setStep('plan')

    } catch (err) {
      throw err // Let EmailSignupForm handle the error
    }
  }

  // Step 2: Plan selection
  const handlePlanSelected = (plan: 'startup' | 'sme') => {
    setSelectedPlan(plan)

    if (isEu) {
      setStep('dpa')  // EU customers: sign DPA first
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

    // Redirect to workspace after brief success message
    setTimeout(() => {
      router.push(`/workspace/${workspaceId}`)
    }, 2000)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
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
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-200 text-slate-500'
                    }
                  `}>
                    {index < currentStepIndex ? (
                      <CheckCircle className="h-6 w-6" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className={`text-xs mt-2 ${
                    index <= currentStepIndex ? 'text-indigo-600 font-medium' : 'text-slate-500'
                  }`}>
                    {s.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 ${
                    index < currentStepIndex ? 'bg-indigo-600' : 'bg-slate-200'
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
              showEuBadge={isEu}
            />
          </motion.div>
        )}

        {/* Step 3: DPA Signing (EU only) */}
        {step === 'dpa' && (
          <motion.div
            key="dpa"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-4xl"
          >
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
              <p className="text-sm text-blue-800">
                <strong>🇪🇺 EU/EEA/UK Customer Detected</strong>
                <br />
                As a customer in {country.toUpperCase()}, please review and sign our Data Processing Agreement before proceeding to payment setup.
              </p>
            </div>
            <DpaSigningModal
              isOpen={true}
              workspaceId={workspaceId}
              onClose={() => {}}  // Can't skip - required for EU customers
              onSuccess={handleDpaSigned}
            />
          </motion.div>
        )}

        {/* Step 4: Payment Setup */}
        {step === 'payment' && (
          <motion.div
            key="payment"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <StripePaymentSetup
              plan={selectedPlan}
              workspaceId={workspaceId}
              userId={userId}
              onSuccess={handlePaymentSetup}
            />
          </motion.div>
        )}

        {/* Step 5: Complete */}
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
            <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Welcome to SAM AI! 🎉
            </h2>
            <p className="text-slate-600 mb-4">
              Your 14-day trial has started.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Redirecting to your workspace...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
