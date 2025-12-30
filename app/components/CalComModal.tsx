'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, Loader2, CheckCircle, AlertCircle, ExternalLink, Trash2, Link } from 'lucide-react';
import { createClient } from '@/app/lib/supabase';

interface CalComModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

interface CalComAccount {
  id: string;
  account_type: string;
  account_name: string;
  account_email: string;
  connection_status: string;
  scheduling_url: string;
  created_at: string;
}

export default function CalComModal({ isOpen, onClose, workspaceId }: CalComModalProps) {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [calComAccount, setCalComAccount] = useState<CalComAccount | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadCalComAccount();
    }
  }, [isOpen, workspaceId]);

  const loadCalComAccount = async () => {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('workspace_accounts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('account_type', 'calcom')
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error loading Cal.com account:', fetchError);
      }

      setCalComAccount(data || null);
    } catch (err) {
      console.error('Failed to load Cal.com account:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError('');

    try {
      // Start OAuth flow for Cal.com
      const response = await fetch('/api/integrations/calcom/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Failed to start Cal.com connection');
      }

      // Open Cal.com OAuth in new window
      window.open(data.url, '_blank', 'width=600,height=700');

      // Poll for connection status
      const pollInterval = setInterval(async () => {
        await loadCalComAccount();
        if (calComAccount?.connection_status === 'connected') {
          clearInterval(pollInterval);
        }
      }, 3000);

      // Stop polling after 5 minutes
      setTimeout(() => clearInterval(pollInterval), 300000);

    } catch (err: any) {
      setError(err.message || 'Failed to connect Cal.com');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!calComAccount) return;

    if (!confirm('Are you sure you want to disconnect Cal.com?')) return;

    try {
      const supabase = createClient();
      await supabase
        .from('workspace_accounts')
        .delete()
        .eq('id', calComAccount.id);

      setCalComAccount(null);
    } catch (err) {
      console.error('Failed to disconnect:', err);
      setError('Failed to disconnect Cal.com');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <Link className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Cal.com</h2>
              <p className="text-xs text-muted-foreground">Open-source scheduling</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : calComAccount?.connection_status === 'connected' ? (
            <div className="space-y-4">
              {/* Connected State */}
              <div className="flex items-center gap-3 p-4 bg-green-600/10 border border-green-600/30 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <div>
                  <div className="font-medium text-green-400">Connected</div>
                  <div className="text-sm text-muted-foreground">
                    {calComAccount.account_email || calComAccount.account_name || 'Cal.com'}
                  </div>
                </div>
              </div>

              {calComAccount.scheduling_url && (
                <div className="p-3 bg-secondary/50 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Scheduling URL</div>
                  <a
                    href={calComAccount.scheduling_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline break-all"
                  >
                    {calComAccount.scheduling_url}
                  </a>
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                Your Cal.com is connected. The Meeting Agent will:
                <ul className="mt-2 space-y-1 ml-4 list-disc">
                  <li>Detect Cal.com links in prospect messages</li>
                  <li>Auto-book meetings when prospects share availability</li>
                  <li>Receive booking notifications via webhooks</li>
                  <li>Sync meeting status and updates</li>
                </ul>
              </div>

              <button
                onClick={handleDisconnect}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-400 border border-red-600/30 hover:bg-red-600/10 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Not Connected State */}
              <div className="text-sm text-muted-foreground">
                Connect your Cal.com to enable the Meeting Agent to:
                <ul className="mt-2 space-y-1 ml-4 list-disc">
                  <li>Automatically detect Cal.com links in messages</li>
                  <li>Book meetings on behalf of prospects</li>
                  <li>Receive real-time booking notifications</li>
                  <li>Handle cancellations and reschedules</li>
                </ul>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-600/10 border border-red-600/30 rounded-lg text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
              >
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4" />
                    Connect Cal.com
                  </>
                )}
              </button>

              <p className="text-xs text-center text-muted-foreground">
                You'll be redirected to Cal.com to authorize access
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full bg-secondary hover:bg-secondary/80 font-medium py-2 px-4 rounded-lg text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
