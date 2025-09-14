'use client';

import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Calendar, 
  DollarSign, 
  HelpCircle,
  Clock,
  ArrowRight,
  Users,
  Inbox,
  Settings,
  RefreshCw,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface InboundRequest {
  id: string;
  type: 'demo' | 'pricing' | 'support' | 'email';
  subject: string;
  from: string;
  time: string;
  company: string;
  details: string;
  platform?: 'unipile' | 'direct';
  status?: 'new' | 'read' | 'replied' | 'archived';
}

interface ConnectedInbox {
  id: string;
  name: string;
  email?: string;
  platform: 'gmail' | 'outlook' | 'linkedin' | 'unipile';
  status: 'connected' | 'disconnected' | 'syncing';
  lastSync?: string;
  messageCount?: number;
}

// Mock inbound requests data
const MOCK_REQUESTS = [
  { 
    id: '1', 
    type: 'demo' as const, 
    subject: 'Demo request from Acme Corp', 
    from: 'kevin@acme.com', 
    time: 'now',
    company: 'Acme Corp',
    details: 'Interested in our enterprise solution for 500+ employees' 
  },
  { 
    id: '2', 
    type: 'pricing' as const, 
    subject: 'Pricing for 10k leads', 
    from: 'mara@beta.com', 
    time: '5m',
    company: 'Beta Systems',
    details: 'Need pricing information for processing 10,000 leads monthly' 
  },
  { 
    id: '3', 
    type: 'support' as const, 
    subject: 'Login issue', 
    from: 'ops@charlie.com', 
    time: '10m',
    company: 'Charlie Solutions',
    details: 'Users unable to access dashboard since this morning' 
  },
  { 
    id: '4', 
    type: 'demo' as const, 
    subject: 'Product walkthrough request', 
    from: 'sarah@deltatech.com', 
    time: '1h',
    company: 'Delta Tech',
    details: 'Technical team wants to see API integration capabilities' 
  }
] satisfies InboundRequest[];

// Mock connected inboxes - will be replaced with real data
const MOCK_INBOXES: ConnectedInbox[] = [
  {
    id: 'unipile-thorsten',
    name: 'Thorsten Linz (LinkedIn)',
    platform: 'unipile',
    status: 'connected',
    lastSync: '2 minutes ago',
    messageCount: 12
  }
];

