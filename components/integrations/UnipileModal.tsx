'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, ExternalLink, Loader2, CheckCircle, AlertCircle, Shield } from 'lucide-react';

interface UnipileModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider?: 'LINKEDIN' | 'GOOGLE' | 'OUTLOOK'; // Support LinkedIn and Email providers
  workspaceId?: string; // Required for workspace-scoped account checking
}

export function UnipileModal({ isOpen, onClose, provider = 'LINKEDIN', workspaceId }: UnipileModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [waitingForConfirmation, setWaitingForConfirmation] = useState(false);
  const [pollingStatus, setPollingStatus] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [connectionComplete, setConnectionComplete] = useState(false);

  // Define launchHostedAuth with useCallback so it can be used in useEffect
  const launchHostedAuth = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);
      setSuccess(false);
      setPollError(null);
      setConnectionComplete(false);
      setWaitingForConfirmation(false);
      setPollingStatus(false);

      const response = await fetch('/api/unipile/hosted-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: provider === 'LINKEDIN' ? 'LINKEDIN' : undefined // For email, don't specify provider to show selection
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed with status ${response.status}`);
      }

      if (!data.success || !data.auth_url) {
        throw new Error('Hosted auth link not returned.');
      }

      // Attempt to open the hosted wizard in a pop-up window first
      const authWindow = window.open(
        data.auth_url,
        'unipile_hosted_auth',
        'width=500,height=720,scrollbars=yes,resizable=yes'
      );

      if (!authWindow) {
        // Popup blocked – fall back to redirecting the current tab
        window.location.href = data.auth_url;
      } else {
        setSuccess(true);
        setWaitingForConfirmation(true);
        setPollingStatus(true);
        setPollError(null);
      }
    } catch (err) {
      console.error('Hosted auth launch failed:', err);
      setError(err instanceof Error ? err.message : 'Unable to start Hosted Auth Wizard');
      setWaitingForConfirmation(false);
      setPollingStatus(false);
    } finally {
      setIsConnecting(false);
    }
  }, [provider]);

  useEffect(() => {
    if (!isOpen) {
      setIsConnecting(false);
      setError(null);
      setSuccess(false);
      setWaitingForConfirmation(false);
      setPollingStatus(false);
      setPollError(null);
      setConnectionComplete(false);
    } else {
      // Auto-launch the hosted auth wizard when modal opens
      launchHostedAuth();
    }
  }, [isOpen, launchHostedAuth]);

  useEffect(() => {
    if (!pollingStatus) return;

    let active = true;
    const checkStatus = async () => {
      try {
        // Use workspace-accounts check endpoint for all providers
        // FIXED (Nov 29): Use workspaceId prop instead of localStorage (which used wrong key)
        if (!workspaceId) {
          console.warn('⚠️ UnipileModal: workspaceId prop not provided, skipping status check');
          return;
        }
        const response = await fetch(`/api/workspace-accounts/check?workspace_id=${workspaceId}`);
        if (!response.ok) {
          throw new Error(`Status check failed (${response.status})`);
        }
        const data = await response.json();
        console.log('🔄 Status polling response:', data);
        if (active) {
          const isConnected = provider === 'LINKEDIN'
            ? data.linkedin_connected
            : data.email_connected;

          if (data.success && isConnected) {
            console.log(`✅ ${provider} connection detected, completing modal`);
            setConnectionComplete(true);
            setPollingStatus(false);
            setWaitingForConfirmation(false);
            setPollError(null);
          } else {
            console.log(`⏳ Still waiting for ${provider} connection...`, {
              success: data.success,
              linkedin_connected: data.linkedin_connected,
              email_connected: data.email_connected
            });
          }
        }
      } catch (err) {
        if (active) {
          setPollError(err instanceof Error ? err.message : `Unable to verify ${provider} status`);
        }
      }
    };

    // Immediate check, then interval
    checkStatus();
    const interval = setInterval(checkStatus, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [pollingStatus, workspaceId, provider]);

  useEffect(() => {
    if (!connectionComplete) return;

    setSuccess(true);
    setIsConnecting(false);
    setWaitingForConfirmation(false);
    const timeout = setTimeout(() => {
      onClose();
      window.location.reload();
    }, 1500);

    return () => clearTimeout(timeout);
  }, [connectionComplete, onClose]);

  if (!isOpen) return null;

  // Get display names for UI
  const providerName = provider === 'LINKEDIN' ? 'LinkedIn' : provider === 'GOOGLE' ? 'Google Email' : 'Outlook Email';
  const providerType = provider === 'LINKEDIN' ? 'LinkedIn' : 'Email';

  // Don't render any modal UI - wizard opens directly in popup
  // Only show a small status indicator if there's an error
  if (error) {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-md">
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 shadow-lg dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-200">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={onClose} className="ml-2">
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // No UI shown - wizard opened directly
  return null;
}
