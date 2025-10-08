'use client';

import { toastSuccess, toastError, toastWarning, toastInfo } from '@/lib/toast';
import { useState, useEffect } from 'react';
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
  AlertCircle,
  MessageCircle,
  Linkedin,
  Send,
  Plus,
  Bell
} from 'lucide-react';

interface InboundRequest {
  id: string;
  type: 'linkedin' | 'inmail' | 'email' | 'gmail' | 'outlook';
  subject: string;
  from: string;
  time: string;
  company: string;
  details: string;
  platform?: 'unipile' | 'direct' | 'linkedin' | 'email' | 'google' | 'microsoft';
  status?: 'new' | 'read' | 'replied' | 'archived';
  email_address?: string;
  provider_type?: string;
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
    type: 'linkedin' as const, 
    subject: 'Connection request from Acme Corp', 
    from: 'Kevin Smith', 
    time: 'now',
    company: 'Acme Corp',
    details: 'Hi Thorsten, I saw your profile and would like to connect. We are interested in AI solutions for enterprise.' 
  },
  { 
    id: '2', 
    type: 'inmail' as const, 
    subject: 'Partnership Opportunity', 
    from: 'Mara Johnson', 
    time: '5m',
    company: 'Beta Systems',
    details: 'Hi Thorsten, I represent Beta Systems and we are looking for AI automation partners for our enterprise clients.' 
  },
  { 
    id: '3', 
    type: 'linkedin' as const, 
    subject: 'AI Integration Discussion', 
    from: 'Operations Team', 
    time: '10m',
    company: 'Charlie Solutions',
    details: 'Saw your post about multi-agent systems. Would love to discuss potential collaboration.' 
  },
  { 
    id: '4', 
    type: 'inmail' as const, 
    subject: 'Product walkthrough request', 
    from: 'Sarah Chen', 
    time: '1h',
    company: 'Delta Tech',
    details: 'Hi Thorsten, our technical team is evaluating AI automation tools and would like to understand your API integration capabilities.' 
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

// Removed InboxConnection component as requested

// Inbound Inbox Component - Now pulls real messages from Unipile
function InboundInbox() {
  const [requests, setRequests] = useState<InboundRequest[]>([]);
  const [activeRequest, setActiveRequest] = useState<InboundRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyText, setReplyText] = useState('');

  const handleReply = async () => {
    if (!activeRequest) return;
    
    try {
      console.log('🤖 Starting SAM reply workflow...', { 
        messageId: activeRequest.id, 
        from: activeRequest.from,
        originalMessage: activeRequest.details,
        userGuidance: replyText 
      });
      
      // Start the complete SAM → Email → Unipile workflow
      const workflowPayload = {
        action: 'start_reply',
        originalMessageId: activeRequest.id,
        originalPlatform: activeRequest.platform || activeRequest.type,
        originalSenderName: activeRequest.from,
        originalSenderEmail: activeRequest.email_address,
        originalSenderId: activeRequest.id, // Use message ID as sender ID for now
        originalSubject: activeRequest.subject,
        originalContent: activeRequest.details,
        originalTimestamp: new Date().toISOString(),
        userGuidance: replyText || 'Please draft an appropriate professional reply',
        tonePreference: 'professional'
      };
      
      console.log('📝 Starting SAM workflow...', workflowPayload);
      
      // Call the workflow API
      const response = await fetch('/api/replies/workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workflowPayload)
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ SAM intelligent workflow started:', result);
        
        // Enhanced success message with research insights
        const research = result.research;
        const leadScore = research?.leadScore?.overall || 'N/A';
        const company = research?.company?.name || 'Unknown Company';
        const category = result.leadPipeline?.category || 'Qualified Lead';
        const hitlRequired = result.hitl?.required || false;
        
        let message = `🤖 SAM has analyzed and drafted a reply to ${activeRequest.from}!\n\n`;
        message += `📊 PROSPECT RESEARCH:\n`;
        message += `• Company: ${company}\n`;
        message += `• Lead Score: ${leadScore}/100 (${category})\n`;
        message += `• Industry: ${research?.company?.industry || 'Unknown'}\n`;
        message += `• Confidence: ${Math.round((research?.confidence || 0) * 100)}%\n\n`;
        
        if (research?.insights?.length > 0) {
          message += `💡 KEY INSIGHTS:\n`;
          research.insights.slice(0, 3).forEach((insight: string, i: number) => {
            message += `• ${insight}\n`;
          });
          message += `\n`;
        }
        
        message += `🎯 DRAFT STATUS:\n`;
        if (hitlRequired) {
          message += `• Human approval required (${result.hitl.reason})\n`;
          message += `• Priority: ${result.hitl.priority}\n\n`;
          message += `The draft requires human review before sending. Check your approval queue.`;
        } else {
          message += `• Auto-approved for sending\n`;
          message += `• Thread ID: ${result.threadId}\n\n`;
          message += `The draft will be sent to your email for final approval. Reply with:\n`;
          message += `• APPROVED - to send as-is\n`;
          message += `• CHANGES: [your edits] - to modify\n`;
          message += `• STOP - to cancel`;
        }
        
        toastError(message);
        
        setReplyText('');
        setShowReplyModal(false);
      } else {
        throw new Error(result.error || 'Workflow start failed');
      }
      
    } catch (error) {
      console.error('❌ Failed to start SAM reply workflow:', error);
      toastError(`Failed to start reply workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const loadRealMessages = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('📨 Loading unified messages from LinkedIn and Email providers...');
      
      // Use our new unified inbox messages API endpoint with 50 messages by default
      const messagesResponse = await fetch('/api/inbox/messages?batch_size=50&limit=50');
      const messagesData = await messagesResponse.json();
      
      console.log('🔍 Unified inbox response:', messagesData);
      console.log('📊 Message summary:', messagesData.summary);
      
      if (!messagesData.success) {
        setError(messagesData.error || 'Failed to load messages');
        setRequests([]);
        return;
      }

      console.log('✅ Unified messages loaded:', messagesData);
      
      if (messagesData.messages && messagesData.messages.length > 0) {
        // Transform unified messages to InboundRequest format
        const transformedRequests: InboundRequest[] = messagesData.messages.map((msg: any) => ({
          id: msg.id,
          type: msg.type,
          subject: msg.subject,
          from: msg.from,
          time: msg.time,
          company: msg.company,
          details: msg.details,
          platform: msg.platform,
          status: (msg.is_read === false || msg.status === 'new') ? 'new' as const : 'read' as const,
          email_address: msg.email_address,
          provider_type: msg.provider_type
        }));
        
        setRequests(transformedRequests);
        if (transformedRequests.length > 0) {
          setActiveRequest(transformedRequests[0]);
        }
        
        console.log(`✅ Loaded ${transformedRequests.length} unified messages (${messagesData.summary?.linkedin || 0} LinkedIn, ${messagesData.summary?.email || 0} Email)`);
      } else {
        console.log('ℹ️ No messages found, using mock data');
        setRequests(MOCK_REQUESTS);
        setActiveRequest(MOCK_REQUESTS[0]);
      }
    } catch (error) {
      console.error('❌ Failed to load unified messages:', error);
      setError('Failed to load messages');
      // Fallback to mock data
      setRequests(MOCK_REQUESTS);
      setActiveRequest(MOCK_REQUESTS[0]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatMessageTime = (dateString: string | undefined) => {
    if (!dateString) return 'recently';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  useEffect(() => {
    // Load messages immediately
    loadRealMessages();
    
    // Check for OAuth callback parameters
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');
    const email = urlParams.get('email');
    const platform = urlParams.get('platform');

    if (success === 'email_connected' && email && platform) {
      toastError(`✅ ${platform.toUpperCase()} account connected successfully: ${email}`);
      // Clean URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      // Reload email providers to show new connection
      // loadEmailProviders();
    } else if (error) {
      const message = urlParams.get('message') || 'Connection failed';
      toastError(`❌ Email connection failed: ${decodeURIComponent(message)}`);
      // Clean URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Set up 15-minute auto-refresh interval (faster for HITL approval workflow)
    const refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing messages (15min interval)...');
      loadRealMessages();
    }, 15 * 60 * 1000); // 15 minutes for faster HITL responses

    // Cleanup interval on component unmount
    return () => clearInterval(refreshInterval);
  }, []);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'linkedin': return Linkedin;
      case 'inmail': return Send;
      default: return MessageCircle;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'linkedin': return 'text-blue-400 bg-blue-900/20';
      case 'inmail': return 'text-green-400 bg-green-900/20';
      default: return 'text-gray-400 bg-gray-900/20';
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
          {requests.map(request => {
            const IconComponent = getTypeIcon(request.type);
            const isActive = activeRequest ? request.id === activeRequest.id : false;
            
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
        {activeRequest ? (
          <>
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
                <button 
                  onClick={() => setShowReplyModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <Send size={16} />
                  Reply
                </button>
                <button 
                  onClick={() => setActiveRequest(null)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-600 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                >
                  <ArrowRight size={16} />
                  Mark as Read
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-6 text-center text-gray-400">
            <p>Select a request to view details</p>
          </div>
        )}
      </div>
      
      {/* Reply Modal */}
      {showReplyModal && activeRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">
              Reply to {activeRequest.from}
            </h3>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your reply here..."
              className="w-full h-32 p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none focus:outline-none focus:border-blue-500"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleReply}
                disabled={!replyText.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Send Reply
              </button>
              <button
                onClick={() => {
                  setShowReplyModal(false);
                  setReplyText('');
                }}
                className="px-4 py-2 border border-gray-600 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ContactCenter: React.FC = () => {
  return (
    <div className="flex-1 bg-background p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Inbox</h1>
        <p className="text-gray-400">Manage inbound requests and customer communications</p>
      </div>

      {/* Content */}
      <div className="h-[calc(100vh-280px)]">
        <InboundInbox />
      </div>
    </div>
  );
};

export default ContactCenter;
