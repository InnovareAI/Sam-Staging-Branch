'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'

interface EmailSignupFormProps {
  onSuccess: (email: string, password: string, userId: string, workspaceId?: string, userData?: { firstName: string, lastName: string, companyName: string }) => Promise<void>
  inviteToken?: string
}

export default function EmailSignupForm({ onSuccess, inviteToken }: EmailSignupFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyWebsite, setCompanyWebsite] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submitted!', { firstName, lastName, email, companyName, companyWebsite })
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

    // Validate company name
    if (!companyName || !companyName.trim()) {
      setError('Company name is required')
      setLoading(false)
      return
    }

    // Validate company website
    if (!companyWebsite || !companyWebsite.trim()) {
      setError('Company website is required')
      setLoading(false)
      return
    }

    // Validate URL format
    try {
      const url = new URL(companyWebsite.startsWith('http') ? companyWebsite : `https://${companyWebsite}`)
      // Check if it's a valid business domain (not personal email domains)
      const domain = url.hostname.toLowerCase()
      const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com']
      if (personalDomains.some(d => domain.includes(d))) {
        setError('Please enter a business website URL (not a personal email domain)')
        setLoading(false)
        return
      }
    } catch (urlError) {
      setError('Please enter a valid website URL (e.g., yourcompany.com)')
      setLoading(false)
      return
    }

    try {
      // Call API directly instead of using onSuccess callback
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          companyName,
          companyWebsite: companyWebsite.startsWith('http') ? companyWebsite : `https://${companyWebsite}`,
          inviteToken
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Signup failed')
      }

      const data = await response.json()

      // Pass userId, workspaceId, and user data to move to next step
      await onSuccess(email, password, data.user.id, data.workspace?.id, {
        firstName,
        lastName,
        companyName
      })
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
          <CardTitle className="text-3xl font-semibold text-gray-900">Start Your 14-Day Trial</CardTitle>
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

          <div>
            <Input
              id="companyName"
              type="text"
              placeholder="Company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <Input
              id="companyWebsite"
              type="url"
              placeholder="Company website (e.g., yourcompany.com)"
              value={companyWebsite}
              onChange={(e) => setCompanyWebsite(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full bg-[#8907FF] hover:bg-[#6600FF] text-foreground" disabled={loading}>
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
