'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const router = useRouter();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Use Supabase client directly for proper session management
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else if (data.user && data.session) {
        console.log('✅ Sign in successful:', data.user.id);
        setSuccess('Sign in successful! Redirecting...');
        
        // Wait a moment for session to be fully established
        setTimeout(() => {
          // Use router.push instead of window.location.href for better state management
          router.push('/');
        }, 1000);
      } else {
        setError('Sign-in failed - no session created');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      console.error('Sign-in error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setError('Please enter your email address first');
      return;
    }

    setIsResettingPassword(true);
    setError('');
    setSuccess('');
    setForgotPasswordMode(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Password reset email sent! Check your inbox.');
      } else {
        setError(data.error || 'Failed to send password reset email');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      setError('Please enter your email address first');
      return;
    }

    setIsSendingMagicLink(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Magic link sent! Check your email to sign in.');
      } else {
        setError(data.error || 'Failed to send magic link');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto flex justify-center">
            <img 
              src="/SAM.jpg" 
              alt="Sam AI" 
              className="w-20 h-20 rounded-full object-cover"
              style={{ objectPosition: 'center 30%' }}
            />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Sign in to SAM AI
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Your intelligent sales assistant
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSignIn}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 placeholder-gray-500 text-white bg-gray-700 focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm ${forgotPasswordMode ? 'rounded-md' : 'rounded-t-md'}`}
                placeholder="Email address"
              />
            </div>
            {!forgotPasswordMode && (
              <div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 placeholder-gray-500 text-white bg-gray-700 rounded-b-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                />
              </div>
            )}
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center">{error}</div>
          )}

          {success && (
            <div className="text-green-400 text-sm text-center">{success}</div>
          )}

          <div>
            {!forgotPasswordMode ? (
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={isResettingPassword}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResettingPassword ? 'Sending...' : 'Send Reset Email'}
                </button>
                <button
                  type="button"
                  onClick={handleMagicLink}
                  disabled={isSendingMagicLink}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSendingMagicLink ? 'Sending...' : 'Send Magic Link'}
                </button>
                <button
                  type="button"
                  onClick={() => setForgotPasswordMode(false)}
                  className="group relative w-full flex justify-center py-2 px-4 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Back to Sign In
                </button>
              </div>
            )}
          </div>

          {!forgotPasswordMode && (
            <div className="text-center space-y-3">
              <div className="flex justify-center space-x-4">
                <button
                  type="button"
                  onClick={() => setForgotPasswordMode(true)}
                  className="text-sm text-purple-400 hover:text-purple-300"
                >
                  Forgot Password?
                </button>
                <span className="text-gray-500">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setForgotPasswordMode(true);
                    handleMagicLink();
                  }}
                  disabled={isSendingMagicLink}
                  className="text-sm text-purple-400 hover:text-purple-300 disabled:opacity-50"
                >
                  {isSendingMagicLink ? 'Sending...' : 'Magic Link'}
                </button>
              </div>
              
              <p className="text-xs text-gray-500">
                Enter your email address above for password-less options
              </p>

              <div className="mt-6 pt-6 border-t border-gray-700">
                <p className="text-sm text-gray-400">
                  Don't have an account?{' '}
                  <a href="/signup" className="text-purple-400 hover:text-purple-300">
                    Sign up here
                  </a>
                </p>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}