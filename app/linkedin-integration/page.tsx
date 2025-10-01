'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, ExternalLink, AlertCircle, Loader2, RefreshCw, Shield, Users, MessageSquare } from 'lucide-react';

// LinkedIn Logo Component
const LinkedInLogo = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    className={className}
    fill="currentColor"
  >
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

function LinkedInIntegrationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected' | 'error'>('checking');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check authentication first
  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        // Check if this is a successful callback first - if so, skip auth check
        const success = searchParams.get('success');
        if (success === 'true') {
          setIsAuthenticated(true);
          proceedWithLinkedInSetup();
          return;
        }

        const response = await fetch('/api/auth/session', {
          credentials: 'include', // Include cookies for authentication
          cache: 'no-cache',
          headers: { 'Cache-Control': 'no-cache' }
        });
        const data = await response.json();
        
        if (response.ok && data.authenticated) {
          setIsAuthenticated(true);
          // Once authenticated, proceed with LinkedIn check
          proceedWithLinkedInSetup();
        } else {
          setIsAuthenticated(false);
          setMessage('Please sign in to access LinkedIn integration.');
        }
      } catch (error) {
        console.error('Authentication check failed:', error);
        setIsAuthenticated(false);
        setMessage('Authentication check failed. Please try refreshing or signing in again.');
      }
    };

    checkAuthentication();
  }, []);

  // Handle URL parameters from callback and LinkedIn setup
  const proceedWithLinkedInSetup = () => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const status = searchParams.get('status');
    const accountId = searchParams.get('account_id');

    if (success === 'true') {
      console.log('✅ Success callback detected! Account ID:', accountId);
      setMessage(`LinkedIn account connected successfully! ${accountId ? `Account ID: ${accountId}` : ''}`);
      setConnectionStatus('connected');
      setIsAuthenticated(true); // Force authenticated state for successful callbacks
      // Don't check API status - we know it's connected from the success callback
      // The callback webhook already stored the account in the database
      return; // Exit early to prevent API check from overriding status
    } else if (error) {
      setMessage(`Error: ${decodeURIComponent(error)}`);
      setConnectionStatus('error');
      return; // Exit early
    } else if (status === 'pending') {
      setMessage('Authentication is still in progress. Please wait...');
      // Poll for status updates
      pollForCompletion();
      return; // Exit early
    }

    // Only check connection status if we're not handling a callback
    checkLinkedInConnection();
  };

  const pollForCompletion = () => {
    const interval = setInterval(async () => {
      const connected = await checkLinkedInConnection();
      if (connected) {
        clearInterval(interval);
        setMessage('LinkedIn account connected successfully!');
        setConnectionStatus('connected');
      }
    }, 3000);

    // Stop polling after 2 minutes
    setTimeout(() => clearInterval(interval), 120000);
  };

  const checkLinkedInConnection = async () => {
    try {
      console.log('🔍 Checking LinkedIn connection status...');
      setConnectionStatus('checking');
      const response = await fetch('/api/unipile/accounts', {
        credentials: 'include' // Include cookies for authentication
      });
      
      console.log('📊 Response status:', response.status);
      
      const data = await response.json();
      console.log('📋 Response data:', data);
      
      if (response.ok && data.success) {
        setConnectionStatus(data.has_linkedin ? 'connected' : 'disconnected');
        if (data.has_linkedin) {
          setMessage(`Great! You have ${data.user_account_count || 1} LinkedIn account(s) connected.`);
          
          // Automatically assign proxy IPs based on account registration country
          try {
            console.log('🌍 Auto-assigning proxy IPs for LinkedIn accounts...');
            const proxyResponse = await fetch('/api/linkedin/assign-proxy-ips', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ force_update: false })
            });
            
            if (proxyResponse.ok) {
              const proxyData = await proxyResponse.json();
              console.log('✅ Proxy IP assignment completed:', proxyData.summary);
              setMessage(`LinkedIn accounts connected! Auto-assigned proxy IPs for ${proxyData.summary?.successful_assignments || 0} accounts.`);
            } else {
              console.warn('⚠️ Proxy assignment failed, but LinkedIn connection successful');
            }
          } catch (proxyError) {
            console.error('❌ Proxy assignment error:', proxyError);
            // Don't fail the whole process if proxy assignment fails
          }
        } else {
          console.log('ℹ️ No LinkedIn accounts found');
          setMessage('No LinkedIn accounts connected to your account.');
        }
        return data.has_linkedin;
      } else {
        console.error('❌ API check failed:', data);
        setConnectionStatus('disconnected'); // Change from 'error' to 'disconnected' to allow retry
        const errorMsg = data.error || 'Failed to check LinkedIn connection status.';
        setMessage(errorMsg);
        // If it's an auth error, show as disconnected not error
        if (response.status === 401 || data.debug_info?.needs_signin) {
          setConnectionStatus('disconnected');
        } else {
          setConnectionStatus('error');
        }
        return false;
      }
    } catch (error) {
      console.error('❌ Connection check failed with exception:', error);
      setConnectionStatus('disconnected'); // Show as disconnected to allow retry
      setMessage('Unable to check LinkedIn status. Please try connecting.');
      return false;
    }
  };

  const handleHostedAuth = async () => {
    try {
      setLoading(true);
      setMessage('Generating secure authentication link...');
      
      const response = await fetch('/api/linkedin/hosted-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate authentication link');
      }
      
      setMessage('Opening LinkedIn authentication in new window...');
      
      // Open Unipile authentication in a new window
      const authWindow = window.open(
        data.auth_url,
        'unipile-auth',
        'width=600,height=700,scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=no,menubar=no'
      );

      if (!authWindow) {
        throw new Error('Popup blocked. Please allow popups and try again.');
      }

      setMessage('Complete LinkedIn authentication in the popup window...');
      
      // Poll for authentication completion
      const pollInterval = setInterval(async () => {
        try {
          // Check if window is closed (user completed or cancelled)
          if (authWindow.closed) {
            clearInterval(pollInterval);
            setMessage('Checking authentication status...');
            
            // Force refresh session first, then check connection
            try {
              await fetch('/api/auth/session', { 
                credentials: 'include',
                cache: 'no-cache',
                headers: { 'Cache-Control': 'no-cache' }
              });
            } catch (e) {
              console.log('Session refresh attempted');
            }
            
            // Wait a moment for session to propagate, then check connection
            setTimeout(async () => {
              const connected = await checkLinkedInConnection();
              if (connected) {
                setMessage('LinkedIn account connected successfully!');
                setConnectionStatus('connected');
                setIsAuthenticated(true); // Force authenticated state
              } else {
                setMessage('Authentication window closed. Please try again if you did not complete the process.');
                setConnectionStatus('disconnected');
              }
              setLoading(false);
            }, 1000);
            return;
          }

          // Try to detect successful redirect in the popup
          try {
            const currentUrl = authWindow.location.href;
            if (currentUrl.includes('/linkedin-integration?success=true')) {
              authWindow.close();
              clearInterval(pollInterval);
              setMessage('LinkedIn account connected successfully!');
              setConnectionStatus('connected');
              setLoading(false);
              // Refresh connection status
              await checkLinkedInConnection();
            }
          } catch (e) {
            // Cross-origin error is expected, continue polling
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 1000);

      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (!authWindow.closed) {
          authWindow.close();
        }
        if (loading) {
          setMessage('Authentication timed out. Please try again.');
          setConnectionStatus('error');
          setLoading(false);
        }
      }, 300000);
      
    } catch (error) {
      console.error('Hosted auth failed:', error);
      setMessage(`Failed to start LinkedIn authentication: ${error.message}`);
      setConnectionStatus('error');
      setLoading(false);
    }
  };

  const handleManualCredentials = () => {
    setMessage('Manual credential entry is deprecated for security. Please use the secure hosted authentication above.');
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect all LinkedIn accounts?')) {
      return;
    }

    try {
      setLoading(true);
      // This would need to be implemented to disconnect accounts
      setMessage('Disconnect functionality coming soon. Please contact support if you need to disconnect your LinkedIn account.');
    } catch (error) {
      console.error('Disconnect failed:', error);
      setMessage('Failed to disconnect LinkedIn account.');
    } finally {
      setLoading(false);
    }
  };

  const renderStatus = () => {
    switch (connectionStatus) {
      case 'checking':
        return (
          <div className="flex items-center space-x-3 text-blue-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Checking LinkedIn connection...</span>
          </div>
        );

      case 'connected':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 text-green-400">
              <CheckCircle className="w-6 h-6" />
              <span className="text-lg font-medium">LinkedIn Connected</span>
            </div>

            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6">
              <h3 className="text-white font-medium mb-3">Available Features</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 text-green-300">
                  <MessageSquare className="w-5 h-5" />
                  <span>Send personalized LinkedIn messages</span>
                </div>
                <div className="flex items-center space-x-3 text-green-300">
                  <Users className="w-5 h-5" />
                  <span>Research prospects and companies</span>
                </div>
                <div className="flex items-center space-x-3 text-green-300">
                  <Shield className="w-5 h-5" />
                  <span>Secure, encrypted connection</span>
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Start Using SAM AI
              </button>
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="px-6 py-3 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-400/50 rounded-lg transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        );

      case 'disconnected':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 text-yellow-400">
              <AlertCircle className="w-6 h-6" />
              <span className="text-lg font-medium">LinkedIn Not Connected</span>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6">
              <h3 className="text-white font-medium mb-3">Connect LinkedIn Account</h3>
              <p className="text-gray-400 mb-4">
                Connect your LinkedIn account securely using LinkedIn's official OAuth.
              </p>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center space-x-3 text-gray-300">
                  <Shield className="w-5 h-5 text-green-400" />
                  <span>Secure LinkedIn authentication</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-300">
                  <Shield className="w-5 h-5 text-green-400" />
                  <span>No credential storage on SAM AI</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-300">
                  <Shield className="w-5 h-5 text-green-400" />
                  <span>LinkedIn official OAuth flow</span>
                </div>
              </div>
              
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mb-6">
                <p className="text-xs text-gray-400">
                  <strong className="text-blue-400">Note:</strong> Your LinkedIn account will be linked to your current SAM account, 
                  even if the LinkedIn email differs from your SAM login email.
                </p>
              </div>

              <button
                onClick={handleHostedAuth}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting to LinkedIn...</span>
                  </>
                ) : (
                  <>
                    <LinkedInLogo size={16} />
                    <span>Connect to LinkedIn</span>
                    <ExternalLink className="w-4 h-4" />
                  </>
                )}
              </button>
              
              <p className="text-xs text-gray-500 mt-3 text-center">
                After completing authentication, your LinkedIn account will be connected automatically
              </p>
            </div>

            <div className="bg-gray-800/50 border border-gray-600/30 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <AlertCircle className="w-5 h-5 text-yellow-400" />
                <span className="text-white font-medium">Manual Credentials Deprecated</span>
              </div>
              <p className="text-gray-400 text-sm mb-3">
                For enhanced security, we now use LinkedIn's official OAuth flow instead of manual credentials.
              </p>
              <button
                onClick={handleManualCredentials}
                className="text-gray-500 hover:text-gray-400 text-sm underline"
              >
                Why can't I enter credentials manually?
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

            <div className="flex space-x-4">
              <button
                onClick={checkLinkedInConnection}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Connection Check</span>
              </button>
              <button
                onClick={handleHostedAuth}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                <LinkedInLogo size={16} />
                <span>Try Authentication Again</span>
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Show loading until authentication is confirmed
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gray-900 py-12 px-4 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-4" />
          <p className="text-gray-400">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show sign-in option
  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-gray-900 py-12 px-4 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-[#0A66C2]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <LinkedInLogo size={40} className="text-[#0A66C2]" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">LinkedIn Integration</h1>
          <p className="text-gray-400 mb-6">Please sign in to access LinkedIn integration features.</p>
          
          {message && (
            <div className="mb-6 bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-yellow-300 text-sm">{message}</p>
            </div>
          )}
          
          <div className="space-y-4">
            <button
              onClick={() => window.location.href = '/api/auth/signin?redirect=/linkedin-integration'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Sign In to Continue
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="w-full text-gray-400 hover:text-gray-300 text-sm underline"
            >
              ← Back to SAM AI
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[#0A66C2]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <LinkedInLogo size={40} className="text-[#0A66C2]" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">LinkedIn Integration</h1>
          <p className="text-gray-400">
            Connect your LinkedIn account to unlock SAM AI's powerful sales features
          </p>
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

export default function LinkedInIntegrationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 py-12 px-4 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading LinkedIn integration...</p>
        </div>
      </div>
    }>
      <LinkedInIntegrationContent />
    </Suspense>
  );
}