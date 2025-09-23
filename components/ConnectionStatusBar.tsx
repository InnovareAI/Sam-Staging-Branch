'use client';

import React, { useState, useEffect } from 'react';
import { LinkedinIcon, Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface ConnectionStatus {
  linkedin: {
    connected: boolean;
    loading: boolean;
    accountCount?: number;
    details?: {
      total: number;
      functional: number;
      status: string;
      lastChecked: string;
    };
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
      // Test actual LinkedIn functionality (not just account existence)
      const linkedinResponse = await fetch('/api/linkedin/test-connection', {
        method: 'POST',
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
          connected: linkedinData.functional || false, // Only show connected if actually functional
          loading: false,
          accountCount: linkedinData.functional_count || 0,
          details: linkedinData.success ? {
            total: linkedinData.account_count || 0,
            functional: linkedinData.functional_count || 0,
            status: linkedinData.overall_status,
            lastChecked: linkedinData.last_checked
          } : null
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
    accountCount,
    details 
  }: {
    service: string;
    icon: React.ComponentType<any>;
    connected: boolean;
    loading: boolean;
    accountCount?: number;
    details?: any;
  }) => {
    // For LinkedIn, show more detailed status
    const getLinkedInStatus = () => {
      if (!details) return { text: 'Disconnected', color: 'red', dot: 'bg-red-500' };
      
      switch (details.status) {
        case 'fully_functional':
          return { text: 'Functional', color: 'green', dot: 'bg-green-500 animate-pulse' };
        case 'partially_functional':
          return { text: 'Partial', color: 'yellow', dot: 'bg-yellow-500' };
        case 'all_non_functional':
          return { text: 'Auth Required', color: 'orange', dot: 'bg-orange-500' };
        case 'no_accounts':
          return { text: 'No Accounts', color: 'red', dot: 'bg-red-500' };
        default:
          return { text: 'Unknown', color: 'gray', dot: 'bg-gray-500' };
      }
    };

    const linkedInStatus = service === 'LinkedIn' ? getLinkedInStatus() : null;

    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/50 border border-gray-700/50">
        <Icon className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-300">{service}</span>
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
        ) : (
          <div className="flex items-center gap-1">
            {service === 'LinkedIn' && linkedInStatus ? (
              <>
                <div className={`w-2 h-2 rounded-full ${linkedInStatus.dot}`} />
                <span className={`text-xs text-${linkedInStatus.color}-400 font-medium`}>
                  {linkedInStatus.text}
                </span>
                {details && details.total > 0 && (
                  <span className="text-xs text-gray-400">
                    ({details.functional}/{details.total})
                  </span>
                )}
              </>
            ) : connected ? (
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
  };

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
              details={status.linkedin.details}
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