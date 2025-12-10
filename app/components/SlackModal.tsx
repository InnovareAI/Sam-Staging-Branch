'use client';

import React, { useState, useEffect } from 'react';
import { X, Hash, CheckCircle, ExternalLink, Copy, Check } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

export default function SlackModal({ isOpen, onClose, workspaceId }: SlackModalProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channelName, setChannelName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Check if Slack is already connected
  useEffect(() => {
    if (isOpen) {
      checkSlackConnection();
    }
  }, [isOpen, workspaceId]);

  const checkSlackConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/integrations/slack/status?workspace_id=${workspaceId}`);
      const data = await response.json();

      if (data.success && data.connected) {
        setIsConnected(true);
        setWebhookUrl(data.webhook_url || '');
        setChannelName(data.channel_name || '');
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      console.error('Failed to check Slack connection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!webhookUrl.trim()) {
      toastError('Please enter a Slack webhook URL');
      return;
    }

    if (!webhookUrl.includes('hooks.slack.com')) {
      toastError('Invalid Slack webhook URL');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/integrations/slack/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          webhook_url: webhookUrl,
          channel_name: channelName || '#general'
        })
      });

      const data = await response.json();

      if (data.success) {
        setIsConnected(true);
        toastSuccess('Slack connected successfully!');
      } else {
        toastError(data.error || 'Failed to connect Slack');
      }
    } catch (error) {
      toastError('Failed to connect Slack');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/integrations/slack/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId })
      });

      const data = await response.json();

      if (data.success) {
        setIsConnected(false);
        setWebhookUrl('');
        setChannelName('');
        toastSuccess('Slack disconnected');
      } else {
        toastError(data.error || 'Failed to disconnect Slack');
      }
    } catch (error) {
      toastError('Failed to disconnect Slack');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestMessage = async () => {
    try {
      const response = await fetch('/api/integrations/slack/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId })
      });

      const data = await response.json();

      if (data.success) {
        toastSuccess('Test message sent to Slack!');
      } else {
        toastError(data.error || 'Failed to send test message');
      }
    } catch (error) {
      toastError('Failed to send test message');
    }
  };

  const copyWebhookEndpoint = () => {
    navigator.clipboard.writeText('https://app.meet-sam.com/api/webhooks/slack');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-card border border-border rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
              <Hash className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Slack Integration</h2>
              <p className="text-xs text-muted-foreground">Get notifications in Slack</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : isConnected ? (
            <>
              {/* Connected State */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <div className="font-medium text-green-500">Slack Connected</div>
                  <div className="text-xs text-muted-foreground">Channel: {channelName || 'Not specified'}</div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Notifications you'll receive:</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• New replies from prospects</li>
                  <li>• Campaign status updates</li>
                  <li>• Connection request acceptances</li>
                  <li>• Daily campaign summaries</li>
                </ul>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleTestMessage}
                  className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary font-medium py-2 px-4 rounded-lg text-sm transition-colors"
                >
                  Send Test Message
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={isSaving}
                  className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-medium py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Setup Instructions */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-sm">Setup Instructions:</h3>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Go to your Slack workspace settings</li>
                  <li>Navigate to <strong>Apps</strong> → <strong>Manage</strong> → <strong>Custom Integrations</strong></li>
                  <li>Click <strong>Incoming WebHooks</strong> → <strong>Add Configuration</strong></li>
                  <li>Select the channel for notifications</li>
                  <li>Copy the Webhook URL and paste it below</li>
                </ol>
                <a
                  href="https://api.slack.com/messaging/webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary text-sm hover:underline"
                >
                  Slack Webhooks Documentation <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {/* Webhook URL Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Slack Webhook URL</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Channel Name Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Channel Name (optional)</label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="#sam-notifications"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* SAM Webhook Endpoint (for slash commands) */}
              <div className="space-y-2">
                <label className="text-sm font-medium">SAM Webhook Endpoint (for slash commands)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value="https://app.meet-sam.com/api/webhooks/slack"
                    readOnly
                    className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground"
                  />
                  <button
                    onClick={copyWebhookEndpoint}
                    className="bg-secondary hover:bg-secondary/80 px-3 py-2 rounded-lg transition-colors"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Use this URL when creating Slack slash commands like /sam-status</p>
              </div>

              {/* Connect Button */}
              <button
                onClick={handleSave}
                disabled={isSaving || !webhookUrl.trim()}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Connecting...' : 'Connect Slack'}
              </button>
            </>
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
