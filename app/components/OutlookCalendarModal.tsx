'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, Loader2, CheckCircle, AlertCircle, ExternalLink, Trash2 } from 'lucide-react';
import { createClient } from '@/app/lib/supabase';

interface OutlookCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

interface CalendarAccount {
  id: string;
  unipile_account_id: string;
  account_type: string;
  account_name: string;
  account_email: string;
  connection_status: string;
  created_at: string;
}

export default function OutlookCalendarModal({ isOpen, onClose, workspaceId }: OutlookCalendarModalProps) {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [calendarAccount, setCalendarAccount] = useState<CalendarAccount | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadCalendarAccount();
    }
  }, [isOpen, workspaceId]);

  const loadCalendarAccount = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await supabase
        .from('workspace_accounts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .in('account_type', ['outlook', 'outlook_calendar', 'microsoft'])
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error loading calendar account:', fetchError);
      }

      setCalendarAccount(data || null);
    } catch (err) {
      console.error('Failed to load calendar account:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError('');

    try {
      // Generate Unipile hosted auth link for Outlook
      const response = await fetch('/api/integrations/outlook-calendar/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Failed to generate connection link');
      }

      // Open Unipile auth in new window
      window.open(data.url, '_blank', 'width=600,height=700');

      // Poll for connection status
      const pollInterval = setInterval(async () => {
        await loadCalendarAccount();
        if (calendarAccount?.connection_status === 'connected') {
          clearInterval(pollInterval);
        }
      }, 3000);

      // Stop polling after 5 minutes
      setTimeout(() => clearInterval(pollInterval), 300000);

    } catch (err: any) {
      setError(err.message || 'Failed to connect Outlook Calendar');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!calendarAccount) return;

    if (!confirm('Are you sure you want to disconnect Outlook Calendar?')) return;

    try {
      await supabase
        .from('workspace_accounts')
        .delete()
        .eq('id', calendarAccount.id);

      setCalendarAccount(null);
    } catch (err) {
      console.error('Failed to disconnect:', err);
      setError('Failed to disconnect Outlook Calendar');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <Calendar className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Outlook Calendar</h2>
              <p className="text-xs text-muted-foreground">Connect Microsoft 365 calendar</p>
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
          ) : calendarAccount?.connection_status === 'connected' ? (
            <div className="space-y-4">
              {/* Connected State */}
              <div className="flex items-center gap-3 p-4 bg-green-600/10 border border-green-600/30 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <div>
                  <div className="font-medium text-green-400">Connected</div>
                  <div className="text-sm text-muted-foreground">
                    {calendarAccount.account_email || calendarAccount.account_name || 'Outlook Calendar'}
                  </div>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                Your Outlook Calendar is connected. The Meeting Agent will:
                <ul className="mt-2 space-y-1 ml-4 list-disc">
                  <li>Check for conflicts before booking</li>
                  <li>Sync booked meetings to your calendar</li>
                  <li>Track meeting attendance</li>
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
                Connect your Outlook Calendar to enable the Meeting Agent to:
                <ul className="mt-2 space-y-1 ml-4 list-disc">
                  <li>Check your availability before booking meetings</li>
                  <li>Automatically add booked meetings to your calendar</li>
                  <li>Send meeting reminders</li>
                  <li>Detect no-shows and trigger follow-ups</li>
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
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
              >
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4" />
                    Connect Outlook Calendar
                  </>
                )}
              </button>

              <p className="text-xs text-center text-muted-foreground">
                You'll be redirected to Microsoft to authorize access
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
