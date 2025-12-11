'use client';

import React, { useState, useEffect } from 'react';
import { X, Hash, CheckCircle, ExternalLink, Copy, Check, Settings, MessageSquare, Bell, Zap } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

type ConnectionMode = 'webhook' | 'app';

interface SlackConfig {
  mode: ConnectionMode;
  webhook_url?: string;
  channel_name?: string;
  bot_token?: string;
  signing_secret?: string;
  team_name?: string;
  features_enabled?: {
    notifications: boolean;
    two_way_chat: boolean;
    slash_commands: boolean;
    interactive_buttons: boolean;
  };
}

export default function SlackModal({ isOpen, onClose, workspaceId }: SlackModalProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('webhook');
  const [config, setConfig] = useState<SlackConfig>({ mode: 'webhook' });
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'setup' | 'features' | 'channels'>('setup');

  // Form fields
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channelName, setChannelName] = useState('');
  const [botToken, setBotToken] = useState('');
  const [signingSecret, setSigningSecret] = useState('');

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
        setConnectionMode(data.mode || 'webhook');
        setConfig({
          mode: data.mode || 'webhook',
          webhook_url: data.webhook_url,
          channel_name: data.channel_name,
          bot_token: data.has_bot_token ? '••••••••' : undefined,
          team_name: data.team_name,
          features_enabled: data.features_enabled,
        });
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

  const handleSaveWebhook = async () => {
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
          mode: 'webhook',
          webhook_url: webhookUrl,
          channel_name: channelName || '#general'
        })
      });

      const data = await response.json();

      if (data.success) {
        setIsConnected(true);
        setConnectionMode('webhook');
        toastSuccess('Slack webhook connected!');
      } else {
        toastError(data.error || 'Failed to connect Slack');
      }
    } catch (error) {
      toastError('Failed to connect Slack');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveApp = async () => {
    if (!botToken.trim()) {
      toastError('Please enter your Bot User OAuth Token');
      return;
    }

    if (!botToken.startsWith('xoxb-')) {
      toastError('Invalid bot token. It should start with xoxb-');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/integrations/slack/connect-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          mode: 'app',
          bot_token: botToken,
          signing_secret: signingSecret,
        })
      });

      const data = await response.json();

      if (data.success) {
        setIsConnected(true);
        setConnectionMode('app');
        setConfig({
          ...config,
          team_name: data.team_name,
        });
        toastSuccess('Slack App connected successfully!');
      } else {
        toastError(data.error || 'Failed to connect Slack App');
      }
    } catch (error) {
      toastError('Failed to connect Slack App');
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
        setConfig({ mode: 'webhook' });
        setWebhookUrl('');
        setChannelName('');
        setBotToken('');
        setSigningSecret('');
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-card border border-border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
              <Hash className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Slack Integration</h2>
              <p className="text-xs text-muted-foreground">
                {connectionMode === 'app' ? 'Full two-way communication' : 'Notifications & commands'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : isConnected ? (
            <ConnectedState
              config={config}
              connectionMode={connectionMode}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onTest={handleTestMessage}
              onDisconnect={handleDisconnect}
              isSaving={isSaving}
              copyToClipboard={copyToClipboard}
              copied={copied}
              workspaceId={workspaceId}
            />
          ) : (
            <SetupState
              connectionMode={connectionMode}
              setConnectionMode={setConnectionMode}
              webhookUrl={webhookUrl}
              setWebhookUrl={setWebhookUrl}
              channelName={channelName}
              setChannelName={setChannelName}
              botToken={botToken}
              setBotToken={setBotToken}
              signingSecret={signingSecret}
              setSigningSecret={setSigningSecret}
              onSaveWebhook={handleSaveWebhook}
              onSaveApp={handleSaveApp}
              isSaving={isSaving}
              copyToClipboard={copyToClipboard}
              copied={copied}
            />
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

// ============================================================================
// CONNECTED STATE COMPONENT
// ============================================================================

function ConnectedState({
  config,
  connectionMode,
  activeTab,
  setActiveTab,
  onTest,
  onDisconnect,
  isSaving,
  copyToClipboard,
  copied,
  workspaceId,
}: {
  config: SlackConfig;
  connectionMode: ConnectionMode;
  activeTab: 'setup' | 'features' | 'channels';
  setActiveTab: (tab: 'setup' | 'features' | 'channels') => void;
  onTest: () => void;
  onDisconnect: () => void;
  isSaving: boolean;
  copyToClipboard: (text: string, label: string) => void;
  copied: string | null;
  workspaceId: string;
}) {
  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
        <CheckCircle className="h-5 w-5 text-green-500" />
        <div className="flex-1">
          <div className="font-medium text-green-500">
            {connectionMode === 'app' ? 'Slack App Connected' : 'Slack Webhook Connected'}
          </div>
          <div className="text-xs text-muted-foreground">
            {config.team_name && `Team: ${config.team_name} • `}
            {config.channel_name || 'Channel not specified'}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {connectionMode === 'app' && (
            <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-0.5 rounded-full">
              Two-Way
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
        {(['setup', 'features', 'channels'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 px-3 text-sm rounded-md transition-colors ${
              activeTab === tab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'setup' && (
        <div className="space-y-4">
          {/* Features enabled */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Enabled Features</h3>
            <div className="grid grid-cols-2 gap-2">
              <FeatureBadge icon={Bell} label="Notifications" enabled />
              <FeatureBadge icon={Zap} label="Slash Commands" enabled />
              <FeatureBadge icon={MessageSquare} label="Two-Way Chat" enabled={connectionMode === 'app'} />
              <FeatureBadge icon={Settings} label="Interactive Buttons" enabled={connectionMode === 'app'} />
            </div>
          </div>

          {/* Webhook Endpoint */}
          <div className="space-y-2">
            <label className="text-sm font-medium">SAM Webhook Endpoint</label>
            <div className="flex gap-2">
              <input
                type="text"
                value="https://app.meet-sam.com/api/webhooks/slack"
                readOnly
                className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground"
              />
              <button
                onClick={() => copyToClipboard('https://app.meet-sam.com/api/webhooks/slack', 'webhook')}
                className="bg-secondary hover:bg-secondary/80 px-3 py-2 rounded-lg transition-colors"
              >
                {copied === 'webhook' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use this URL for slash commands and event subscriptions in your Slack app settings
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onTest}
              className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary font-medium py-2 px-4 rounded-lg text-sm transition-colors"
            >
              Send Test Message
            </button>
            <button
              onClick={onDisconnect}
              disabled={isSaving}
              className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-medium py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'features' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Available Notifications</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                New replies from prospects
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Connection request acceptances
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Campaign status updates
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Comment approval requests
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Daily campaign summaries
              </li>
            </ul>
          </div>

          {connectionMode === 'app' && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Slash Commands</h3>
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <code className="text-xs text-primary block">/sam-status</code>
                <code className="text-xs text-primary block">/sam-campaigns</code>
                <code className="text-xs text-primary block">/sam-ask [question]</code>
                <code className="text-xs text-primary block">/sam-help</code>
              </div>
            </div>
          )}

          {connectionMode === 'app' && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Interactive Actions</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Approve/reject comments with buttons</li>
                <li>Approve/reject follow-ups with buttons</li>
                <li>Quick approve with reactions</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {activeTab === 'channels' && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>Channel configuration coming soon. Currently, notifications are sent to the default channel configured during setup.</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="text-sm font-medium mb-2">Current Channel</h4>
            <p className="text-sm text-muted-foreground">{config.channel_name || 'Default channel'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SETUP STATE COMPONENT
// ============================================================================

function SetupState({
  connectionMode,
  setConnectionMode,
  webhookUrl,
  setWebhookUrl,
  channelName,
  setChannelName,
  botToken,
  setBotToken,
  signingSecret,
  setSigningSecret,
  onSaveWebhook,
  onSaveApp,
  isSaving,
  copyToClipboard,
  copied,
}: {
  connectionMode: ConnectionMode;
  setConnectionMode: (mode: ConnectionMode) => void;
  webhookUrl: string;
  setWebhookUrl: (url: string) => void;
  channelName: string;
  setChannelName: (name: string) => void;
  botToken: string;
  setBotToken: (token: string) => void;
  signingSecret: string;
  setSigningSecret: (secret: string) => void;
  onSaveWebhook: () => void;
  onSaveApp: () => void;
  isSaving: boolean;
  copyToClipboard: (text: string, label: string) => void;
  copied: string | null;
}) {
  return (
    <div className="space-y-4">
      {/* Mode Selection */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setConnectionMode('webhook')}
          className={`p-4 rounded-lg border-2 transition-all text-left ${
            connectionMode === 'webhook'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <Bell className="h-5 w-5 mb-2 text-primary" />
          <div className="font-medium text-sm">Simple Webhook</div>
          <div className="text-xs text-muted-foreground">One-way notifications only</div>
        </button>
        <button
          onClick={() => setConnectionMode('app')}
          className={`p-4 rounded-lg border-2 transition-all text-left ${
            connectionMode === 'app'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <MessageSquare className="h-5 w-5 mb-2 text-purple-500" />
          <div className="font-medium text-sm">Full Slack App</div>
          <div className="text-xs text-muted-foreground">Two-way messaging & actions</div>
        </button>
      </div>

      {connectionMode === 'webhook' ? (
        <WebhookSetup
          webhookUrl={webhookUrl}
          setWebhookUrl={setWebhookUrl}
          channelName={channelName}
          setChannelName={setChannelName}
          onSave={onSaveWebhook}
          isSaving={isSaving}
          copyToClipboard={copyToClipboard}
          copied={copied}
        />
      ) : (
        <AppSetup
          botToken={botToken}
          setBotToken={setBotToken}
          signingSecret={signingSecret}
          setSigningSecret={setSigningSecret}
          onSave={onSaveApp}
          isSaving={isSaving}
          copyToClipboard={copyToClipboard}
          copied={copied}
        />
      )}
    </div>
  );
}

// ============================================================================
// WEBHOOK SETUP COMPONENT
// ============================================================================

function WebhookSetup({
  webhookUrl,
  setWebhookUrl,
  channelName,
  setChannelName,
  onSave,
  isSaving,
  copyToClipboard,
  copied,
}: {
  webhookUrl: string;
  setWebhookUrl: (url: string) => void;
  channelName: string;
  setChannelName: (name: string) => void;
  onSave: () => void;
  isSaving: boolean;
  copyToClipboard: (text: string, label: string) => void;
  copied: string | null;
}) {
  return (
    <>
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

      <button
        onClick={onSave}
        disabled={isSaving || !webhookUrl.trim()}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSaving ? 'Connecting...' : 'Connect Webhook'}
      </button>
    </>
  );
}

// ============================================================================
// APP SETUP COMPONENT
// ============================================================================

function AppSetup({
  botToken,
  setBotToken,
  signingSecret,
  setSigningSecret,
  onSave,
  isSaving,
  copyToClipboard,
  copied,
}: {
  botToken: string;
  setBotToken: (token: string) => void;
  signingSecret: string;
  setSigningSecret: (secret: string) => void;
  onSave: () => void;
  isSaving: boolean;
  copyToClipboard: (text: string, label: string) => void;
  copied: string | null;
}) {
  return (
    <>
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 space-y-3">
        <h3 className="font-semibold text-sm text-purple-400">Create a Slack App:</h3>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">api.slack.com/apps</a></li>
          <li>Click <strong>Create New App</strong> → <strong>From scratch</strong></li>
          <li>Name it "SAM AI" and select your workspace</li>
          <li>
            Under <strong>OAuth & Permissions</strong>, add these scopes:
            <div className="bg-muted/50 rounded p-2 mt-1 font-mono text-xs">
              chat:write, chat:write.public, channels:read, users:read, app_mentions:read, im:history, im:read, reactions:read
            </div>
          </li>
          <li>Install the app to your workspace</li>
          <li>Copy the <strong>Bot User OAuth Token</strong> (starts with xoxb-)</li>
          <li>Under <strong>Basic Information</strong>, copy the <strong>Signing Secret</strong></li>
        </ol>
        <a
          href="https://api.slack.com/start/building"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-purple-400 text-sm hover:underline"
        >
          Slack App Documentation <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Event Subscriptions Info */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <h4 className="font-medium text-sm">Event Subscriptions Setup</h4>
        <p className="text-xs text-muted-foreground">
          Enable Events API and set the Request URL to:
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value="https://app.meet-sam.com/api/webhooks/slack"
            readOnly
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground font-mono"
          />
          <button
            onClick={() => copyToClipboard('https://app.meet-sam.com/api/webhooks/slack', 'events')}
            className="bg-secondary hover:bg-secondary/80 px-3 py-2 rounded-lg transition-colors"
          >
            {copied === 'events' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Subscribe to: <code>message.im</code>, <code>app_mention</code>, <code>reaction_added</code>
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Bot User OAuth Token</label>
        <input
          type="password"
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          placeholder="xoxb-..."
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Signing Secret (for security)</label>
        <input
          type="password"
          value={signingSecret}
          onChange={(e) => setSigningSecret(e.target.value)}
          placeholder="Your signing secret"
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Found in Basic Information → App Credentials → Signing Secret
        </p>
      </div>

      <button
        onClick={onSave}
        disabled={isSaving || !botToken.trim()}
        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSaving ? 'Connecting...' : 'Connect Slack App'}
      </button>
    </>
  );
}

// ============================================================================
// FEATURE BADGE COMPONENT
// ============================================================================

function FeatureBadge({ icon: Icon, label, enabled }: { icon: any; label: string; enabled: boolean }) {
  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg ${enabled ? 'bg-green-500/10' : 'bg-muted/50'}`}>
      <Icon className={`h-4 w-4 ${enabled ? 'text-green-500' : 'text-muted-foreground'}`} />
      <span className={`text-xs ${enabled ? 'text-green-500' : 'text-muted-foreground'}`}>{label}</span>
      {enabled && <CheckCircle className="h-3 w-3 text-green-500 ml-auto" />}
    </div>
  );
}
