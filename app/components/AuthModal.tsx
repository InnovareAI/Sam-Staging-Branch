'use client';

import React, { useState } from 'react';
import { useSignIn, useSignUp } from '@clerk/nextjs';
import { X, Mail, ArrowRight, Loader2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'sign-in' | 'sign-up';
  onModeSwitch: () => void;
}

export function AuthModal({ isOpen, onClose, mode, onModeSwitch }: AuthModalProps) {
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInLoaded || !signIn) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      // Create sign-in with email
      const result = await signIn.create({
        identifier: email,
      });
      
      // Send the email magic link
      const emailMagicLink = await signIn.prepareFirstFactor({
        strategy: 'email_link',
        emailAddressId: result.supportedFirstFactors.find(
          factor => factor.strategy === 'email_link'
        )?.emailAddressId!,
        redirectUrl: typeof window !== 'undefined' ? window.location.origin : 'https://app.meet-sam.com'
      });
      
      // Show success message
      setError('Check your email for the sign-in link!');
      
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpLoaded || !signUp) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      // Create the sign-up
      await signUp.create({
        emailAddress: email,
      });
      
      // Send email verification
      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code'
      });
      
      setPendingVerification(true);
      
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Failed to sign up');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpLoaded || !signUp) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });
      
      if (result.status === 'complete') {
        // Set active session
        await window.location.reload();
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative z-10 w-full max-w-md">
        <div className="relative bg-gray-800 rounded-2xl shadow-2xl p-8">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>

          {/* Logo and Title */}
          <div className="text-center mb-8">
            <img 
              src="/SAM.jpg" 
              alt="SAM AI" 
              className="w-20 h-20 rounded-full mx-auto mb-4 object-cover"
              style={{ objectPosition: 'center 30%' }}
            />
            <h2 className="text-2xl font-bold text-white">
              {mode === 'sign-in' ? 'Welcome Back' : 'Join SAM AI'}
            </h2>
            <p className="text-gray-400 mt-2">
              {mode === 'sign-in' 
                ? 'Sign in to continue to your dashboard' 
                : 'Create your account to get started'}
            </p>
          </div>

          {/* Form */}
          {!pendingVerification ? (
            <form onSubmit={mode === 'sign-in' ? handleSignIn : handleSignUp}>
              <div className="mb-6">
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-700 text-white pl-10 pr-4 py-3 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-colors"
                    placeholder="you@company.com"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              {error && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${
                  error.includes('Check your email') 
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    {mode === 'sign-in' ? 'Send Sign-In Link' : 'Continue'}
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerification}>
              <div className="mb-6">
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Verification Code
                </label>
                <p className="text-gray-400 text-sm mb-4">
                  We sent a verification code to {email}
                </p>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-colors text-center text-lg tracking-widest"
                  placeholder="000000"
                  required
                  disabled={isLoading}
                  maxLength={6}
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 text-red-400 rounded-lg text-sm border border-red-500/20">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !verificationCode}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    Verify Email
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-gray-700 text-center">
            <p className="text-gray-400 text-sm">
              {mode === 'sign-in' ? "Don't have an account? " : "Already have an account? "}
              <button 
                onClick={() => {
                  onModeSwitch();
                  setEmail('');
                  setError('');
                  setPendingVerification(false);
                  setVerificationCode('');
                }}
                className="text-purple-400 hover:text-purple-300 font-medium"
              >
                {mode === 'sign-in' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}