'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, ExternalLink, Loader2, CheckCircle, AlertCircle, Shield } from 'lucide-react';

interface UnipileModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider?: 'LINKEDIN' | 'GOOGLE' | 'OUTLOOK'; // Support LinkedIn and Email providers
}

export function UnipileModal({ isOpen, onClose, provider = 'LINKEDIN' }: UnipileModalProps) {
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
        const response = await fetch(`/api/workspace-accounts/check?workspace_id=${localStorage.getItem('currentWorkspaceId')}`);
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
  }, [pollingStatus]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="relative mx-4 w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div>
            <p className="text-xs uppercase tracking-wide text-blue-500">Unipile Integration</p>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Connect {providerName} via Hosted Auth</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-6 px-6 py-5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-200">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && !error && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-700 dark:border-green-900/40 dark:bg-green-900/30 dark:text-green-200">
              <CheckCircle size={16} />
              <span>Hosted Auth Wizard opened in a new window. Complete the {providerName} verification to finish linking.</span>
            </div>
          )}

          {waitingForConfirmation && !connectionComplete && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-200">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Waiting for {providerName} to confirm the connection. Keep the Hosted Auth window open until it completes.</span>
            </div>
          )}

          {pollError && !connectionComplete && (
            <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-xs text-yellow-700 dark:border-yellow-900/40 dark:bg-yellow-900/30 dark:text-yellow-200">
              <AlertCircle size={16} />
              <span>{pollError}. We will keep checking.</span>
            </div>
          )}

          {connectionComplete && (
            <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-xs text-green-800 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-100">
              <CheckCircle size={16} />
              <span>{providerName} confirmed! Refreshing your workspace…</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/60">
          <button
            onClick={onClose}
            className="text-sm font-medium text-gray-600 transition hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
          >
            {waitingForConfirmation && !connectionComplete ? 'Cancel & try later' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
