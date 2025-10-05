'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'

interface EmailSignupFormProps {
  onSuccess: (email: string, password: string, userId: string, workspaceId?: string) => Promise<void>
  inviteToken?: string
}

export default function EmailSignupForm({ onSuccess, inviteToken }: EmailSignupFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submitted!', { firstName, lastName, email, password })
    setLoading(true)
    setError('')

    // Validate all fields
    if (!firstName || !firstName.trim()) {
      setError('First name is required')
      setLoading(false)
      return
    }

    if (!lastName || !lastName.trim()) {
      setError('Last name is required')
      setLoading(false)
      return
    }

    if (!email || !email.trim()) {
      setError('Email is required')
      setLoading(false)
      return
    }

    if (!password || !password.trim()) {
      setError('Password is required')
      setLoading(false)
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      setLoading(false)
      return
    }

    // Validate password
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      setLoading(false)
      return
    }

    try {
      // Call API directly instead of using onSuccess callback
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName, inviteToken })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Signup failed')
      }

      const data = await response.json()

      // Pass userId and workspaceId to move to next step
      await onSuccess(email, password, data.user.id, data.workspace?.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md shadow-xl bg-white border-0">
      <CardHeader className="text-center space-y-4">
        <div className="mx-auto flex justify-center">
          <img
            src="/SAM.jpg"
            alt="Sam AI"
            className="w-20 h-20 rounded-full object-cover"
            style={{ objectPosition: 'center 30%' }}
          />
        </div>
        <div>
          <CardTitle className="text-3xl font-bold text-gray-900">Start Your 14-Day Trial</CardTitle>
          <CardDescription className="text-base mt-2 text-gray-700">
            No credit card charge until trial ends
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                id="firstName"
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <Input
                id="lastName"
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <Input
              id="password"
              type="password"
              placeholder="Create a password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full bg-[#8907FF] hover:bg-[#6600FF] text-white" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Continue to Plan Selection'
            )}
          </Button>

          <p className="text-xs text-center text-gray-700">
            By signing up, you agree to our{' '}
            <a href="https://innovareai.com/terms-of-service/" target="_blank" rel="noopener noreferrer" className="text-[#8907FF] hover:underline">
              Terms of Service
            </a>
            {' '}and{' '}
            <a href="https://innovareai.com/privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-[#8907FF] hover:underline">
              Privacy Policy
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
