'use client';

import React, { useState } from 'react';
import { X, CheckCircle, Mail, Shield, Users, MessageSquare } from 'lucide-react';

interface EmailProvidersOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

// Google Logo Component
const GoogleLogo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

// Microsoft Logo Component
const MicrosoftLogo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path fill="#f25022" d="M0 0h11.5v11.5H0z" />
    <path fill="#00a4ef" d="M12.5 0H24v11.5H12.5z" />
    <path fill="#7fba00" d="M0 12.5h11.5V24H0z" />
    <path fill="#ffb900" d="M12.5 12.5H24V24H12.5z" />
  </svg>
);

export default function EmailProvidersOnboarding({ isOpen, onClose, onComplete }: EmailProvidersOnboardingProps) {
  const [step, setStep] = useState(1);
  const [connecting, setConnecting] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'google' | 'microsoft' | null>(null);
  const [connectionError, setConnectionError] = useState('');

  if (!isOpen) return null;

  const handleConnectProvider = async (provider: 'google' | 'microsoft') => {
    setConnecting(true);
    setConnectionError('');
    setSelectedProvider(provider);
    
    try {
      // Call Unipile hosted auth API to get auth URL
      const response = await fetch('/api/unipile/hosted-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: provider === 'google' ? 'GMAIL' : 'OUTLOOK',
          redirect_url: `${window.location.origin}/api/unipile/hosted-auth/callback`
        })
      });

      const data = await response.json();

      if (data.success && data.url) {
        // Redirect to Unipile hosted auth page
        window.location.href = data.url;
      } else {
        throw new Error(data.error || `Failed to initiate ${provider} authentication`);
      }
    } catch (error) {
      console.error(`Error connecting ${provider}:`, error);
      setConnectionError(`Failed to connect ${provider === 'google' ? 'Google' : 'Microsoft'} account. Please try again.`);
      setConnecting(false);
      setSelectedProvider(null);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Connect Email Account</h2>
            <p className="text-gray-400 mb-6">
              Connect your email account to enable email campaigns and inbox management.
            </p>
            
            <div className="space-y-3 mb-8 text-left">
              <div className="flex items-center space-x-3 text-gray-300">
                <MessageSquare className="w-5 h-5 text-blue-400" />
                <span>Send personalized email campaigns</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-300">
                <Users className="w-5 h-5 text-green-400" />
                <span>Manage conversations in one place</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-300">
                <Shield className="w-5 h-5 text-purple-400" />
                <span>Secure OAuth authentication</span>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <Mail size={16} />
              <span>Choose Email Provider</span>
            </button>

            <button
              onClick={onClose}
              className="w-full text-gray-400 hover:text-gray-300 text-sm mt-3"
            >
              Skip for now
            </button>
          </div>
        );

      case 2:
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-white mb-3">Select Email Provider</h2>
            <p className="text-gray-400 mb-6">
              Choose your email provider to continue with secure OAuth authentication.
            </p>

            <div className="space-y-4 mb-6">
              {/* Google */}
              <button
                onClick={() => handleConnectProvider('google')}
                disabled={connecting}
                className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-surface-muted p-6 rounded-lg transition-colors flex items-center space-x-4 border-2 border-gray-600 hover:border-blue-500"
              >
                <GoogleLogo size={48} />
                <div className="text-left flex-1">
                  <div className="text-white font-medium text-lg">Google</div>
                  <div className="text-gray-400 text-sm">Gmail & Google Workspace</div>
                </div>
                {connecting && selectedProvider === 'google' && (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                )}
              </button>

              {/* Microsoft */}
              <button
                onClick={() => handleConnectProvider('microsoft')}
                disabled={connecting}
                className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-surface-muted p-6 rounded-lg transition-colors flex items-center space-x-4 border-2 border-gray-600 hover:border-blue-500"
              >
                <MicrosoftLogo size={48} />
                <div className="text-left flex-1">
                  <div className="text-white font-medium text-lg">Microsoft</div>
                  <div className="text-gray-400 text-sm">Outlook & Office 365</div>
                </div>
                {connecting && selectedProvider === 'microsoft' && (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                )}
              </button>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-white font-medium text-sm">Secure OAuth Authentication</p>
                  <p className="text-blue-300 text-sm">
                    Your credentials are handled securely through OAuth. SAM never sees or stores your password.
                  </p>
                </div>
              </div>
            </div>

            {connectionError && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4">
                <p className="text-red-300 text-sm">{connectionError}</p>
              </div>
            )}

            <button
              onClick={() => setStep(1)}
              className="w-full text-gray-400 hover:text-gray-300 text-sm"
              disabled={connecting}
            >
              Back
            </button>
          </div>
        );

      case 3:
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-white mb-3">Successfully Connected!</h2>
            <p className="text-gray-400 mb-6">
              Your email account has been connected successfully. You can now use email campaigns and inbox features.
            </p>

            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mb-6">
              <p className="text-green-300 text-sm">
                ✅ <strong>Connected:</strong> Your email account is ready for campaigns, automated sequences, and inbox management.
              </p>
            </div>

            <button
              onClick={onComplete}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <CheckCircle size={16} />
              <span>Start Using Email Features</span>
            </button>

            <button
              onClick={() => setStep(2)}
              className="w-full text-blue-400 hover:text-blue-300 text-sm mt-3"
            >
              Connect Different Account
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-muted rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative p-6">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-200 transition-colors"
            disabled={connecting}
          >
            <X size={24} />
          </button>
          
          {/* Step indicator */}
          <div className="flex justify-center mb-6">
            <div className="flex space-x-2">
              {[1, 2, 3].map((stepNum) => (
                <div
                  key={stepNum}
                  className={`w-2 h-2 rounded-full ${
                    stepNum <= step ? 'bg-blue-500' : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>

          {renderStep()}
        </div>
      </div>
    </div>
  );
}
