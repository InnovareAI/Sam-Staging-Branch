'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabase';

function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for error and info messages in URL params
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');

    if (messageParam && !errorParam) {
      // Info message (not an error)
      setSuccess(decodeURIComponent(messageParam));
    } else if (errorParam === 'reset_expired' && messageParam) {
      setError(decodeURIComponent(messageParam));
      setForgotPasswordMode(true);
    } else if (messageParam) {
      // Error with custom message
      setError(decodeURIComponent(messageParam));
    } else if (errorParam) {
      // Generic error
      setError('Authentication error. Please try again.');
    }
  }, [searchParams]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // BULLETPROOF SIGNIN - Try multiple methods to GUARANTEE access
      console.log('🔐 Starting signin process...');

      // Method 1: Direct Supabase client signin (primary method)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Supabase signin error:', error);

        // Method 2: Fallback to API endpoint if Supabase client fails
        console.log('🔄 Trying fallback API signin...');

        const apiResponse = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const apiData = await apiResponse.json();

        if (!apiResponse.ok) {
          setError(apiData.error || error.message);
          return;
        }

        // API signin successful - force page reload to establish session
        console.log('✅ API signin successful - reloading...');
        setSuccess('Sign in successful! Redirecting...');
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
        return;
      }

      if (data.user && data.session) {
        console.log('✅ Sign in successful:', data.user.id);
        console.log('📦 Session data:', {
          access_token: data.session.access_token?.substring(0, 20) + '...',
          refresh_token: data.session.refresh_token?.substring(0, 20) + '...',
          expires_at: new Date(data.session.expires_at! * 1000).toLocaleString()
        });

        // Check cookies immediately after signin
        console.log('🍪 Cookies after signin:', document.cookie);

        setSuccess('Sign in successful! Redirecting...');

        // Force full page reload to ensure session is established
        setTimeout(() => {
          console.log('🔄 Redirecting to home...');
          window.location.href = '/';
        }, 1000);
      } else {
        setError('Sign-in failed - no session created. Please try again.');
      }
    } catch (error) {
      console.error('🚨 Fatal signin error:', error);
      setError('Network error. Please refresh the page and try again.');
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
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🔑 {isResettingPassword ? 'Sending Reset Email...' : 'Send Password Reset Email'}
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
              <button
                type="button"
                onClick={() => setForgotPasswordMode(true)}
                className="text-sm text-purple-400 hover:text-purple-300"
              >
                Forgot Password?
              </button>

              <p className="text-xs text-gray-500">
                Enter your email address above to continue
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}