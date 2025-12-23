'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Smartphone, 
  Clock, 
  Shield, 
  Wifi,
  ExternalLink,
  MessageSquare,
  HelpCircle
} from 'lucide-react';

interface LinkedInConnectionHubProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface ConnectionStatus {
  stage: 'idle' | 'connecting' | 'waiting_2fa' | 'success' | 'error';
  message: string;
  details?: string;
  action?: 'push_notification' | 'manual_verification' | 'reconnect';
  timestamp: Date;
}

interface LinkedInAccount {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'needs_auth';
  email?: string;
  linkedin_experience?: string;
}

export default function LinkedInConnectionHub({ isOpen, onClose, onComplete }: LinkedInConnectionHubProps) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    stage: 'idle',
    message: 'Ready to connect',
    timestamp: new Date()
  });

  const [accounts, setAccounts] = useState<LinkedInAccount[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [authUrl, setAuthUrl] = useState<string>('');

  // Check initial connection status
  useEffect(() => {
    if (isOpen) {
      checkConnectionStatus();
    }
  }, [isOpen]);

  // Polling for 2FA completion
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    if (polling && connectionStatus.stage === 'waiting_2fa') {
      pollInterval = setInterval(async () => {
        try {
          const response = await fetch('/api/linkedin/status');
          const data = await response.json();
          
          if (data.success && data.has_linkedin) {
            setConnectionStatus({
              stage: 'success',
              message: 'LinkedIn successfully connected!',
              details: `${data.associations?.length || 1} account(s) connected`,
              timestamp: new Date()
            });
            setPolling(false);
            setAccounts(data.associations?.map((assoc: any) => ({
              id: assoc.unipile_account_id || assoc.id,
              name: assoc.account_name || assoc.account_identifier,
              status: assoc.connection_status === 'connected' ? 'active' : 'needs_auth',
              email: assoc.account_identifier
            })) || []);
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 3000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [polling, connectionStatus.stage]);

  const checkConnectionStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/linkedin/status');
      const data = await response.json();

      console.log('🔍 LinkedIn status check:', data); // Debug log

      if (data.success) {
        if (data.has_linkedin && data.associations?.length > 0) {
          setConnectionStatus({
            stage: 'success',
            message: 'LinkedIn connected successfully',
            details: `${data.associations.length} account(s) active`,
            timestamp: new Date()
          });
          setAccounts(data.associations.map((assoc: any) => ({
            id: assoc.unipile_account_id || assoc.id,
            name: assoc.account_name || assoc.account_identifier,
            status: assoc.connection_status === 'connected' ? 'active' : 'needs_auth',
            email: assoc.account_identifier
          })));
        } else {
          setConnectionStatus({
            stage: 'idle',
            message: 'Ready to connect LinkedIn',
            details: 'Connect your LinkedIn account to unlock SAM AI features',
            timestamp: new Date()
          });
        }
      } else {
        setConnectionStatus({
          stage: 'error',
          message: 'Configuration error',
          details: data.error || 'LinkedIn integration not available',
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Status check error:', error);
      setConnectionStatus({
        stage: 'error',
        message: 'Connection check failed',
        details: 'Unable to verify LinkedIn connection status',
        timestamp: new Date()
      });
    }
  }, []);

  const initiateConnection = async () => {
    setIsConnecting(true);
    setConnectionAttempts(prev => prev + 1);
    
    try {
      setConnectionStatus({
        stage: 'connecting',
        message: 'Initiating LinkedIn connection...',
        details: 'Setting up secure authentication',
        timestamp: new Date()
      });

      // Generate a hosted auth wizard link from our backend
      const response = await fetch('/api/linkedin/hosted-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (!data.success || !data.auth_url) {
        throw new Error(data.error || 'Failed to get authentication URL');
      }

      const nextMessage = data.action === 'reconnect'
        ? 'Re-authenticate your LinkedIn session'
        : 'Complete LinkedIn authentication';

      setAuthUrl(data.auth_url);

      // Attempt to open the hosted wizard in a separate window
      const authWindow = window.open(
        data.auth_url,
        'linkedin_auth',
        'width=500,height=700,scrollbars=yes,resizable=yes'
      );

      if (!authWindow) {
        // Popup blocked – fall back to navigating the current tab
        window.location.href = data.auth_url;
        return;
      }

      setConnectionStatus({
        stage: 'waiting_2fa',
        message: nextMessage,
        details: 'Follow the Hosted Auth Wizard in the new window',
        action: 'push_notification',
        timestamp: new Date()
      });

      // Begin polling while the wizard completes authentication
      setPolling(true);

      // Monitor auth window closure to refresh status immediately
      const checkClosed = setInterval(() => {
        if (authWindow.closed) {
          clearInterval(checkClosed);
          setTimeout(() => {
            checkConnectionStatus();
          }, 2000);
        }
      }, 1000);

    } catch (error) {
      console.error('Connection error:', error);
      setConnectionStatus({
        stage: 'error',
        message: 'Connection failed',
        details: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date()
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleReconnect = async (accountId?: string) => {
    // For existing accounts that need re-authentication
    await initiateConnection();
  };

  const runAutoAssociation = async () => {
    try {
      setConnectionStatus({
        stage: 'connecting',
        message: 'Looking for existing LinkedIn accounts...',
        details: 'Checking for accounts that need to be linked',
        timestamp: new Date()
      });

      const response = await fetch('/api/linkedin/auto-associate', { method: 'POST' });
      const data = await response.json();

      if (data.success && data.associations_created > 0) {
        setConnectionStatus({
          stage: 'success',
          message: 'LinkedIn accounts found and connected!',
          details: `Successfully linked ${data.associations_created} existing account(s)`,
          timestamp: new Date()
        });
        
        // Refresh the connection status
        setTimeout(() => {
          checkConnectionStatus();
        }, 1000);
      } else {
        setConnectionStatus({
          stage: 'idle',
          message: 'No existing accounts found',
          details: 'Please connect a new LinkedIn account',
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Auto-association error:', error);
      setConnectionStatus({
        stage: 'error',
        message: 'Account linking failed',
        details: 'Unable to check for existing LinkedIn accounts',
        timestamp: new Date()
      });
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus.stage) {
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'connecting':
        return <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />;
      case 'waiting_2fa':
        return <Smartphone className="w-8 h-8 text-yellow-500 animate-pulse" />;
      case 'error':
        return <AlertCircle className="w-8 h-8 text-red-500" />;
      default:
        return <Shield className="w-8 h-8 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus.stage) {
      case 'success': return 'border-green-500/30 bg-green-900/20';
      case 'connecting': return 'border-blue-500/30 bg-blue-900/20';
      case 'waiting_2fa': return 'border-yellow-500/30 bg-yellow-900/20';
      case 'error': return 'border-red-500/30 bg-red-900/20';
      default: return 'border-gray-500/30 bg-background/20';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#0A66C2]/20 rounded-full flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#0A66C2">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">LinkedIn Connection</h2>
                <p className="text-gray-400 text-sm">Connect your LinkedIn account to SAM AI</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Status Section */}
        <div className="p-6">
          <div className={`border rounded-lg p-4 ${getStatusColor()}`}>
            <div className="flex items-start space-x-3">
              {getStatusIcon()}
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{connectionStatus.message}</h3>
                {connectionStatus.details && (
                  <p className="text-sm text-gray-300 mt-1">{connectionStatus.details}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  {connectionStatus.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>

            {/* 2FA Instructions */}
            {connectionStatus.stage === 'waiting_2fa' && (
              <div className="mt-4 p-3 bg-surface-muted rounded border border-yellow-500/20">
                <h4 className="text-yellow-300 font-medium text-sm mb-2">
                  📱 Complete LinkedIn Authentication
                </h4>
                <div className="space-y-1 text-xs text-gray-300">
                  <p>• Check the LinkedIn authentication window that opened</p>
                  <p>• If you see a 2FA prompt, approve it on your mobile device</p>
                  <p>• Look for LinkedIn app notifications on your phone</p>
                  <p>• SAM AI will detect completion automatically</p>
                </div>
                <div className="flex items-center space-x-2 mt-3 text-yellow-400">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs">Waiting for authentication...</span>
                </div>
              </div>
            )}
          </div>

          {/* Connected Accounts */}
          {accounts.length > 0 && (
            <div className="mt-4">
              <h4 className="text-white font-medium mb-2">Connected Accounts</h4>
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between p-3 bg-surface-muted rounded border border-gray-600">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        account.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                      }`} />
                      <div>
                        <p className="text-white text-sm font-medium">{account.name}</p>
                        {account.email && (
                          <p className="text-gray-400 text-xs">{account.email}</p>
                        )}
                      </div>
                    </div>
                    {account.status !== 'active' && (
                      <button
                        onClick={() => handleReconnect(account.id)}
                        className="text-yellow-400 hover:text-yellow-300 text-xs"
                      >
                        Reconnect
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 mt-6">
            {connectionStatus.stage === 'idle' && (
              <>
                <button
                  onClick={initiateConnection}
                  disabled={isConnecting}
                  className="w-full bg-[#0A66C2] hover:bg-[#0A66C2]/90 disabled:bg-[#0A66C2]/50 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  {isConnecting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  )}
                  <span>Connect New LinkedIn Account</span>
                </button>

                <button
                  onClick={runAutoAssociation}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <Wifi className="w-4 h-4" />
                  <span>Link Existing Account</span>
                </button>
              </>
            )}

            {connectionStatus.stage === 'success' && (
              <button
                onClick={onComplete}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Continue to SAM AI</span>
              </button>
            )}

            {connectionStatus.stage === 'error' && (
              <>
                <button
                  onClick={checkConnectionStatus}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry Connection</span>
                </button>
                
                <button
                  onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>Troubleshooting</span>
                </button>
              </>
            )}

            {connectionStatus.stage === 'waiting_2fa' && authUrl && (
              <div className="space-y-2">
                <button
                  onClick={() => window.open(authUrl, '_blank')}
                  className="w-full bg-[#0A66C2] hover:bg-[#0A66C2]/90 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Hosted Auth Wizard</span>
                </button>
                
                <button
                  onClick={checkConnectionStatus}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Check Status</span>
                </button>
              </div>
            )}
          </div>

          {/* Troubleshooting Section */}
          {showTroubleshooting && (
            <div className="mt-4 p-4 bg-surface-muted rounded border border-gray-600">
              <h4 className="text-white font-medium mb-3">Troubleshooting</h4>
              <div className="space-y-3 text-sm text-gray-300">
                <div>
                  <p className="font-medium text-foreground">If 2FA is stuck:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs mt-1">
                    <li>Check LinkedIn mobile app for notifications</li>
                    <li>Ensure push notifications are enabled</li>
                    <li>Try refreshing the LinkedIn auth window</li>
                    <li>Check if your account was already connected</li>
                  </ul>
                </div>
                
                <div>
                  <p className="font-medium text-foreground">Connection attempts: {connectionAttempts}</p>
                  <p className="text-xs text-gray-400">Multiple attempts may indicate account conflicts</p>
                </div>

                <button
                  onClick={runAutoAssociation}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded text-xs"
                >
                  Check for Existing Connections
                </button>
              </div>
            </div>
          )}

          {/* Connection Info */}
          <div className="mt-4 p-3 bg-surface-muted/50 rounded border border-gray-700">
            <div className="flex items-center space-x-2 text-gray-400 text-xs">
              <Shield className="w-3 h-3" />
              <span>Secure connection via Unipile • Workspace isolated</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}