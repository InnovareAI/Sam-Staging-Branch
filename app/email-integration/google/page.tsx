'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, ExternalLink, AlertCircle, Loader2, RefreshCw, Shield, Mail } from 'lucide-react';

// Google Logo Component
const GoogleLogo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

function GoogleIntegrationContent() {
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
          setMessage('Please sign in to connect your Google account.');
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
      setMessage(`Google account connected successfully! ${accountId ? `Account ID: ${accountId}` : ''}`);
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
        const googleAccounts = data.providers?.filter((p: any) => p.provider_type === 'google') || [];
        setConnectionStatus(googleAccounts.length > 0 ? 'connected' : 'disconnected');
        if (googleAccounts.length > 0) {
          setMessage(`You have ${googleAccounts.length} Google account(s) connected.`);
        } else {
          setMessage('No Google accounts connected yet.');
        }
        return googleAccounts.length > 0;
      } else {
        setConnectionStatus('disconnected');
        setMessage('Ready to connect your Google account.');
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
          provider: 'GOOGLE',
          type: 'MESSAGING'
        })
      });
      
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate authentication link');
      }
      
      setMessage('Opening Google authentication...');
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
              <span className="text-lg font-medium">Google Connected</span>
            </div>

            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6">
              <h3 className="text-white font-medium mb-3">Available Features</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 text-green-300">
                  <Mail className="w-5 h-5" />
                  <span>Send emails through Gmail</span>
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
              <h3 className="text-white font-medium mb-3">Connect Google Account</h3>
              <p className="text-gray-400 mb-4">
                Connect your Gmail or Google Workspace account securely using Google's official OAuth.
              </p>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center space-x-3 text-gray-300">
                  <Shield className="w-5 h-5 text-green-400" />
                  <span>Secure Google OAuth</span>
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
                    <GoogleLogo size={16} />
                    <span>Connect Google Account</span>
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
          <GoogleLogo size={60} />
          <h1 className="text-2xl font-bold text-white mt-4 mb-3">Google Integration</h1>
          <p className="text-gray-400 mb-6">Please sign in to connect your Google account.</p>
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
            <GoogleLogo size={48} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Google Integration</h1>
          <p className="text-gray-400">Connect your Gmail or Google Workspace account</p>
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

export default function GoogleIntegrationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>}>
      <GoogleIntegrationContent />
    </Suspense>
  );
}
