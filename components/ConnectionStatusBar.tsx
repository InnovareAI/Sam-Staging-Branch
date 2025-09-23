'use client';

import React, { useState, useEffect } from 'react';
import { LinkedinIcon, Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface ConnectionStatus {
  linkedin: {
    connected: boolean;
    loading: boolean;
    accountCount?: number;
  };
  email: {
    connected: boolean;
    loading: boolean;
    accountCount?: number;
  };
}

export default function ConnectionStatusBar() {
  const [status, setStatus] = useState<ConnectionStatus>({
    linkedin: { connected: false, loading: true },
    email: { connected: false, loading: true }
  });

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      // Check LinkedIn connection status
      const linkedinResponse = await fetch('/api/unipile/accounts', {
        credentials: 'include'
      });
      const linkedinData = await linkedinResponse.json();

      // Check email provider connection status
      const emailResponse = await fetch('/api/email-providers', {
        credentials: 'include'
      });
      const emailData = await emailResponse.json();

      setStatus({
        linkedin: {
          connected: linkedinResponse.ok && linkedinData.success && linkedinData.has_linkedin,
          loading: false,
          accountCount: linkedinData.user_account_count || 0
        },
        email: {
          connected: emailResponse.ok && emailData.success && (emailData.providers?.length > 0),
          loading: false,
          accountCount: emailData.providers?.length || 0
        }
      });
    } catch (error) {
      console.error('Failed to check connection status:', error);
      setStatus({
        linkedin: { connected: false, loading: false },
        email: { connected: false, loading: false }
      });
    }
  };

  const StatusIndicator = ({ 
    service, 
    icon: Icon, 
    connected, 
    loading, 
    accountCount 
  }: {
    service: string;
    icon: React.ComponentType<any>;
    connected: boolean;
    loading: boolean;
    accountCount?: number;
  }) => (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/50 border border-gray-700/50">
      <Icon className="w-4 h-4 text-gray-400" />
      <span className="text-sm font-medium text-gray-300">{service}</span>
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
      ) : (
        <div className="flex items-center gap-1">
          {connected ? (
            <>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-400 font-medium">Connected</span>
              {accountCount && accountCount > 0 && (
                <span className="text-xs text-gray-400">({accountCount})</span>
              )}
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs text-red-400 font-medium">Disconnected</span>
            </>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="border-b border-border/60 bg-gray-900/50 backdrop-blur px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Integration Status
          </span>
          <div className="flex items-center gap-3">
            <StatusIndicator
              service="LinkedIn"
              icon={LinkedinIcon}
              connected={status.linkedin.connected}
              loading={status.linkedin.loading}
              accountCount={status.linkedin.accountCount}
            />
            <StatusIndicator
              service="Email"
              icon={Mail}
              connected={status.email.connected}
              loading={status.email.loading}
              accountCount={status.email.accountCount}
            />
          </div>
        </div>
        
        <button
          onClick={checkConnectionStatus}
          className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
        >
          Refresh Status
        </button>
      </div>
    </div>
  );
}