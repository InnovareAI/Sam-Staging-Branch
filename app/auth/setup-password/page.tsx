'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Lock, Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { getFirebaseAuth, onAuthStateChanged, updatePassword } from '@/lib/firebase'
import type { User } from 'firebase/auth'

/**
 * Password Setup Page
 *
 * Accessible only via magic link authentication (3cubed enterprise customers)
 * User must set their password on first login
 */
export default function SetupPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [validating, setValidating] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    const auth = getFirebaseAuth()
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/')
        return
      }
      setCurrentUser(user)
      setUserEmail(user.email || '')
      setValidating(false)
    })
    return () => unsubscribe()
  }, [router])

  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = []
    if (pwd.length < 8) errors.push('At least 8 characters')
    if (!/[A-Z]/.test(pwd)) errors.push('One uppercase letter')
    if (!/[a-z]/.test(pwd)) errors.push('One lowercase letter')
    if (!/[0-9]/.test(pwd)) errors.push('One number')
    if (!/[^A-Za-z0-9]/.test(pwd)) errors.push('One special character')
    return errors
  }

  const passwordErrors = password ? validatePassword(password) : []
  const passwordsMatch = password && confirmPassword && password === confirmPassword

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (passwordErrors.length > 0) {
      setError('Password does not meet requirements')
      return
    }

    if (!passwordsMatch) {
      setError('Passwords do not match')
      return
    }

    if (!currentUser) {
      setError('Not authenticated')
      return
    }

    setLoading(true)

    try {
      // Update user password using Firebase
      await updatePassword(currentUser, password)

      // Success! Redirect to main SAM interface
      setTimeout(() => {
        router.push('/')
      }, 1500)

    } catch (err) {
      console.error('Password setup error:', err)
      setError(err instanceof Error ? err.message : 'Failed to set password')
      setLoading(false)
    }
  }

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="pt-12 pb-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
            <p className="text-slate-600">Verifying authentication...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
            <Lock className="h-8 w-8 text-indigo-600" />
          </div>
          <CardTitle className="text-2xl text-center">Set Your Password</CardTitle>
          <CardDescription className="text-center">
            Welcome to SAM AI! Please create a secure password for your account.
          </CardDescription>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Account:</strong> {userEmail}
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                New Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password Requirements */}
              {password && (
                <div className="mt-2 space-y-1">
                  {[
                    'At least 8 characters',
                    'One uppercase letter',
                    'One lowercase letter',
                    'One number',
                    'One special character'
                  ].map((req) => {
                    const isMet = !passwordErrors.includes(req)
                    return (
                      <div key={req} className="flex items-center gap-2 text-xs">
                        {isMet ? (
                          <CheckCircle className="h-3 w-3 text-green-600" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-600" />
                        )}
                        <span className={isMet ? 'text-green-700' : 'text-red-700'}>
                          {req}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {confirmPassword && (
                <div className="mt-2">
                  {passwordsMatch ? (
                    <div className="flex items-center gap-2 text-xs text-green-700">
                      <CheckCircle className="h-3 w-3" />
                      <span>Passwords match</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-red-700">
                      <XCircle className="h-3 w-3" />
                      <span>Passwords do not match</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              size="lg"
              disabled={loading || passwordErrors.length > 0 || !passwordsMatch}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up your account...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Set Password & Continue
                </>
              )}
            </Button>

            <p className="text-center text-xs text-slate-500 mt-4">
              After setting your password, you'll have access to SAM AI
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
