'use client';

import React, { useState } from 'react';
import { X, Mail, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'sign-in' | 'sign-up';
  onModeSwitch: () => void;
}

export function AuthModal({ isOpen, onClose, mode, onModeSwitch }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    // Simulate authentication process
    setTimeout(() => {
      setMessage(`Magic link sent to ${email}! Check your email.`);
      setIsLoading(false);
      setEmail('');
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="relative p-6 border-b border-gray-700">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-300 transition-colors"
          >
            <X size={24} />
          </button>
          
          {/* SAM Logo and Title */}
          <div className="flex flex-col items-center">
            <img 
              src="/SAM.jpg" 
              alt="Sam AI" 
              className="w-20 h-20 rounded-full object-cover mb-4"
              style={{ objectPosition: 'center 30%' }}
            />
            <h2 className="text-xl font-semibold text-white">
              {mode === 'sign-in' ? 'Sign In to SAM' : 'Create SAM Account'}
            </h2>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-400"
                placeholder="Enter your email"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          {message && (
            <div className="mb-4 p-3 bg-green-900/20 border border-green-600 rounded-lg text-green-400 text-sm">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
          >
            {isLoading ? (
              <span>Sending...</span>
            ) : (
              <>
                <span>{mode === 'sign-in' ? 'Send Magic Link' : 'Create Account'}</span>
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </button>

          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              {mode === 'sign-in' ? "Don't have an account?" : "Already have an account?"}{' '}
              <button
                type="button"
                onClick={onModeSwitch}
                className="text-purple-400 hover:text-purple-300 font-medium"
              >
                {mode === 'sign-in' ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}