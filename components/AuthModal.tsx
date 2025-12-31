'use client';

import React, { useState } from 'react';
import { X, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import {
  getFirebaseAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from '@/lib/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Auth Modal for app.meet-sam.com
 * Firebase Authentication - Sign In ONLY
 */
export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setEmail('');
      setPassword('');
      setError('');
      setSuccess('');
      setLoading(false);
      setShowPasswordReset(false);
      setResetEmail('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getErrorMessage = (code: string): string => {
    const messages: Record<string, string> = {
      'auth/invalid-email': 'Invalid email address',
      'auth/user-disabled': 'This account has been disabled',
      'auth/user-not-found': 'No account found with this email',
      'auth/wrong-password': 'Invalid email or password',
      'auth/invalid-credential': 'Invalid email or password',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
    };
    return messages[code] || 'Sign-in failed. Please try again.';
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const auth = getFirebaseAuth();
      const result = await signInWithEmailAndPassword(auth, email, password);

      // Get ID token and create server session
      const idToken = await result.user.getIdToken();

      const response = await fetch('/api/auth/firebase-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (response.ok) {
        setSuccess('Sign-in successful! Redirecting...');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        const data = await response.json();
        setError(data.error || 'Session creation failed');
      }
    } catch (err: any) {
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const auth = getFirebaseAuth();
      await sendPasswordResetEmail(auth, resetEmail);
      setSuccess('✅ Password reset email sent! Check your email and click the link to reset your password.');
    } catch (err: any) {
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-muted rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative p-6 pb-4">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X size={24} />
          </button>

          <div className="text-center">
            <img
              src="/SAM.jpg"
              alt="SAM AI"
              className="w-20 h-20 rounded-full object-cover mx-auto mb-4 shadow-lg"
              style={{ objectPosition: 'center 30%' }}
            />
            <h1 className="text-2xl font-semibold text-white mb-2">
              {showPasswordReset
                ? (success ? 'Check Your Email' : 'Reset Password')
                : 'Welcome Back'
              }
            </h1>
            <p className="text-gray-400 text-sm">
              {showPasswordReset
                ? (success ? 'We sent you an email with instructions' : 'Enter your email to reset password')
                : 'Sign in to your Sales Agent Platform'
              }
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="px-6 pb-6">
          {showPasswordReset ? (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              {!success && (
                <>
                  <div>
                    <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-300 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="email"
                        id="resetEmail"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Enter your email"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !resetEmail}
                    className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-red-400 disabled:to-red-500 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Sending...' : '🔑 Send Password Reset'}
                  </button>
                </>
              )}

              {error && (
                <div className="p-3 bg-red-600 bg-opacity-20 border border-red-500 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-4 bg-green-600 bg-opacity-20 border border-green-500 rounded-lg text-green-400 text-sm">
                  {success}
                </div>
              )}

              <div className="text-center pt-4 border-t border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordReset(false);
                    setResetEmail('');
                    setError('');
                    setSuccess('');
                  }}
                  className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignIn} className="space-y-4">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-12 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-600 bg-opacity-20 border border-red-500 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-600 bg-opacity-20 border border-green-500 rounded-lg text-green-400 text-sm">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:from-purple-400 disabled:to-purple-500 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <div className="text-center pt-4 border-t border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordReset(true);
                    setError('');
                    setSuccess('');
                  }}
                  className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
                >
                  Forgot your password?
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}