// Inbox Connection Component
function InboxConnection() {
  const [connectedInboxes, setConnectedInboxes] = useState<ConnectedInbox[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConnectedInboxes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Call the Contact Center specific API to get already connected accounts from backend
      console.log('🔍 Loading connected inboxes from backend...');
      const response = await fetch('/api/contact-center/accounts');
      const data = await response.json();
      
      console.log('📊 Backend response:', data);
      
      if (data.success && data.accounts) {
        // Update connected inboxes with backend data
        const formattedInboxes: ConnectedInbox[] = data.accounts.map((account: any) => ({
          id: account.id, // Use direct ID, not prefixed
          name: account.name,
          email: account.email,
          platform: account.platform,
          status: account.status,
          lastSync: account.lastSync,
          messageCount: account.messageCount
        }));
        
        setConnectedInboxes(formattedInboxes);
        console.log('✅ Loaded inboxes:', formattedInboxes);
      } else if (!data.success) {
        setError(data.error || 'Failed to load connected accounts');
        console.error('❌ API error:', data.error);
      } else {
        setError('No connected accounts found');
        console.log('ℹ️ No accounts found');
      }
    } catch (error) {
      console.error('❌ Failed to load connected inboxes:', error);
      setError('Unable to connect to backend');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentMessages = async (accountId: string) => {
    setIsLoadingMessages(true);
    try {
      console.log('📨 Loading messages for account:', accountId);
      const response = await fetch('/api/unipile/recent-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId })
      });
      
      if (response.ok) {
        const data = await response.json();
        setRecentMessages(data.messages || []);
        console.log('✅ Recent messages loaded:', data);
      }
    } catch (error) {
      console.error('❌ Failed to load messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    // Auto-load connected inboxes on mount
    loadConnectedInboxes();
  }, []);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Inbox size={20} />
            Connected Inboxes
          </h3>
          <p className="text-gray-400 text-sm">Your connected messaging accounts from backend</p>
        </div>
        <button
          onClick={loadConnectedInboxes}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {isLoading ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Connected Inboxes List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <RefreshCw size={24} className="animate-spin text-purple-500" />
            <span className="ml-3 text-gray-300">Loading connected accounts...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center p-8 bg-red-900/20 border border-red-600 rounded-lg">
            <AlertCircle size={24} className="text-red-400" />
            <div className="ml-3">
              <h4 className="text-red-400 font-medium">Connection Error</h4>
              <p className="text-red-300 text-sm">{error}</p>
              <button 
                onClick={loadConnectedInboxes}
                className="mt-2 text-red-400 hover:text-red-300 text-sm underline"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : connectedInboxes.length === 0 ? (
          <div className="flex items-center justify-center p-8 bg-gray-700 rounded-lg">
            <Inbox size={24} className="text-gray-500" />
            <div className="ml-3">
              <h4 className="text-gray-300 font-medium">No Connected Accounts</h4>
              <p className="text-gray-500 text-sm">Connect your LinkedIn through Unipile integration first</p>
            </div>
          </div>
        ) : (
          connectedInboxes.map((inbox) => (
            <div
              key={inbox.id}
              className="flex items-center justify-between p-4 bg-gray-700 rounded-lg border border-gray-600"
            >
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  inbox.status === 'connected' ? 'bg-green-500' : 
                  inbox.status === 'syncing' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <div>
                  <h4 className="text-white font-medium">{inbox.name}</h4>
                  <p className="text-gray-400 text-sm">
                    {inbox.platform} • {inbox.email && `${inbox.email} • `}Status: {inbox.lastSync}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {inbox.messageCount !== undefined && (
                  <span className="text-sm text-gray-300">
                    {inbox.messageCount} messages
                  </span>
                )}
                <button
                  onClick={() => loadRecentMessages(inbox.id)}
                  disabled={isLoadingMessages}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded transition-colors"
                >
                  {isLoadingMessages ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Mail size={14} />
                  )}
                  Load Messages
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recent Messages Preview */}
      {recentMessages.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-700">
          <h4 className="text-white font-medium mb-3">Recent Messages</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {recentMessages.slice(0, 5).map((message, index) => (
              <div key={index} className="p-3 bg-gray-700 rounded border border-gray-600">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white text-sm font-medium">
                    {message.from?.name || 'Unknown Sender'}
                  </span>
                  <span className="text-gray-400 text-xs">
                    {message.date || 'Recently'}
                  </span>
                </div>
                <p className="text-gray-300 text-sm truncate">
                  {message.text || message.subject || 'No preview available'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connection Status */}
      <div className="mt-4 p-3 bg-gray-900 rounded border border-gray-600">
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle size={16} />
          <span className="text-sm">Inbox monitoring active</span>
        </div>
        <p className="text-gray-500 text-xs mt-1">
          New messages will appear automatically in your Contact Center
        </p>
      </div>
    </div>
  );
}

// Inbound Inbox Component from Contact Center v1
function InboundInbox() {
  const [activeRequest, setActiveRequest] = useState<InboundRequest>(MOCK_REQUESTS[0]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'demo': return Calendar;
      case 'pricing': return DollarSign;
      case 'support': return HelpCircle;
      default: return Mail;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'demo': return 'text-green-400 bg-green-900/20';
      case 'pricing': return 'text-blue-400 bg-blue-900/20';
      case 'support': return 'text-orange-400 bg-orange-900/20';
      default: return 'text-muted-foreground bg-muted/20';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Requests List */}
      <div className="lg:col-span-1 bg-gray-800 border border-gray-700 rounded-lg">
        <div className="border-b border-gray-700 p-4">
          <h3 className="text-white font-semibold">Inbound Requests</h3>
          <p className="text-gray-400 text-sm">Recent inquiries and requests</p>
        </div>
        <div className="divide-y divide-gray-700 max-h-96 overflow-y-auto">
          {MOCK_REQUESTS.map(request => {
            const IconComponent = getTypeIcon(request.type);
            const isActive = request.id === activeRequest.id;
            
            return (
              <div 
                key={request.id} 
                onClick={() => setActiveRequest(request)} 
                className={`p-4 cursor-pointer transition-colors ${
                  isActive ? 'bg-purple-900/30 border-l-4 border-l-purple-500' : 'hover:bg-gray-700'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg ${getTypeColor(request.type)}`}>
                    <IconComponent size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs uppercase font-medium ${getTypeColor(request.type).split(' ')[0]}`}>
                        {request.type}
                      </span>
                      <div className="flex items-center text-xs text-gray-400">
                        <Clock size={12} className="mr-1" />
                        {request.time}
                      </div>
                    </div>
                    <h4 className="text-sm text-white font-medium truncate mb-1">
                      {request.subject}
                    </h4>
                    <p className="text-xs text-gray-400 truncate">
                      {request.from} • {request.company}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Request Details */}
      <div className="lg:col-span-2 bg-gray-800 border border-gray-700 rounded-lg">
        <div className="border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${getTypeColor(activeRequest.type)}`}>
                {React.createElement(getTypeIcon(activeRequest.type), { size: 20 })}
              </div>
              <div>
                <span className={`text-xs uppercase font-medium ${getTypeColor(activeRequest.type).split(' ')[0]}`}>
                  {activeRequest.type}
                </span>
                <h2 className="text-white font-semibold">{activeRequest.subject}</h2>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Contact Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">From:</span>
              <span className="text-white">{activeRequest.from}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Company:</span>
              <span className="text-white">{activeRequest.company}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Time:</span>
              <span className="text-white">{activeRequest.time}</span>
            </div>
          </div>

          {/* Request Details */}
          <div>
            <h4 className="text-white font-medium mb-2">Details</h4>
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-gray-300 text-sm">{activeRequest.details}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-700">
            {activeRequest.type === 'demo' && (
              <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                <Calendar size={16} />
                Send Calendar Link
              </button>
            )}
            {activeRequest.type === 'pricing' && (
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                <DollarSign size={16} />
                Send Pricing Sheet
              </button>
            )}
            {activeRequest.type === 'support' && (
              <button className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors">
                <HelpCircle size={16} />
                Route to Support
              </button>
            )}
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-600 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
              <Users size={16} />
              Create Callback
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-600 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
              <ArrowRight size={16} />
              Escalate to AE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const ContactCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'inbox' | 'connections'>('connections');

  return (
    <div className="flex-1 bg-background p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Contact Center</h1>
        <p className="text-gray-400">Manage inbound requests and customer communications</p>
        
        {/* Tab Navigation */}
        <div className="flex space-x-1 mt-6 bg-gray-800 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('connections')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'connections'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Inbox Connections
          </button>
          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'inbox'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Messages & Requests
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="h-[calc(100vh-280px)]">
        {activeTab === 'connections' ? (
          <InboxConnection />
        ) : (
          <InboundInbox />
        )}
      </div>
    </div>
  );
};

export default ContactCenter;