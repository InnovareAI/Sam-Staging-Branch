'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, ExternalLink, AlertCircle, Loader2, RefreshCw, Shield, Mail } from 'lucide-react';

// Microsoft Logo Component
const MicrosoftLogo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path fill="#f25022" d="M0 0h11.5v11.5H0z" />
    <path fill="#00a4ef" d="M12.5 0H24v11.5H12.5z" />
    <path fill="#7fba00" d="M0 12.5h11.5V24H0z" />
    <path fill="#ffb900" d="M12.5 12.5H24V24H12.5z" />
  </svg>
);

function MicrosoftIntegrationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected' | 'error'>('checking');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const success = searchParams.get('success');
        if (success === 'true') {
          setIsAuthenticated(true);
          handleCallback();
          return;
        }

        const response = await fetch('/api/auth/session', {
          credentials: 'include',
          cache: 'no-cache'
        });
        const data = await response.json();
        
        if (response.ok && data.authenticated) {
          setIsAuthenticated(true);
          checkEmailConnection();
        } else {
          setIsAuthenticated(false);
          setMessage('Please sign in to connect your Microsoft account.');
        }
      } catch (error) {
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  const handleCallback = () => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const accountId = searchParams.get('account_id');

    if (success === 'true') {
      setMessage(`Microsoft account connected successfully! ${accountId ? `Account ID: ${accountId}` : ''}`);
      setConnectionStatus('connected');
      return;
    } else if (error) {
      setMessage(`Error: ${decodeURIComponent(error)}`);
      setConnectionStatus('error');
      return;
    }

    checkEmailConnection();
  };

  const checkEmailConnection = async () => {
    try {
      setConnectionStatus('checking');
      const response = await fetch('/api/email-providers', {
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        const microsoftAccounts = data.providers?.filter((p: any) => p.provider_type === 'microsoft') || [];
        setConnectionStatus(microsoftAccounts.length > 0 ? 'connected' : 'disconnected');
        if (microsoftAccounts.length > 0) {
          setMessage(`You have ${microsoftAccounts.length} Microsoft account(s) connected.`);
        } else {
          setMessage('No Microsoft accounts connected yet.');
        }
        return microsoftAccounts.length > 0;
      } else {
        setConnectionStatus('disconnected');
        setMessage('Ready to connect your Microsoft account.');
        return false;
      }
    } catch (error) {
      setConnectionStatus('disconnected');
      setMessage('Ready to connect your Google account.');
      return false;
    }
  };

  const handleConnect = async () => {
    try {
      setLoading(true);
      setMessage('Generating secure authentication link...');
      
      const response = await fetch('/api/unipile/hosted-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider: 'OUTLOOK',
          type: 'MESSAGING'
        })
      });
      
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate authentication link');
      }
      
      setMessage('Opening Microsoft authentication...');
      window.location.href = data.auth_url || data.url;
      
    } catch (error: any) {
      setMessage(`Failed: ${error.message}`);
      setConnectionStatus('error');
      setLoading(false);
    }
  };

  const renderStatus = () => {
    switch (connectionStatus) {
      case 'checking':
        return (
          <div className="flex items-center space-x-3 text-blue-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Checking connection...</span>
          </div>
        );

      case 'connected':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 text-green-400">
              <CheckCircle className="w-6 h-6" />
              <span className="text-lg font-medium">Microsoft Connected</span>
            </div>

            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6">
              <h3 className="text-white font-medium mb-3">Available Features</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 text-green-300">
                  <Mail className="w-5 h-5" />
                  <span>Send emails through Outlook</span>
                </div>
                <div className="flex items-center space-x-3 text-green-300">
                  <Shield className="w-5 h-5" />
                  <span>Secure OAuth connection</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => window.location.href = '/'}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Back to SAM AI
            </button>
          </div>
        );

      case 'disconnected':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 text-yellow-400">
              <AlertCircle className="w-6 h-6" />
              <span className="text-lg font-medium">Not Connected</span>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6">
              <h3 className="text-white font-medium mb-3">Connect Microsoft Account</h3>
              <p className="text-gray-400 mb-4">
                Connect your Outlook or Office 365 account securely using Microsoft's official OAuth.
              </p>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center space-x-3 text-gray-300">
                  <Shield className="w-5 h-5 text-green-400" />
                  <span>Secure Microsoft OAuth</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-300">
                  <Shield className="w-5 h-5 text-green-400" />
                  <span>No password storage</span>
                </div>
              </div>

              <button
                onClick={handleConnect}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <MicrosoftLogo size={16} />
                    <span>Connect Microsoft Account</span>
                    <ExternalLink className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 text-red-400">
              <AlertCircle className="w-6 h-6" />
              <span className="text-lg font-medium">Connection Error</span>
            </div>

            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-300 text-sm">{message}</p>
            </div>

            <button
              onClick={handleConnect}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg"
            >
              Try Again
            </button>
          </div>
        );
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gray-900 py-12 px-4 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-gray-900 py-12 px-4 flex items-center justify-center">
        <div className="text-center max-w-md">
          <MicrosoftLogo size={60} />
          <h1 className="text-2xl font-semibold text-white mt-4 mb-3">Microsoft Integration</h1>
          <p className="text-gray-400 mb-6">Please sign in to connect your Microsoft account.</p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 p-4">
            <MicrosoftLogo size={48} />
          </div>
          <h1 className="text-3xl font-semibold text-white mb-3">Microsoft Integration</h1>
          <p className="text-gray-400">Connect your Outlook or Office 365 account</p>
        </div>

        <div className="bg-gray-800 rounded-2xl shadow-2xl p-8">
          {renderStatus()}
          
          {message && (
            <div className="mt-6 bg-gray-700/50 border border-gray-600/30 rounded-lg p-4">
              <p className="text-gray-300 text-sm">{message}</p>
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => window.location.href = '/'}
            className="text-gray-400 hover:text-gray-300 text-sm underline"
          >
            ← Back to SAM AI
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MicrosoftIntegrationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>}>
      <MicrosoftIntegrationContent />
    </Suspense>
  );
}
