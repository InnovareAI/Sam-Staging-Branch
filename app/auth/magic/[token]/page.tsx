'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { motion } from 'framer-motion'

/**
 * Magic Link Login Page
 *
 * One-time use magic link for 3cubed enterprise customers
 * Auto-logs in user and redirects to password setup
 */
export default function MagicLinkPage() {
  const params = useParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Verifying your magic link...')

  useEffect(() => {
    const verifyMagicLink = async () => {
      try {
        const token = params.token as string

        // Verify and consume magic link token
        const response = await fetch('/api/auth/magic-link/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })

        const data = await response.json()

        if (!response.ok) {
          setStatus('error')
          setMessage(data.error || 'Invalid or expired magic link')
          return
        }

        // Magic link verified! User is now logged in
        setStatus('success')
        setMessage('Login successful! Redirecting to password setup...')

        // Redirect to password setup after 1.5 seconds
        setTimeout(() => {
          router.push('/auth/setup-password')
        }, 1500)

      } catch (error) {
        console.error('Magic link verification error:', error)
        setStatus('error')
        setMessage('Failed to verify magic link')
      }
    }

    if (params.token) {
      verifyMagicLink()
    }
  }, [params.token, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <Card className="w-full max-w-md shadow-xl">
        <CardContent className="pt-12 pb-12 text-center">
          {status === 'loading' && (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="mx-auto mb-4"
              >
                <Loader2 className="h-16 w-16 text-indigo-600" />
              </motion.div>
              <h1 className="text-2xl font-bold mb-2">Verifying Login</h1>
              <p className="text-slate-600">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              </motion.div>
              <h1 className="text-2xl font-bold mb-2 text-green-900">{message}</h1>
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500 mt-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Redirecting...</span>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2 text-red-900">Login Failed</h1>
              <p className="text-slate-600 mb-6">{message}</p>
              <p className="text-sm text-slate-500">
                Please contact your administrator for a new invitation link.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
