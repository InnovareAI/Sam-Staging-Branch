'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function ResetPasswordPage() {
  const supabase = createClientComponentClient();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [validToken, setValidToken] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');

  // Check for active session established by auth callback
  useEffect(() => {
    const initializeSession = async () => {
      try {
        // Check if user already has an active session from the auth callback
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
          setValidToken(false);
          setError('Invalid or expired reset link - please request a new password reset');
          return;
        }

        if (session && session.user) {
          // Valid session exists - user can reset password
          setValidToken(true);
          setEmail(session.user.email || 'your account');
          console.log('✅ Active recovery session found for:', session.user.email);
        } else {
          // No session found
          setValidToken(false);
          setError('Invalid reset link - please request a new password reset');
        }
      } catch (err) {
        console.error('Session check error:', err);
        setValidToken(false);
        setError('Failed to validate session - please request a new password reset');
      }
    };

    initializeSession();
  }, [supabase]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Use Supabase auth to update password directly
      // This works with the recovery token from the URL hash
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        throw updateError;
      }

      setMessage('✅ Password updated successfully! Redirecting to your dashboard...');
      setError('');
      setTimeout(() => {
        window.location.href = '/';  // Redirect to main app - user is already authenticated
      }, 2000);
    } catch (err) {
      console.error('Password reset error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (validToken === false) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto bg-gray-800 rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <img 
              src="/SAM.jpg" 
              alt="SAM AI" 
              className="w-16 h-16 rounded-full object-cover mx-auto mb-4" 
              style={{ objectPosition: 'center 30%' }}
            />
            <h1 className="text-2xl font-bold text-white">Invalid Reset Link</h1>
            <p className="text-gray-400">This password reset link is invalid or has expired</p>
          </div>
          
          <div className="p-4 bg-red-600 text-white rounded-lg mb-6">
            {error}
          </div>
          
          <div className="text-center">
            <a href="/api/auth/reset-password" className="text-purple-400 hover:text-purple-300">
              Request a new password reset
            </a>
            <br />
            <a href="/api/auth/signin" className="text-gray-400 hover:text-gray-300 text-sm mt-2 inline-block">
              Back to sign in
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (validToken === null) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto bg-gray-800 rounded-lg shadow-xl p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-gray-400 mt-4">Validating reset link...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="max-w-md w-full mx-auto bg-gray-800 rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <img 
            src="/SAM.jpg" 
            alt="SAM AI" 
            className="w-16 h-16 rounded-full object-cover mx-auto mb-4" 
            style={{ objectPosition: 'center 30%' }}
          />
          <h1 className="text-2xl font-bold text-white">Reset Your Password</h1>
          <p className="text-gray-400">Enter your new password for {email}</p>
        </div>
        
        <form onSubmit={handlePasswordReset} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              New Password
            </label>
            <input 
              type="password" 
              id="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter new password (min 6 characters)"
            />
          </div>
          
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
              Confirm New Password
            </label>
            <input 
              type="password" 
              id="confirmPassword" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Confirm new password"
            />
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
        
        {error && (
          <div className="mt-4 p-4 bg-red-600 text-white rounded-lg">
            {error}
          </div>
        )}
        
        {message && (
          <div className="mt-4 p-4 bg-green-600 text-white rounded-lg">
            {message}
          </div>
        )}
        
        <div className="text-center mt-6">
          <p className="text-gray-400 text-sm">
            Remember your password? 
            <a href="/api/auth/signin" className="text-purple-400 hover:text-purple-300 ml-1">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}