'use client';

import React, { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { X, Eye, EyeOff, Mail, Lock, User } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Auth Modal for app.meet-sam.com
 *
 * Sign In ONLY - no signup option
 * - For InnovareAI trial signup: Use /signup/innovareai
 * - For 3cubed enterprise: Admin sends magic link
 *
 * Available options:
 * 1. Email/Password Sign In
 * 2. Password Reset
 * 3. Magic Link Sign In
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

  const supabase = createClientComponentClient();

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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Sign-in successful! Redirecting...');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        setError(data.error || 'Sign-in failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
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
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: resetEmail })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('✅ Password reset email sent! Check your email and click the link to reset your password.');
        // Keep user on password reset form - don't switch back to main form
        // User can click "Back to Sign In" when ready
      } else {
        setError(data.error || 'Password reset failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (emailToUse: string) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailToUse })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('✨ Magic link sent! Check your email and click the link to instantly sign in.');
      } else {
        setError(data.error || 'Magic link failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
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
            <h1 className="text-2xl font-bold text-white mb-2">
              {showPasswordReset
                ? (success ? 'Check Your Email' : 'Reset Password')
                : 'Welcome Back'
              }
            </h1>
            <p className="text-gray-400 text-sm">
              {showPasswordReset
                ? (success ? 'We sent you an email with instructions' : 'Enter your email to reset password or get magic link')
                : 'Sign in to your Sales Agent Platform'
              }
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="px-6 pb-6">
          {showPasswordReset ? (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              {/* Only show form fields if no success message */}
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

                  <div className="text-center text-gray-500 text-sm py-2">or</div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!resetEmail) {
                        setError('Please enter your email address first');
                        return;
                      }
                      handleMagicLink(resetEmail);
                    }}
                    disabled={loading || !resetEmail}
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-green-400 disabled:to-green-500 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Sending...' : '✨ Send Magic Link'}
                  </button>
                  <p className="text-gray-500 text-xs text-center mt-2">No password needed - instant access via email</p>
                </>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-600 bg-opacity-20 border border-red-500 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Success Message */}
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

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-600 bg-opacity-20 border border-red-500 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-3 bg-green-600 bg-opacity-20 border border-green-500 rounded-lg text-green-400 text-sm">
                {success}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:from-purple-400 disabled:to-purple-500 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            {/* Forgot Password Link Only */}
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