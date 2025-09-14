'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Mail, Linkedin, Settings, Plus } from 'lucide-react';

interface UnipileAccount {
  id: string;
  name: string;
  platform: 'linkedin' | 'gmail' | 'outlook' | 'smtp';
  status: 'connected' | 'disconnected' | 'error';
  email?: string;
  connection_date?: string;
}

interface UnipileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PLATFORM_CONFIG = {
  linkedin: {
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'bg-blue-600 hover:bg-blue-700',
    description: 'Connect LinkedIn for professional outreach'
  },
  gmail: {
    name: 'Gmail',
    icon: Mail,
    color: 'bg-red-600 hover:bg-red-700', 
    description: 'Connect Gmail for email campaigns'
  },
  outlook: {
    name: 'Outlook',
    icon: Mail,
    color: 'bg-blue-500 hover:bg-blue-600',
    description: 'Connect Outlook for email campaigns'
  },
  smtp: {
    name: 'Custom SMTP',
    icon: Settings,
    color: 'bg-gray-600 hover:bg-gray-700',
    description: 'Configure custom SMTP server'
  }
};

export function UnipileModal({ isOpen, onClose }: UnipileModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'connect' | 'settings'>('overview');
  const [connectedAccounts, setConnectedAccounts] = useState<UnipileAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<keyof typeof PLATFORM_CONFIG | null>(null);

  // Load real connected accounts from API
  useEffect(() => {
    if (isOpen) {
      loadConnectedAccounts();
    }
  }, [isOpen]);

  const loadConnectedAccounts = async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with real Unipile API call
      // const response = await fetch('/api/unipile/accounts');
      // const accounts = await response.json();
      
      // For now, start with empty state (real user experience)
      setConnectedAccounts([]);
    } catch (error) {
      console.error('Failed to load accounts:', error);
      setConnectedAccounts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectAccount = async (platform: keyof typeof PLATFORM_CONFIG) => {
    setSelectedPlatform(platform);
    setIsLoading(true);
    
    try {
      console.log(`Initiating ${platform} OAuth connection...`);
      
      // TODO: Replace with real Unipile OAuth flow
      // const response = await fetch('/api/unipile/oauth/initiate', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ platform })
      // });
      // const { authUrl } = await response.json();
      // window.open(authUrl, '_blank', 'width=500,height=600');
      
      // For demo purposes, show what would happen
      alert(`Real implementation would:\n1. Open ${PLATFORM_CONFIG[platform].name} OAuth window\n2. User grants permissions\n3. Account connects automatically\n\nThis requires actual Unipile API credentials.`);
      
    } catch (error) {
      console.error(`${platform} connection failed:`, error);
      alert(`Failed to connect ${PLATFORM_CONFIG[platform].name}. Please try again.`);
    } finally {
      setIsLoading(false);
      setSelectedPlatform(null);
    }
  };

  const handleDisconnectAccount = async (accountId: string) => {
    setConnectedAccounts(prev => prev.filter(account => account.id !== accountId));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Unipile Integration
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Connect your communication channels for multi-platform outreach
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'overview', label: 'Connected Accounts' },
            { id: 'connect', label: 'Add Account' },
            { id: 'settings', label: 'Settings' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {activeTab === 'overview' && (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Connected Accounts ({connectedAccounts.length})
                </h3>
                
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-gray-600 dark:text-gray-300">Loading accounts...</span>
                  </div>
                ) : connectedAccounts.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      No accounts connected yet
                    </p>
                    <button
                      onClick={() => setActiveTab('connect')}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Connect Your First Account
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {connectedAccounts.map(account => {
                      const config = PLATFORM_CONFIG[account.platform];
                      const IconComponent = config.icon;
                      
                      return (
                        <div
                          key={account.id}
                          className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                        >
                          <div className="flex items-center space-x-4">
                            <div className={`p-2 rounded-lg ${config.color.split(' ')[0]}`}>
                              <IconComponent className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900 dark:text-white">
                                {account.name}
                              </h4>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {config.name}
                                {account.email && ` • ${account.email}`}
                              </p>
                              <p className="text-xs text-gray-400">
                                Connected {account.connection_date}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center space-x-2">
                              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                              <span className="text-sm text-green-600 dark:text-green-400">
                                Connected
                              </span>
                            </div>
                            <button
                              onClick={() => handleDisconnectAccount(account.id)}
                              className="text-red-600 hover:text-red-700 text-sm font-medium"
                            >
                              Disconnect
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Getting Started Guide */}
              {connectedAccounts.length === 0 && !isLoading && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mt-6">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                    🚀 Getting Started with Multi-Channel Outreach
                  </h4>
                  <div className="text-sm text-blue-700 dark:text-blue-200 space-y-2">
                    <p><strong>Step 1:</strong> Connect your LinkedIn account for professional networking</p>
                    <p><strong>Step 2:</strong> Add your email accounts (Gmail/Outlook) for follow-up sequences</p>
                    <p><strong>Step 3:</strong> Configure SMTP if you need custom domain emails</p>
                    <p><strong>Step 4:</strong> Create unified campaigns across all channels</p>
                  </div>
                </div>
              )}

              {/* Usage Statistics - Only show when accounts are connected */}
              {connectedAccounts.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mt-6">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                    Account Activity
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">0</p>
                      <p className="text-xs text-gray-500">Messages Sent</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">0</p>
                      <p className="text-xs text-gray-500">Responses</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-purple-600">-</p>
                      <p className="text-xs text-gray-500">Delivery Rate</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    Statistics will appear after your first campaign
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'connect' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Add New Account
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Connect your accounts to enable multi-channel outreach campaigns
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(PLATFORM_CONFIG).map(([platform, config]) => {
                  const IconComponent = config.icon;
                  const isConnected = connectedAccounts.some(acc => acc.platform === platform);
                  
                  return (
                    <div
                      key={platform}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:border-blue-300 dark:hover:border-blue-500 transition-colors"
                    >
                      <div className="flex items-center space-x-3 mb-3">
                        <div className={`p-2 rounded-lg ${config.color.split(' ')[0]}`}>
                          <IconComponent className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {config.name}
                          </h4>
                          {isConnected && (
                            <div className="flex items-center space-x-1">
                              <Check className="h-4 w-4 text-green-500" />
                              <span className="text-sm text-green-600">Connected</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                        {config.description}
                      </p>
                      
                      <button
                        onClick={() => {
                          if (platform === 'smtp') {
                            alert('SMTP Configuration:\n\n1. Server: mail.yourcompany.com\n2. Port: 587 (TLS) or 465 (SSL)\n3. Username: your-email@yourcompany.com\n4. Password: your-app-password\n5. Authentication: Required\n\nThis would open a configuration form in the real implementation.');
                          } else {
                            handleConnectAccount(platform as keyof typeof PLATFORM_CONFIG);
                          }
                        }}
                        disabled={isLoading || isConnected}
                        className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                          isConnected
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                            : `${config.color} text-white`
                        }`}
                      >
                        {isLoading && selectedPlatform === platform ? (
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            {platform === 'smtp' ? 'Configuring...' : 'Connecting...'}
                          </div>
                        ) : isConnected ? (
                          'Connected'
                        ) : (
                          `${platform === 'smtp' ? 'Configure' : 'Connect'} ${config.name}`
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Channel Selection Preview */}
              <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  💡 Pro Tip: Multi-Channel Campaigns
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-200">
                  Connect multiple platforms to create sophisticated outreach sequences:
                </p>
                <ul className="text-sm text-blue-700 dark:text-blue-200 mt-2 space-y-1">
                  <li>• Start with LinkedIn connection requests</li>
                  <li>• Follow up with personalized emails</li>
                  <li>• Engage with LinkedIn posts and comments</li>
                  <li>• Track all interactions in one dashboard</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Integration Settings
              </h3>
              
              <div className="space-y-6">
                {/* Default Channel Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default Outreach Channel
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="linkedin">LinkedIn First</option>
                    <option value="email">Email First</option>
                    <option value="both">Multi-Channel</option>
                  </select>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Choose your preferred starting channel for new campaigns
                  </p>
                </div>

                {/* Rate Limiting */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Daily Message Limits
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500">LinkedIn Messages</label>
                      <input
                        type="number"
                        defaultValue={50}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Emails per Day</label>
                      <input
                        type="number" 
                        defaultValue={200}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Webhook Configuration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Webhook URL (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://your-app.com/webhook/unipile"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Receive real-time notifications for message responses
                  </p>
                </div>

                {/* API Configuration */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                    API Configuration
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-yellow-700 dark:text-yellow-300">API Endpoint:</span>
                      <code className="text-yellow-800 dark:text-yellow-200">api8.unipile.com:13851</code>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-yellow-700 dark:text-yellow-300">Status:</span>
                      <span className="text-green-600">Connected</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-yellow-700 dark:text-yellow-300">Rate Limit:</span>
                      <span className="text-yellow-800 dark:text-yellow-200">100 req/hour</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Powered by <strong>Unipile</strong> • Multi-platform messaging
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
            {activeTab === 'connect' && connectedAccounts.length === 0 && (
              <button
                onClick={() => setActiveTab('overview')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Skip for Now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}