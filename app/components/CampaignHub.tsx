'use client';

import { toastSuccess, toastError, toastWarning, toastInfo } from '@/lib/toast';
import { useState, useEffect } from 'react';
import CampaignAssistantChat from '@/components/CampaignAssistantChat';
import {
  Users,
  Mail,
  Linkedin,
  MessageCircle,
  Calendar,
  Target,
  TrendingUp,
  Activity,
  CheckCircle,
  XCircle,
  X,
  Clock,
  AlertCircle,
  Megaphone,
  Pause,
  Play,
  BarChart3,
  Edit,
  FileText,
  MessageSquare,
  Send,
  Brain,
  Plus,
  Settings,
  Upload,
  Zap,
  Eye,
  Grid3x3,
  AlertTriangle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Helper function to get human-readable campaign type labels
function getCampaignTypeLabel(type: string): string {
  const typeLabels: Record<string, string> = {
    'connector': 'Connector',
    'messenger': 'Messenger',
    'open_inmail': 'Open InMail',
    'builder': 'Builder',
    'group': 'Group',
    'event_invite': 'Event Invite',
    'inbound': 'Inbound',
    'event_participants': 'Event Participants',
    'recovery': 'Recovery',
    'company_follow': 'Company Follow',
    'email': 'Email',
    'multi_channel': 'Multi-Channel'
  };
  return typeLabels[type] || type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function CampaignList() {
  const queryClient = useQueryClient();

  // REACT QUERY: Fetch and cache campaigns
  const { data: campaigns = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const response = await fetch('/api/campaigns');

      if (!response.ok) {
        console.error('Failed to load campaigns:', response.statusText);
        // Return mock data as fallback
        return [
          {
            id: '1',
            name: 'Q4 SaaS Outreach',
            status: 'active',
            type: 'linkedin',
            prospects: 145,
            sent: 92,
            replies: 23,
            connections: 67,
            response_rate: 25.0,
            created_at: new Date().toISOString()
          },
          {
            id: '2', 
            name: 'Holiday Networking Campaign',
            status: 'active',
            type: 'multi_channel',
            prospects: 234,
            sent: 189,
            replies: 41,
            connections: 78,
            response_rate: 21.7,
            created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '3',
            name: 'FinTech Decision Makers',
            status: 'paused',
            type: 'linkedin',
            prospects: 178,
            sent: 134,
            replies: 19,
            connections: 45,
            response_rate: 14.2,
            created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '4',
            name: 'Healthcare IT Executives',
            status: 'active',
            type: 'email',
            prospects: 298,
            sent: 267,
            replies: 58,
            connections: 0,
            response_rate: 21.7,
            created_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '5',
            name: 'E-commerce Growth Series',
            status: 'completed',
            type: 'multi_channel',
            prospects: 456,
            sent: 456,
            replies: 89,
            connections: 134,
            response_rate: 19.5,
            created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '6',
            name: 'Manufacturing Leaders Outreach',
            status: 'active',
            type: 'linkedin',
            prospects: 123,
            sent: 98,
            replies: 12,
            connections: 34,
            response_rate: 12.2,
            created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '7',
            name: 'Real Estate Tech Innovators',
            status: 'draft',
            type: 'email',
            prospects: 89,
            sent: 0,
            replies: 0,
            connections: 0,
            response_rate: 0,
            created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '8',
            name: 'HR Directors - Q1 Planning',
            status: 'active',
            type: 'multi_channel',
            prospects: 267,
            sent: 156,
            replies: 34,
            connections: 78,
            response_rate: 21.8,
            created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '9',
            name: 'Legal Tech Transformation',
            status: 'paused',
            type: 'linkedin',
            prospects: 145,
            sent: 89,
            replies: 8,
            connections: 23,
            response_rate: 9.0,
            created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '10',
            name: 'EdTech Innovation Summit',
            status: 'active',
            type: 'email',
            prospects: 389,
            sent: 312,
            replies: 67,
            connections: 0,
            response_rate: 21.5,
            created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '11',
            name: 'Retail Modernization Initiative',
            status: 'completed',
            type: 'multi_channel',
            prospects: 234,
            sent: 234,
            replies: 45,
            connections: 89,
            response_rate: 19.2,
            created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '12',
            name: 'Energy Sector Digital Transformation',
            status: 'active',
            type: 'linkedin',
            prospects: 178,
            sent: 123,
            replies: 21,
            connections: 56,
            response_rate: 17.1,
            created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '13',
            name: 'Insurance Innovation Network',
            status: 'draft',
            type: 'email',
            prospects: 156,
            sent: 0,
            replies: 0,
            connections: 0,
            response_rate: 0,
            created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '14',
            name: 'Logistics & Supply Chain Leaders',
            status: 'active',
            type: 'multi_channel',
            prospects: 298,
            sent: 234,
            replies: 52,
            connections: 123,
            response_rate: 22.2,
            created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '15',
            name: 'Biotech Investment Opportunities',
            status: 'paused',
            type: 'linkedin',
            prospects: 89,
            sent: 67,
            replies: 5,
            connections: 12,
            response_rate: 7.5,
            created_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '16',
            name: 'Government Modernization Project',
            status: 'active',
            type: 'email',
            prospects: 145,
            sent: 134,
            replies: 28,
            connections: 0,
            response_rate: 20.9,
            created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '17',
            name: 'Nonprofit Tech Advancement',
            status: 'completed',
            type: 'multi_channel',
            prospects: 123,
            sent: 123,
            replies: 31,
            connections: 45,
            response_rate: 25.2,
            created_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '18',
            name: 'Media & Entertainment Evolution',
            status: 'active',
            type: 'linkedin',
            prospects: 267,
            sent: 189,
            replies: 43,
            connections: 89,
            response_rate: 22.8,
            created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '19',
            name: 'Aerospace Innovation Network',
            status: 'draft',
            type: 'email',
            prospects: 98,
            sent: 0,
            replies: 0,
            connections: 0,
            response_rate: 0,
            created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '20',
            name: 'Sustainable Tech Leaders Summit',
            status: 'active',
            type: 'multi_channel',
            prospects: 345,
            sent: 278,
            replies: 67,
            connections: 156,
            response_rate: 24.1,
            created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
          }
        ];
      }

      const data = await response.json();
      return data.campaigns || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });

  // Listen for refresh events
  useEffect(() => {
    const handleRefresh = () => refetch();
    window.addEventListener('refreshCampaigns', handleRefresh);

    return () => window.removeEventListener('refreshCampaigns', handleRefresh);
  }, [refetch]);

  // REACT QUERY: Mutation for toggling campaign status
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ campaignId, currentStatus }: { campaignId: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update campaign status');
      }

      return { campaignId, newStatus };
    },
    onSuccess: () => {
      // Invalidate and refetch campaigns
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toastSuccess('Campaign status updated');
    },
    onError: (error) => {
      console.error('Error toggling campaign status:', error);
      toastError('Failed to update campaign status');
    }
  });

  const toggleCampaignStatus = (campaignId: string, currentStatus: string) => {
    toggleStatusMutation.mutate({ campaignId, currentStatus });
  };

  const showCampaignAnalytics = (campaignId: string) => {
    // TODO: Open analytics modal or navigate to analytics view
    toastError(`Analytics for campaign ${campaignId} - Coming soon!`);
  };

  const editCampaign = (campaignId: string) => {
    // TODO: Open edit modal or navigate to edit view
    toastError(`Edit campaign ${campaignId} - Coming soon!`);
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-900/20 border-green-500';
      case 'paused': return 'text-yellow-400 bg-yellow-900/20 border-yellow-500';
      case 'draft': return 'text-gray-400 bg-gray-900/20 border-gray-500';
      default: return 'text-gray-400 bg-gray-900/20 border-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle size={14} className="text-green-400" />;
      case 'paused': return <Clock size={14} className="text-yellow-400" />;
      case 'draft': return <FileText size={14} className="text-gray-400" />;
      default: return <FileText size={14} className="text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-6 animate-pulse">
            <div className="h-6 bg-gray-600 rounded mb-4"></div>
            <div className="h-4 bg-gray-600 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="h-8 bg-gray-600 rounded"></div>
              <div className="h-8 bg-gray-600 rounded"></div>
              <div className="h-8 bg-gray-600 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {campaigns.map(c => (
        <div key={c.id} className="bg-gray-800 border border-gray-700 rounded-lg p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h3 className="text-white font-semibold text-lg group-hover:text-white mb-2">{c.name}</h3>
              <div className={`inline-flex items-center gap-2 text-xs uppercase px-3 py-1 rounded-full border ${getStatusColor(c.status)}`}>
                {getStatusIcon(c.status)}
                {c.status}
              </div>
            </div>
            <div className="flex gap-2 ml-4">
              {c.status === 'active' ? (
                <button 
                  onClick={() => toggleCampaignStatus(c.id, c.status)}
                  className="p-2 text-yellow-400 hover:bg-gray-700 group-hover:bg-purple-500 group-hover:text-white rounded-lg transition-colors"
                  title="Pause campaign"
                >
                  <Pause size={16} />
                </button>
              ) : (
                <button 
                  onClick={() => toggleCampaignStatus(c.id, c.status)}
                  className="p-2 text-green-400 hover:bg-gray-700 group-hover:bg-purple-500 group-hover:text-white rounded-lg transition-colors"
                  title="Resume campaign"
                >
                  <Play size={16} />
                </button>
              )}
              <button 
                onClick={() => showCampaignAnalytics(c.id)}
                className="p-2 text-blue-400 hover:bg-gray-700 group-hover:bg-purple-500 group-hover:text-white rounded-lg transition-colors"
                title="View analytics"
              >
                <BarChart3 size={16} />
              </button>
              <button 
                onClick={() => editCampaign(c.id)}
                className="p-2 text-purple-400 hover:bg-gray-700 group-hover:bg-purple-500 group-hover:text-white rounded-lg transition-colors"
                title="Edit campaign"
              >
                <Edit size={16} />
              </button>
            </div>
          </div>
          
          {c.status !== 'draft' && (
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-700 group-hover:border-purple-400">
              <div className="text-center">
                <div className="text-2xl font-bold text-white group-hover:text-white mb-1">{c.sent}</div>
                <div className="text-gray-400 group-hover:text-purple-100 text-xs">Sent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white group-hover:text-white mb-1">{c.opened}</div>
                <div className="text-gray-400 group-hover:text-purple-100 text-xs">Opened</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white group-hover:text-white mb-1">{c.replied}</div>
                <div className="text-gray-400 group-hover:text-purple-100 text-xs">Replied</div>
              </div>
            </div>
          )}
          
          {c.status === 'draft' && (
            <div className="pt-4 border-t border-gray-700 group-hover:border-purple-400">
              <div className="text-center text-gray-400 group-hover:text-purple-100 text-sm">
                Ready to configure and launch
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Campaign Builder Component from v1
function CampaignBuilder({
  onClose,
  initialProspects,
  onPrepareForApproval
}: {
  onClose?: () => void;
  initialProspects?: any[] | null;
  onPrepareForApproval?: (campaignData: any) => void;
}) {
  // Derive campaign name from initialProspects if available
  const getInitialCampaignName = () => {
    if (initialProspects && initialProspects.length > 0 && initialProspects[0].campaignTag) {
      return initialProspects[0].campaignTag;
    }
    return 'Outbound – VP Sales (SaaS, NA)';
  };

  const [name, setName] = useState(getInitialCampaignName());
  const [campaignType, setCampaignType] = useState('connector');
  const [executionType, setExecutionType] = useState('direct_linkedin');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Auto-populate CSV data when initialProspects are provided
  useEffect(() => {
    if (initialProspects && initialProspects.length > 0) {
      const headers = ['name', 'title', 'company', 'email', 'linkedin_url'];
      setCsvHeaders(headers);
      setCsvData(initialProspects);
      setDataSource('upload'); // Set to upload mode for validation
      setShowPreview(true);
      setCurrentStep(2); // Move to step 2 (preview) since data is already loaded
    }
  }, [initialProspects]);
  const [showSamChat, setShowSamChat] = useState(false);
  const [samMessages, setSamMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [samInput, setSamInput] = useState('');
  const [isGeneratingTemplates, setIsGeneratingTemplates] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Approved prospects state
  const [dataSource, setDataSource] = useState<'approved' | 'upload'>('upload');
  const [approvedProspects, setApprovedProspects] = useState<any[]>([]);
  const [selectedProspects, setSelectedProspects] = useState<any[]>([]);
  const [loadingApprovedProspects, setLoadingApprovedProspects] = useState(false);
  
  // Message templates
  const [connectionMessage, setConnectionMessage] = useState('');
  const [alternativeMessage, setAlternativeMessage] = useState('');
  const [followUpMessages, setFollowUpMessages] = useState<string[]>(['']);
  const [activeField, setActiveField] = useState<{type: 'connection' | 'alternative' | 'followup', index?: number}>({type: 'connection'});
  const [activeTextarea, setActiveTextarea] = useState<HTMLTextAreaElement | null>(null);
  
  const campaignTypes = [
    {
      value: 'connector',
      label: 'Connector',
      description: 'Reach out to 2nd and 3rd+ degree connections with personalized connection requests and follow-ups',
      icon: Users
    },
    {
      value: 'messenger',
      label: 'Messenger',
      description: 'Send direct messages to 1st degree connections',
      icon: MessageSquare
    },
    {
      value: 'open_inmail',
      label: 'Open InMail',
      description: 'Send InMail messages without connection request (Premium required)',
      icon: Mail
    },
    {
      value: 'builder',
      label: 'Builder',
      description: 'Custom campaign builder with advanced targeting',
      icon: Settings
    },
    {
      value: 'group',
      label: 'Group',
      description: 'Engage with LinkedIn group members',
      icon: Users
    },
    {
      value: 'event_invite',
      label: 'Event Invite',
      description: 'Invite connections to your LinkedIn events',
      icon: Calendar
    },
    {
      value: 'inbound',
      label: 'Inbound',
      description: 'Automated responses to inbound inquiries',
      icon: TrendingUp
    },
    {
      value: 'event_participants',
      label: 'Event Participants',
      description: 'Target attendees of specific LinkedIn events',
      icon: Users
    },
    {
      value: 'recovery',
      label: 'Recovery',
      description: 'Re-engage dormant connections and prospects',
      icon: Send
    },
    {
      value: 'company_follow',
      label: 'Company Follow',
      description: 'Invite 1st degree connections to follow your company page',
      icon: Target
    },
    {
      value: 'email',
      label: 'Email',
      description: 'Email-only outreach campaigns',
      icon: Mail
    }
  ];

  // V1 Campaign Orchestration - Sophisticated Execution Types
  const [workspaceTier, setWorkspaceTier] = useState('startup'); // Default to startup
  const [workspaceFeatures, setWorkspaceFeatures] = useState({
    unipile_only: true,
    reachinbox_enabled: false,
    advanced_hitl: false,
    custom_workflows: false,
    advanced_analytics: false
  });

  const executionTypes = [
    { 
      value: 'intelligence', 
      label: 'SAM Intelligence Campaign', 
      description: 'Complete intelligence pipeline with data discovery, enrichment, and personalized outreach',
      icon: Brain,
      duration: workspaceTier === 'enterprise' ? '2 min per prospect' : '3 min per prospect',
      features: ['AI-powered prospect discovery', 'Advanced data enrichment', 'Personalized messaging', 'Cross-channel coordination'],
      tierRequirements: {
        startup: 'LinkedIn + Email via Unipile',
        sme: 'LinkedIn (Unipile) + Email (ReachInbox)',
        enterprise: 'Full multi-channel with advanced analytics'
      },
      channels: {
        startup: ['LinkedIn', 'Basic Email'],
        sme: ['LinkedIn', 'Professional Email', 'Reply Monitoring'],
        enterprise: ['LinkedIn', 'Enterprise Email', 'Advanced Analytics', 'Custom Workflows']
      }
    },
    { 
      value: 'event_invitation', 
      label: 'Event Invitation Campaign', 
      description: 'Event-focused prospect discovery and invitation orchestration with targeted messaging',
      icon: Calendar,
      duration: workspaceTier === 'enterprise' ? '1.5 min per prospect' : '2 min per prospect',
      features: ['Event-specific targeting', 'Registration tracking', 'Follow-up sequences', 'RSVP management'],
      tierRequirements: {
        startup: 'Event invites via LinkedIn',
        sme: 'Multi-channel event promotion',
        enterprise: 'Advanced event analytics & tracking'
      },
      channels: {
        startup: ['LinkedIn Events', 'Basic Invitations'],
        sme: ['LinkedIn Events', 'Email Campaigns', 'Calendar Integration'],
        enterprise: ['Full Event Platform', 'Advanced Tracking', 'Custom Landing Pages']
      }
    },
    { 
      value: 'direct_linkedin', 
      label: 'Direct LinkedIn Campaign', 
      description: 'Fast direct LinkedIn messaging to existing prospects (classic mode)',
      icon: MessageSquare,
      duration: workspaceTier === 'enterprise' ? '0.5 min per prospect' : '1 min per prospect',
      features: ['Direct LinkedIn messaging', 'Connection requests', 'Follow-up sequences', 'Response tracking'],
      tierRequirements: {
        startup: 'Basic LinkedIn messaging (50/day)',
        sme: 'Professional LinkedIn messaging (100/day)',
        enterprise: 'Enterprise LinkedIn messaging (200/day)'
      },
      channels: {
        startup: ['LinkedIn Basic'],
        sme: ['LinkedIn Professional', 'Enhanced Targeting'],
        enterprise: ['LinkedIn Enterprise', 'Advanced Analytics', 'Custom Sequences']
      }
    }
  ];

  const placeholders = [
    { key: '{first_name}', description: 'Contact\'s first name' },
    { key: '{last_name}', description: 'Contact\'s last name' },
    { key: '{job_title}', description: 'Current job title' },
    { key: '{company_name}', description: 'Current company name' },
    { key: '{industry}', description: 'Industry information' },
    { key: '{location}', description: 'Geographic location' }
  ];

  // Load workspace tier and approved prospects
  useEffect(() => {
    loadWorkspaceTier();
    if (dataSource === 'approved') {
      loadApprovedProspects();
    }
  }, [dataSource]);

  const loadWorkspaceTier = async () => {
    try {
      // In production, this would fetch from /api/workspace/tier
      // For now, simulate different tiers for demo
      const simulatedTier = 'startup'; // Can be 'startup', 'sme', 'enterprise'
      setWorkspaceTier(simulatedTier);
      
      // Set features based on tier
      const tierFeatures = {
        startup: {
          unipile_only: true,
          reachinbox_enabled: false,
          advanced_hitl: false,
          custom_workflows: false,
          advanced_analytics: false
        },
        sme: {
          unipile_only: false,
          reachinbox_enabled: true,
          advanced_hitl: false,
          custom_workflows: false,
          advanced_analytics: false
        },
        enterprise: {
          unipile_only: false,
          reachinbox_enabled: true,
          advanced_hitl: true,
          custom_workflows: true,
          advanced_analytics: true
        }
      };
      
      setWorkspaceFeatures(tierFeatures[simulatedTier] || tierFeatures.startup);
    } catch (error) {
      console.error('Error loading workspace tier:', error);
    }
  };

  const loadApprovedProspects = async () => {
    setLoadingApprovedProspects(true);
    try {
      const response = await fetch('/api/sam/approved-prospects');
      const result = await response.json();
      
      if (result.success) {
        setApprovedProspects(result.data.prospects);
      } else {
        console.error('Failed to load approved prospects:', result.error);
        setApprovedProspects([]);
      }
    } catch (error) {
      console.error('Error loading approved prospects:', error);
      setApprovedProspects([]);
    } finally {
      setLoadingApprovedProspects(false);
    }
  };

  const addFollowUpMessage = () => {
    setFollowUpMessages([...followUpMessages, '']);
  };

  const updateFollowUpMessage = (index: number, value: string) => {
    const updated = [...followUpMessages];
    updated[index] = value;
    setFollowUpMessages(updated);
  };

  const removeFollowUpMessage = (index: number) => {
    if (followUpMessages.length > 1) {
      setFollowUpMessages(followUpMessages.filter((_, i) => i !== index));
    }
  };

  const insertPlaceholder = (placeholder: string, messageType?: 'connection' | 'alternative' | 'followup', index?: number) => {
    // If no messageType specified, use the currently focused textarea
    if (!messageType && activeTextarea) {
      const start = activeTextarea.selectionStart;
      const end = activeTextarea.selectionEnd;
      
      // Determine which field this textarea belongs to and update accordingly
      if (activeTextarea.placeholder.includes('Hi {first_name}')) {
        const currentValue = connectionMessage;
        const newValue = currentValue.substring(0, start) + placeholder + currentValue.substring(end);
        setConnectionMessage(newValue);
      } else if (activeTextarea.placeholder.includes('Would love to connect')) {
        const currentValue = alternativeMessage;
        const newValue = currentValue.substring(0, start) + placeholder + currentValue.substring(end);
        setAlternativeMessage(newValue);
      } else if (activeTextarea.dataset.followupIndex !== undefined) {
        const followupIndex = parseInt(activeTextarea.dataset.followupIndex);
        const currentValue = followUpMessages[followupIndex];
        const newValue = currentValue.substring(0, start) + placeholder + currentValue.substring(end);
        updateFollowUpMessage(followupIndex, newValue);
      }
      
      // Restore cursor position after the inserted placeholder
      setTimeout(() => {
        activeTextarea.focus();
        activeTextarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
      }, 0);
      return;
    }

    // Fallback to original logic if messageType is explicitly provided
    if (messageType === 'connection') {
      const textarea = document.querySelector('textarea[placeholder*="Hi {first_name}"]') as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentValue = connectionMessage;
        const newValue = currentValue.substring(0, start) + placeholder + currentValue.substring(end);
        setConnectionMessage(newValue);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
        }, 0);
      } else {
        setConnectionMessage(prev => prev + placeholder);
      }
    } else if (messageType === 'alternative') {
      const textarea = document.querySelector('textarea[placeholder*="Would love to connect"]') as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentValue = alternativeMessage;
        const newValue = currentValue.substring(0, start) + placeholder + currentValue.substring(end);
        setAlternativeMessage(newValue);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
        }, 0);
      } else {
        setAlternativeMessage(prev => prev + placeholder);
      }
    } else if (messageType === 'followup' && index !== undefined) {
      const textarea = document.querySelector(`textarea[data-followup-index="${index}"]`) as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentValue = followUpMessages[index];
        const newValue = currentValue.substring(0, start) + placeholder + currentValue.substring(end);
        updateFollowUpMessage(index, newValue);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
        }, 0);
      } else {
        updateFollowUpMessage(index, followUpMessages[index] + placeholder);
      }
    }
  };

  const startSamTemplateGeneration = () => {
    setShowSamChat(true);
    setSamMessages([{
      role: 'assistant',
      content: `Hi! I'm SAM, and I'll help you create compelling LinkedIn messaging templates for your ${campaignType} campaign "${name}".

I can see you have ${csvData.length} prospects loaded. To create the best templates, tell me:

1. What's your main goal with this campaign? (networking, lead generation, partnerships, etc.)
2. What value can you offer these prospects?
3. Any specific tone you'd like? (professional, casual, friendly, etc.)

Let's create messages that get responses! 🎯`
    }]);
  };

  const sendSamMessage = async () => {
    if (!samInput.trim()) return;

    const userMessage = samInput.trim();
    setSamInput('');
    setSamMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsGeneratingTemplates(true);

    try {
      // Call the actual SAM API for template generation
      const response = await fetch('/api/sam/generate-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_name: name,
          campaign_type: campaignType,
          prospect_count: csvData.length,
          user_input: userMessage,
          conversation_history: samMessages,
          prospect_sample: csvData.slice(0, 3) // Send first 3 prospects for context
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate templates');
      }

      const result = await response.json();
      
      setSamMessages(prev => [...prev, {
        role: 'assistant',
        content: result.response || 'Generated templates based on your requirements!'
      }]);

      // Auto-apply templates if SAM provides them
      if (result.templates) {
        if (result.templates.connection_message) {
          setConnectionMessage(result.templates.connection_message);
        }
        if (result.templates.alternative_message) {
          setAlternativeMessage(result.templates.alternative_message);
        }
        if (result.templates.follow_up_messages) {
          setFollowUpMessages(result.templates.follow_up_messages);
        }
      }

    } catch (error: any) {
      console.error('SAM API error:', error);
      
      // Fallback to local template generation
      setSamMessages(prev => [...prev, {
        role: 'assistant',
        content: `I'll help you create templates! Based on "${userMessage}", here are some suggestions:

**Connection Request:**
"Hi {first_name}, I noticed your work at {company_name}. I'd love to connect and share some insights that might be valuable for your work."

**Follow-up:**
"Thanks for connecting, {first_name}! I'm curious about the biggest challenges you're facing at {company_name} right now."

Would you like me to adjust these or create more variations?`
      }]);
    }

    setIsGeneratingTemplates(false);
  };

  const applySamTemplates = () => {
    // Extract templates from SAM's last message and apply them
    setConnectionMessage("Hi {first_name}, I noticed your work at {company_name}. I'd love to connect and share some insights that might be valuable for your work.");
    setFollowUpMessages(["Thanks for connecting, {first_name}! I'm curious about the biggest challenges you're facing at {company_name} right now."]);
    setShowSamChat(false);
  };

  const processFile = (file: File) => {
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
      setIsUploading(true);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const csv = e.target?.result as string;
        const lines = csv.split('\n').filter(line => line.trim());
        
        if (lines.length > 0) {
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          const data = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const row: any = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            return row;
          }).filter(row => Object.values(row).some(val => val));
          
          setCsvHeaders(headers);
          setCsvData(data);
          setShowPreview(true);
        }
        setIsUploading(false);
      };
      reader.readAsText(file);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(file => file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv'));
    
    if (csvFile) {
      processFile(csvFile);
    } else {
      toastError('Please drop a CSV file');
    }
  };
  
  const submit = async () => {
    // Validate prospect data based on source
    const hasProspectData = dataSource === 'upload' ? csvData.length > 0 : selectedProspects.length > 0;
    if (!hasProspectData) {
      alert(dataSource === 'upload'
        ? 'Please upload prospect data before creating campaign'
        : 'Please select approved prospects before creating campaign');
      return;
    }
    if (campaignType === 'connector' && !connectionMessage.trim()) {
      toastError('Please add a connection request message');
      return;
    }

    // Prepare campaign data for approval screen
    const prospects = dataSource === 'upload' ? csvData : selectedProspects.map(prospect => ({
      firstName: prospect.name?.split(' ')[0] || '',
      lastName: prospect.name?.split(' ').slice(1).join(' ') || '',
      email: prospect.email,
      company: prospect.company,
      title: prospect.title,
      industry: prospect.industry || 'Not specified',
      linkedin_url: prospect.linkedin_url,
      linkedin_user_id: prospect.linkedin_user_id
    }));

    const campaignData = {
      name: name,
      type: campaignType === 'connector' ? 'LinkedIn' : campaignType,
      prospects: prospects,
      messages: {
        connection_request: connectionMessage,
        follow_up_1: followUpMessages[0] || '',
        follow_up_2: followUpMessages[1] || '',
        follow_up_3: followUpMessages[2] || ''
      },
      // Store additional data needed for execution
      _executionData: {
        campaignType,
        executionType,
        alternativeMessage,
        followUpMessages,
        workspaceTier,
        workspaceFeatures
      }
    };

    // Pass to approval screen
    if (onPrepareForApproval) {
      onPrepareForApproval(campaignData);
      return;
    }

    // Fallback: if no approval callback, proceed with old flow
    try {
      // Step 1: Create campaign
      const campaignResponse = await fetch('/api/campaigns/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type: campaignType,
          connection_message: connectionMessage,
          alternative_message: alternativeMessage,
          follow_up_messages: followUpMessages.filter(msg => msg.trim())
        })
      });

      if (!campaignResponse.ok) {
        throw new Error('Failed to create campaign');
      }

      const campaign = await campaignResponse.json();

      // Step 2: Upload prospects with LinkedIn ID resolution
      const prospects = dataSource === 'upload' ? csvData : selectedProspects.map(prospect => ({
        name: prospect.name,
        email: prospect.email,
        company: prospect.company,
        title: prospect.title,
        linkedin_url: prospect.linkedin_url,
        linkedin_user_id: prospect.linkedin_user_id // Include existing LinkedIn ID if available
      }));

      const uploadResponse = await fetch('/api/campaigns/upload-with-resolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaign.id,
          prospects: prospects
        })
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload prospects');
      }

      const uploadResult = await uploadResponse.json();

      // Step 3: Auto-execute if LinkedIn IDs found
      if (uploadResult.prospects_with_linkedin_ids > 0) {
        const executeResponse = await fetch('/api/campaigns/linkedin/execute-via-n8n', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: campaign.id,
            executionType: executionType
          })
        });

        if (executeResponse.ok) {
          const executionResult = await executeResponse.json();
          const selectedExecType = executionTypes.find(t => t.value === executionType);
          // V1 Sophisticated Success Message
          const tierInfo = workspaceTier.toUpperCase();
          const channels = selectedExecType?.channels[workspaceTier]?.join(', ') || 'LinkedIn';
          const hitlMethod = workspaceFeatures.advanced_hitl ? 'UI-based' : 'Email-based';
          
          toastError(`🎉 V1 Campaign Orchestration Launched!\n\n📊 CAMPAIGN DETAILS:\n• Campaign: "${name}"\n• Execution Mode: ${selectedExecType?.label}\n• Workspace Tier: ${tierInfo}\n• Prospects Uploaded: ${csvData.length}\n• Ready for Messaging: ${uploadResult.prospects_with_linkedin_ids}\n\n🔄 EXECUTION CONFIGURATION:\n• Channels: ${channels}\n• HITL Approval: ${hitlMethod} (Required)\n• Rate Limits: ${selectedExecType?.tierRequirements[workspaceTier]}\n• Estimated Processing: ${selectedExecType?.duration}\n\n⏰ TIMING:\n• HITL Approval: ${executionResult.estimated_times?.hitl_approval_time ? new Date(executionResult.estimated_times.hitl_approval_time).toLocaleString() : '~15-30 minutes'}\n• Campaign Completion: ${executionResult.estimated_times?.approval_to_completion ? new Date(executionResult.estimated_times.approval_to_completion).toLocaleString() : 'calculating...'}\n\n📬 NEXT STEPS:\n• Approval email sent to ${executionResult.hitl_approval?.approver_email || 'workspace admin'}\n• Campaign will start after message approval\n• Real-time status updates via N8N Master Funnel\n• Monitor progress in campaign dashboard\n\n🚀 SAM AI V1 Campaign Orchestration is now active!`);
        } else {
          toastError(`✅ Campaign "${name}" created!\n\n📊 Upload Results:\n• ${csvData.length} prospects uploaded\n• ${uploadResult.prospects_with_linkedin_ids} with LinkedIn IDs\n• Ready for manual launch`);
        }
      } else {
        toastError(`✅ Campaign "${name}" created!\n\n📊 Upload Results:\n• ${csvData.length} prospects uploaded\n• LinkedIn ID discovery needed for messaging\n• Run connection campaign first to capture IDs`);
      }

      // Reset form and refresh campaign list
      setCurrentStep(1);
      setCsvData([]);
      setCsvFile(null);
      setShowPreview(false);
      setConnectionMessage('');
      setAlternativeMessage('');
      setFollowUpMessages(['']);
      
      // Close the campaign builder
      if (onClose) {
        onClose();
      }
      
      // Trigger refresh of campaign list
      window.dispatchEvent(new CustomEvent('refreshCampaigns'));
      
    } catch (error: any) {
      console.error('Campaign creation error:', error);
      toastError(`❌ Error creating campaign: ${error.message}`);
    }
  };
  
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-4xl">
      <div className="flex items-center mb-6">
        <Plus className="text-blue-400 mr-3" size={24} />
        <h3 className="text-xl font-semibold text-white">New Campaign</h3>
      </div>
      
      {/* Step Indicator */}
      <div className="flex items-center mb-8">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step <= currentStep ? 'bg-purple-600 text-white' : 'bg-gray-600 text-gray-400'
            }`}>
              {step}
            </div>
            {step < 3 && (
              <div className={`w-16 h-1 mx-2 ${
                step < currentStep ? 'bg-purple-600' : 'bg-gray-600'
              }`} />
            )}
          </div>
        ))}
        <div className="ml-4 text-sm text-gray-400">
          Step {currentStep} of 3: {
            currentStep === 1 ? 'Campaign Setup' : 
            currentStep === 2 ? 'Prospect Data' : 
            'Message Templates'
          }
        </div>
      </div>

      {/* Step 1: Campaign Setup */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Campaign Name
            </label>
            <input 
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none transition-colors" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Enter campaign name..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-3">
              Campaign Type
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaignTypes.map((type) => {
                const IconComponent = type.icon;
                return (
                  <div
                    key={type.value}
                    onClick={() => setCampaignType(type.value)}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      campaignType === type.value
                        ? 'border-purple-500 bg-purple-600/20'
                        : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center mb-2">
                      <IconComponent className="text-purple-400 mr-2" size={20} />
                      <h4 className="text-white font-medium">{type.label}</h4>
                    </div>
                    <p className="text-gray-400 text-sm">{type.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Execution Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Execution Mode
            </label>
            {/* Workspace Tier Badge */}
            <div className="mb-6 p-4 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-white font-medium capitalize">
                    {workspaceTier} Tier Workspace
                  </h4>
                  <p className="text-gray-300 text-sm">
                    {workspaceTier === 'startup' && 'Unipile integration for LinkedIn + basic email'}
                    {workspaceTier === 'sme' && 'Unipile + ReachInbox for professional campaigns'}
                    {workspaceTier === 'enterprise' && 'Full multi-channel with advanced HITL approval'}
                  </p>
                </div>
                <div className="text-xs text-purple-300 bg-purple-500/20 px-3 py-1 rounded-full uppercase">
                  {workspaceTier}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {executionTypes.map((type) => {
                const IconComponent = type.icon;
                const tierChannels = type.channels[workspaceTier] || type.channels.startup;
                const tierRequirement = type.tierRequirements[workspaceTier] || type.tierRequirements.startup;
                
                return (
                  <div
                    key={type.value}
                    onClick={() => setExecutionType(type.value)}
                    className={`p-5 border rounded-lg cursor-pointer transition-all ${
                      executionType === type.value
                        ? 'border-purple-500 bg-purple-600/20 ring-2 ring-purple-500/30'
                        : 'border-gray-600 bg-gray-700 hover:border-gray-500 hover:bg-gray-600/50'
                    }`}
                  >
                    <div className="flex items-start">
                      <IconComponent className="text-purple-400 mr-4 mt-1 flex-shrink-0" size={24} />
                      <div className="flex-1">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-white font-medium">{type.label}</h4>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-1 rounded">
                              {type.duration}
                            </span>
                            {workspaceFeatures.advanced_hitl && (
                              <span className="text-xs text-green-400 bg-green-500/20 px-2 py-1 rounded">
                                HITL
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-gray-400 text-sm mb-3">{type.description}</p>

                        {/* Tier-specific requirements */}
                        <div className="mb-3 p-3 bg-gray-800/50 rounded-lg">
                          <div className="text-xs text-gray-300 font-medium mb-1">
                            {workspaceTier.toUpperCase()} TIER CONFIGURATION:
                          </div>
                          <div className="text-xs text-purple-300">
                            {tierRequirement}
                          </div>
                        </div>

                        {/* Available channels for this tier */}
                        <div className="mb-3">
                          <div className="text-xs text-gray-400 font-medium mb-2">Available Channels:</div>
                          <div className="flex flex-wrap gap-1">
                            {tierChannels.map((channel, index) => (
                              <span 
                                key={index}
                                className="text-xs text-blue-300 bg-blue-500/20 px-2 py-1 rounded"
                              >
                                {channel}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Features */}
                        <div className="grid grid-cols-2 gap-2">
                          {type.features.map((feature, index) => (
                            <div key={index} className="flex items-center text-xs text-gray-300">
                              <CheckCircle size={12} className="text-green-400 mr-1 flex-shrink-0" />
                              {feature}
                            </div>
                          ))}
                        </div>

                        {/* HITL Approval Info */}
                        {executionType === type.value && (
                          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                            <div className="flex items-start">
                              <Clock size={16} className="text-yellow-400 mr-2 mt-0.5 flex-shrink-0" />
                              <div>
                                <div className="text-sm text-yellow-300 font-medium">HITL Approval Required</div>
                                <div className="text-xs text-yellow-200 mt-1">
                                  Campaign messages will be sent for approval before execution.
                                  {workspaceFeatures.advanced_hitl 
                                    ? ' Advanced UI-based approval available.'
                                    : ' Email-based approval process.'
                                  }
                                </div>
                                <div className="text-xs text-yellow-200 mt-1">
                                  Estimated approval time: {type.value === 'intelligence' ? '30' : type.value === 'event_invitation' ? '20' : '15'} minutes
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Prospect Data */}
      {currentStep === 2 && (
        <div className="space-y-6">
          {/* Banner when prospects are from approval */}
          {initialProspects && initialProspects.length > 0 && (
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 flex items-center gap-3 mb-4">
              <CheckCircle className="text-green-400" size={24} />
              <div className="flex-1">
                <p className="text-white font-medium">✓ {initialProspects.length} Prospects Loaded</p>
                <p className="text-gray-400 text-sm">Imported from Data Approval • Review below and proceed to messages</p>
              </div>
            </div>
          )}

          {/* Data Source Selection - Hide when prospects are from approval */}
          {!(initialProspects && initialProspects.length > 0) && (
          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <h4 className="text-white font-medium mb-3">Choose Prospect Data Source</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setDataSource('approved')}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  dataSource === 'approved' 
                    ? 'border-purple-500 bg-purple-600/20 text-purple-300' 
                    : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500'
                }`}
              >
                <Users className="mb-2" size={24} />
                <div className="font-medium">Use Approved Prospects</div>
                <div className="text-xs text-gray-400 mt-1">Select from previously approved prospect data</div>
              </button>
              <button
                onClick={() => setDataSource('upload')}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  dataSource === 'upload' 
                    ? 'border-purple-500 bg-purple-600/20 text-purple-300' 
                    : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500'
                }`}
              >
                <Upload className="mb-2" size={24} />
                <div className="font-medium">Upload New CSV</div>
                <div className="text-xs text-gray-400 mt-1">Upload fresh prospect data from CSV file</div>
              </button>
            </div>
          </div>
          )}

          {/* Approved Prospects Selection */}
          {dataSource === 'approved' && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Select Approved Prospects
              </label>
              <div className="bg-gray-700 rounded-lg p-4">
                {loadingApprovedProspects ? (
                  <div className="text-center py-8 text-gray-400">Loading approved prospects...</div>
                ) : approvedProspects.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    No approved prospects found. Use the Data Approval section to approve some prospects first.
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-white font-medium">{approvedProspects.length} Approved Prospects Available</span>
                      <button
                        onClick={() => {
                          const allSelected = selectedProspects.length === approvedProspects.length;
                          setSelectedProspects(allSelected ? [] : [...approvedProspects]);
                        }}
                        className="text-purple-400 hover:text-purple-300 text-sm"
                      >
                        {selectedProspects.length === approvedProspects.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {approvedProspects.map((prospect) => (
                        <div
                          key={prospect.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedProspects.find(p => p.id === prospect.id)
                              ? 'border-purple-500 bg-purple-600/20'
                              : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                          }`}
                          onClick={() => {
                            const isSelected = selectedProspects.find(p => p.id === prospect.id);
                            if (isSelected) {
                              setSelectedProspects(selectedProspects.filter(p => p.id !== prospect.id));
                            } else {
                              setSelectedProspects([...selectedProspects, prospect]);
                            }
                          }}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="text-white font-medium">{prospect.name}</div>
                              <div className="text-gray-300 text-sm">{prospect.title} at {prospect.company}</div>
                              <div className="text-gray-400 text-xs mt-1">
                                Confidence: {Math.round(prospect.confidence_score * 100)}% • 
                                Source: {prospect.source_platform}
                              </div>
                            </div>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              selectedProspects.find(p => p.id === prospect.id)
                                ? 'border-purple-500 bg-purple-500'
                                : 'border-gray-500'
                            }`}>
                              {selectedProspects.find(p => p.id === prospect.id) && (
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedProspects.length > 0 && (
                      <div className="mt-4 p-3 bg-purple-600/20 rounded-lg">
                        <span className="text-purple-300">
                          {selectedProspects.length} prospect{selectedProspects.length !== 1 ? 's' : ''} selected for campaign
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CSV Upload (existing code) */}
          {dataSource === 'upload' && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Prospect Data (CSV Upload)
              </label>
            <div 
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                isDragOver 
                  ? 'border-purple-500 bg-purple-600/20 scale-105' 
                  : 'border-gray-600 hover:border-gray-500'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label 
                htmlFor="csv-upload" 
                className="cursor-pointer flex flex-col items-center space-y-3"
              >
                <Upload className={`transition-colors duration-200 ${
                  isDragOver ? 'text-purple-400' : 'text-gray-400'
                }`} size={32} />
                <div>
                  <span className={`text-lg transition-colors duration-200 ${
                    isDragOver ? 'text-purple-300' : 'text-gray-300'
                  }`}>
                    {csvFile ? csvFile.name : isDragOver ? 'Drop CSV file here' : 'Drag & drop CSV file or click to upload'}
                  </span>
                  <p className={`text-sm mt-1 transition-colors duration-200 ${
                    isDragOver ? 'text-purple-400' : 'text-gray-500'
                  }`}>
                    Expected columns: Name, Email, Company, Title, LinkedIn URL
                  </p>
                </div>
              </label>
            </div>
            {isUploading && (
              <div className="mt-3 text-center text-purple-400">Processing CSV...</div>
            )}

            {showPreview && csvData.length > 0 && (
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">Data Preview ({csvData.length} prospects)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {csvHeaders.slice(0, 5).map(header => (
                        <th key={header} className="text-left text-gray-300 pb-2 pr-4">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 5).map((row, index) => (
                      <tr key={index}>
                        {csvHeaders.slice(0, 5).map(header => (
                          <td key={header} className="text-gray-400 py-1 pr-4">
                            {String(row[header]).substring(0, 25)}
                            {String(row[header]).length > 25 ? '...' : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvData.length > 5 && (
                  <div className="text-xs text-gray-500 mt-2">
                    ... and {csvData.length - 5} more prospects
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
          )}
        </div>
      )}

      {/* Step 3: Message Templates (Connector Campaign) */}
      {currentStep === 3 && campaignType === 'connector' && (
        <div className="space-y-6">
          {/* SAM Template Generation */}
          <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <Zap className="text-purple-400 mr-2" size={20} />
                <h4 className="text-white font-medium">SAM AI Template Generator</h4>
              </div>
              <button 
                onClick={() => setShowSamChat(!showSamChat)}
                className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                <MessageSquare size={16} /> {showSamChat ? 'Close Chat' : 'Chat with SAM'}
              </button>
            </div>
            <p className="text-gray-300 text-sm mb-3">
              Let SAM create personalized messaging templates based on your campaign goals and target audience.
            </p>
            <div className="flex gap-2">
              <button 
                onClick={startSamTemplateGeneration}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors"
              >
                Generate Templates with SAM
              </button>
              <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors">
                Create Manually
              </button>
            </div>
          </div>

          {/* SAM Chat Interface */}
          {showSamChat && (
            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <MessageSquare className="text-purple-400 mr-2" size={16} />
                <h4 className="text-white font-medium">Chat with SAM</h4>
              </div>
              
              <div className="h-64 overflow-y-auto mb-4 space-y-3">
                {samMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-600 text-gray-100'
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                    </div>
                  </div>
                ))}
                {isGeneratingTemplates && (
                  <div className="flex justify-start">
                    <div className="bg-gray-600 text-gray-100 p-3 rounded-lg">
                      <div className="text-sm">SAM is creating your templates...</div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={samInput}
                  onChange={e => setSamInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && sendSamMessage()}
                  placeholder="Tell SAM about your campaign goals..."
                  className="flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none text-sm"
                />
                <button
                  onClick={sendSamMessage}
                  disabled={isGeneratingTemplates || !samInput.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                >
                  Send
                </button>
              </div>
              
              {samMessages.length > 2 && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={applySamTemplates}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
                  >
                    Apply Templates
                  </button>
                  <button
                    onClick={() => setSamMessages([])}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs"
                  >
                    Clear Chat
                  </button>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Connection Request Message
            </label>
            <p className="text-xs text-gray-500 mb-3">
              This message will be sent with your connection request
            </p>
            <textarea
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none transition-colors resize-none"
              rows={4}
              value={connectionMessage}
              onChange={e => setConnectionMessage(e.target.value)}
              onFocus={(e) => {
                setActiveField({type: 'connection'});
                setActiveTextarea(e.target as HTMLTextAreaElement);
              }}
              placeholder="Hi {first_name}, I saw your profile and would love to connect..."
              maxLength={275}
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-gray-500">
                Characters remaining: {275 - connectionMessage.length}/275
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Alternative Message (Optional)
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Shorter alternative message for connection requests
            </p>
            <textarea
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none transition-colors resize-none"
              rows={2}
              value={alternativeMessage}
              onChange={e => setAlternativeMessage(e.target.value)}
              onFocus={(e) => {
                setActiveField({type: 'alternative'});
                setActiveTextarea(e.target as HTMLTextAreaElement);
              }}
              placeholder="Would love to connect with you on LinkedIn!"
              maxLength={115}
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-gray-500">
                Characters remaining: {115 - alternativeMessage.length}/115
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-400">
                Follow-up Messages
              </label>
              <button
                onClick={addFollowUpMessage}
                className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                <Plus size={16} /> Add Follow-up
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Messages sent after connection is accepted
            </p>
            
            {followUpMessages.map((message, index) => (
              <div key={index} className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Follow-up {index + 1}</span>
                  {followUpMessages.length > 1 && (
                    <button
                      onClick={() => removeFollowUpMessage(index)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <XCircle size={16} />
                    </button>
                  )}
                </div>
                <textarea
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none transition-colors resize-none"
                  rows={3}
                  value={message}
                  onChange={e => updateFollowUpMessage(index, e.target.value)}
                  onFocus={(e) => {
                    setActiveField({type: 'followup', index});
                    setActiveTextarea(e.target as HTMLTextAreaElement);
                  }}
                  placeholder={`Follow-up message ${index + 1}...`}
                  data-followup-index={index}
                />
              </div>
            ))}
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <h4 className="text-white font-medium mb-3">Personalization Placeholders</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {placeholders.map((placeholder) => (
                <button
                  key={placeholder.key}
                  onClick={() => insertPlaceholder(placeholder.key)}
                  className="text-xs px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                  title={placeholder.description}
                >
                  {placeholder.key}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Click any placeholder to insert it into your message
            </p>
          </div>
        </div>
      )}
      
      {/* Navigation Buttons */}
      <div className="flex justify-between mt-8">
        <button 
          onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
          disabled={currentStep === 1}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-gray-300 rounded-lg transition-colors"
        >
          Previous
        </button>
        
        <div className="flex gap-3">
          {currentStep < 3 ? (
            <button 
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={currentStep === 2 && (dataSource === 'upload' ? !csvData.length : !selectedProspects.length)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded-lg transition-colors"
            >
              Next Step
            </button>
          ) : (
            <button 
              onClick={submit} 
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
            >
              Create Campaign
            </button>
          )}
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface CampaignHubProps {
  initialProspects?: any[] | null;
  onCampaignCreated?: () => void;
}

const CampaignHub: React.FC<CampaignHubProps> = ({ initialProspects, onCampaignCreated }) => {
  const [showBuilder, setShowBuilder] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showFullFeatures, setShowFullFeatures] = useState(false);
  const [showApprovalScreen, setShowApprovalScreen] = useState(false);
  const [campaignDataForApproval, setCampaignDataForApproval] = useState<any>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // Auto-open pending approvals toggle (stored in localStorage)
  const [autoOpenApprovals, setAutoOpenApprovals] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('autoOpenApprovals');
      return saved !== null ? saved === 'true' : true; // Default to true
    }
    return true;
  });

  // Don't auto-open builder - show Pending Approval section instead
  // Users will click "Draft Messages" to open builder for each campaign
  // useEffect(() => {
  //   if (initialProspects && initialProspects.length > 0) {
  //     setShowBuilder(true);
  //   }
  // }, [initialProspects]);

  // Load approval counts on mount and auto-open if enabled
  useEffect(() => {
    const checkPendingApprovals = async () => {
      try {
        const response = await fetch('/api/campaigns/messages/approval');
        if (response.ok) {
          const result = await response.json();
          const counts = result.counts || { pending: 0, approved: 0, rejected: 0, total: 0 };
          setApprovalCounts(counts);

          // Auto-open if there are pending approvals and toggle is enabled
          if (autoOpenApprovals && counts.pending > 0) {
            setApprovalMessages(result.grouped || { pending: [], approved: [], rejected: [] });
            setShowMessageApproval(true);
          }
        }
      } catch (error) {
        console.error('Failed to check pending approvals:', error);
      }
    };

    checkPendingApprovals();
  }, [autoOpenApprovals]);

  // Save auto-open preference to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('autoOpenApprovals', autoOpenApprovals.toString());
    }
  }, [autoOpenApprovals]);

  // Campaign filter state
  const [campaignFilter, setCampaignFilter] = useState<'active' | 'inactive' | 'archived' | 'approval'>('active');

  // Load approval messages when approval tab is selected
  useEffect(() => {
    if (campaignFilter === 'approval' && approvalMessages.pending.length === 0) {
      loadApprovalMessages();
    }
  }, [campaignFilter]);

  // Modal states for campaign management features
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [showCampaignCloning, setShowCampaignCloning] = useState(false);
  const [showMessageApproval, setShowMessageApproval] = useState(false);
  const [showScheduledCampaigns, setShowScheduledCampaigns] = useState(false);
  const [showABTesting, setShowABTesting] = useState(false);
  const [showCampaignSettings, setShowCampaignSettings] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [showStepsEditor, setShowStepsEditor] = useState(false);
  const [selectedMessageForReview, setSelectedMessageForReview] = useState<any>(null);
  const [showCampaignProspects, setShowCampaignProspects] = useState(false);
  const [campaignProspects, setCampaignProspects] = useState<any[]>([]);
  const [loadingProspects, setLoadingProspects] = useState(false);

  // Campaign cloning state
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignDescription, setNewCampaignDescription] = useState('');
  const [cloneProspects, setCloneProspects] = useState(false);
  const [cloneTemplates, setCloneTemplates] = useState(true);
  const [cloneSettings, setCloneSettings] = useState(true);
  const [isCloning, setIsCloning] = useState(false);

  // Message approval state
  const [approvalMessages, setApprovalMessages] = useState<any>({
    pending: [],
    approved: [],
    rejected: []
  });
  const [loadingApproval, setLoadingApproval] = useState(false);
  const [approvalCounts, setApprovalCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });

  // Scheduled campaigns state
  const [scheduledCampaigns, setScheduledCampaigns] = useState<any>({
    upcoming: [],
    active: [],
    completed: [],
    cancelled: []
  });
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [scheduleCounts, setScheduleCounts] = useState({
    upcoming: 0,
    active: 0,
    completed: 0,
    cancelled: 0,
    total: 0
  });
  const [selectedScheduleCampaign, setSelectedScheduleCampaign] = useState('');
  const [scheduleStartTime, setScheduleStartTime] = useState('');
  const [scheduleEndTime, setScheduleEndTime] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');

  // A/B Testing state
  const [abTests, setAbTests] = useState<any>({
    active: [],
    completed: [],
    paused: [],
    stopped: []
  });
  const [loadingABTests, setLoadingABTests] = useState(false);
  const [abTestCounts, setAbTestCounts] = useState({
    active: 0,
    completed: 0,
    paused: 0,
    stopped: 0,
    total: 0
  });
  const [testName, setTestName] = useState('');
  const [testType, setTestType] = useState('connection_message');
  const [variantA, setVariantA] = useState('');
  const [variantB, setVariantB] = useState('');
  const [sampleSize, setSampleSize] = useState(100);
  const [splitRatio, setSplitRatio] = useState('50/50');
  const [testDuration, setTestDuration] = useState(7);

  // Campaign Settings state
  const [campaignSettings, setCampaignSettings] = useState<any>({
    connection_request_delay: '1-3 hours',
    follow_up_delay: '2-3 days',
    max_messages_per_day: 20,
    preferred_send_times: ['9-11 AM', '1-3 PM'],
    active_days: ['Monday-Friday'],
    timezone: 'ET (Eastern Time)',
    auto_insert_company_name: true,
    use_job_title: true,
    include_industry_insights: false,
    reference_mutual_connections: false,
    daily_connection_limit: 100,
    respect_do_not_contact: true,
    auto_pause_high_rejection: true,
    require_message_approval: false
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [settingsChanged, setSettingsChanged] = useState(false);

  // Template library state
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Handle campaign approval and execution
  const handleApproveCampaign = async (finalCampaignData: any) => {
    try {
      const { _executionData } = finalCampaignData;

      // Step 1: Create campaign
      const campaignResponse = await fetch('/api/campaigns/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: finalCampaignData.name,
          type: _executionData.campaignType,
          connection_message: finalCampaignData.messages.connection_request,
          alternative_message: _executionData.alternativeMessage,
          follow_up_messages: [
            finalCampaignData.messages.follow_up_1,
            finalCampaignData.messages.follow_up_2,
            finalCampaignData.messages.follow_up_3
          ].filter(msg => msg.trim())
        })
      });

      if (!campaignResponse.ok) {
        throw new Error('Failed to create campaign');
      }

      const campaign = await campaignResponse.json();

      // Step 2: Upload prospects
      const uploadResponse = await fetch('/api/campaigns/upload-with-resolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaign.id,
          prospects: finalCampaignData.prospects
        })
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload prospects');
      }

      const uploadResult = await uploadResponse.json();

      // Step 3: Execute via N8N
      if (uploadResult.prospects_with_linkedin_ids > 0) {
        const executeResponse = await fetch('/api/campaigns/linkedin/execute-via-n8n', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: campaign.id,
            executionType: _executionData.executionType
          })
        });

        if (executeResponse.ok) {
          toastError(`✅ Campaign "${finalCampaignData.name}" approved and launched successfully!\n\n📊 ${finalCampaignData.prospects.length} prospects uploaded\n🚀 Campaign sent to N8N for execution`);
        } else {
          toastError(`✅ Campaign "${finalCampaignData.name}" created!\n⚠️ Manual launch required from campaign dashboard`);
        }
      } else {
        toastError(`✅ Campaign "${finalCampaignData.name}" approved!\n\n📊 ${finalCampaignData.prospects.length} prospects uploaded\n⚠️ LinkedIn ID discovery needed before messaging`);
      }

      // Reset and close
      setShowApprovalScreen(false);
      setCampaignDataForApproval(null);
      setShowBuilder(false);
      onCampaignCreated?.();

    } catch (error) {
      console.error('Campaign approval error:', error);
      toastError(`Error: ${error instanceof Error ? error.message : 'Failed to execute campaign'}`);
    }
  };

  // Load templates when modal opens
  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const response = await fetch('/api/campaigns/templates');
      if (response.ok) {
        const result = await response.json();
        setTemplates(result.templates || []);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const openTemplateLibrary = () => {
    setShowTemplateLibrary(true);
    loadTemplates();
  };

  const loadCampaignsForCloning = async () => {
    try {
      const response = await fetch('/api/campaigns/create');
      if (response.ok) {
        const result = await response.json();
        setCampaigns(result.campaigns || []);
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    }
  };

  const openCampaignCloning = () => {
    setShowCampaignCloning(true);
    loadCampaignsForCloning();
    // Reset form
    setSelectedCampaignId('');
    setNewCampaignName('');
    setNewCampaignDescription('');
    setCloneProspects(false);
    setCloneTemplates(true);
    setCloneSettings(true);
  };

  const handleCloneCampaign = async () => {
    if (!selectedCampaignId || !newCampaignName.trim()) {
      toastError('Please select a campaign and enter a new campaign name');
      return;
    }

    setIsCloning(true);
    try {
      const response = await fetch('/api/campaigns/clone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_campaign_id: selectedCampaignId,
          new_name: newCampaignName.trim(),
          new_description: newCampaignDescription.trim() || undefined,
          clone_prospects: cloneProspects,
          clone_templates: cloneTemplates,
          clone_settings: cloneSettings
        })
      });

      if (response.ok) {
        const result = await response.json();
        toastError(`Campaign "${result.cloned_campaign.name}" cloned successfully!`);
        setShowCampaignCloning(false);
        // Refresh campaigns list
        window.dispatchEvent(new Event('refreshCampaigns'));
      } else {
        const error = await response.json();
        toastError(`Failed to clone campaign: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to clone campaign:', error);
      toastError('Failed to clone campaign. Please try again.');
    } finally {
      setIsCloning(false);
    }
  };

  const loadApprovalMessages = async () => {
    setLoadingApproval(true);
    try {
      const response = await fetch('/api/campaigns/messages/approval');
      if (response.ok) {
        const result = await response.json();

        // Transform the data to include campaign_name from joined campaigns table
        const transformMessages = (messages: any[]) => messages.map(msg => ({
          ...msg,
          campaign_name: msg.campaigns?.name || msg.campaign_name || 'Unknown Campaign',
          message_content: msg.message_text || msg.message_content || '',
          step_number: msg.sequence_step || msg.step_number || 1
        }));

        const transformed = {
          pending: transformMessages(result.grouped?.pending || []),
          approved: transformMessages(result.grouped?.approved || []),
          rejected: transformMessages(result.grouped?.rejected || [])
        };

        setApprovalMessages(transformed);
        setApprovalCounts(result.counts || { pending: 0, approved: 0, rejected: 0, total: 0 });
      }
    } catch (error) {
      console.error('Failed to load approval messages:', error);
    } finally {
      setLoadingApproval(false);
    }
  };

  const openMessageApproval = () => {
    setShowMessageApproval(true);
    loadApprovalMessages();
  };

  const handleApproveMessage = async (messageId: string) => {
    try {
      const response = await fetch('/api/campaigns/messages/approval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'approve',
          message_id: messageId
        })
      });

      if (response.ok) {
        // Refresh the approval messages
        loadApprovalMessages();
      } else {
        const error = await response.json();
        toastError(`Failed to approve message: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to approve message:', error);
      toastError('Failed to approve message. Please try again.');
    }
  };

  const handleRejectMessage = async (messageId: string, reason?: string) => {
    try {
      const response = await fetch('/api/campaigns/messages/approval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'reject',
          message_id: messageId,
          rejection_reason: reason || 'Message rejected'
        })
      });

      if (response.ok) {
        // Refresh the approval messages
        loadApprovalMessages();
      } else {
        const error = await response.json();
        toastError(`Failed to reject message: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to reject message:', error);
      toastError('Failed to reject message. Please try again.');
    }
  };

  const loadCampaignProspects = async (campaignId: string) => {
    setLoadingProspects(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/prospects`);
      if (response.ok) {
        const result = await response.json();
        setCampaignProspects(result.prospects || []);
        setShowCampaignProspects(true);
      } else {
        console.error('Failed to load campaign prospects');
        toastError('Failed to load prospects for this campaign');
      }
    } catch (error) {
      console.error('Failed to load campaign prospects:', error);
      toastError('Failed to load prospects. Please try again.');
    } finally {
      setLoadingProspects(false);
    }
  };

  const handleBulkApproval = async (action: 'approve' | 'reject') => {
    const messageIds = approvalMessages.pending.map((msg: any) => msg.id);
    if (messageIds.length === 0) {
      toastError('No pending messages to approve');
      return;
    }

    try {
      const response = await fetch('/api/campaigns/messages/approval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: action === 'approve' ? 'bulk_approve' : 'bulk_reject',
          message_ids: messageIds,
          rejection_reason: action === 'reject' ? 'Bulk rejection' : undefined
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        // Refresh the approval messages
        loadApprovalMessages();
      } else {
        const error = await response.json();
        toastError(`Failed to ${action} messages: ${error.error}`);
      }
    } catch (error) {
      console.error(`Failed to ${action} messages:`, error);
      toastError(`Failed to ${action} messages. Please try again.`);
    }
  };

  const loadScheduledCampaigns = async () => {
    setLoadingSchedules(true);
    try {
      const response = await fetch('/api/campaigns/schedule');
      if (response.ok) {
        const result = await response.json();
        setScheduledCampaigns(result.grouped || { upcoming: [], active: [], completed: [], cancelled: [] });
        setScheduleCounts(result.counts || { upcoming: 0, active: 0, completed: 0, cancelled: 0, total: 0 });
      } else {
        // Use mock data if API fails (for demo purposes when DB is not set up)
        const mockSchedules = {
          upcoming: [
            {
              id: '1',
              campaigns: { name: 'Holiday Networking Campaign' },
              scheduled_start_time: '2024-12-15T09:00:00Z',
              notes: 'Expected Duration: 2 weeks'
            },
            {
              id: '2', 
              campaigns: { name: 'Q1 2025 Prospecting Blitz' },
              scheduled_start_time: '2025-01-02T08:00:00Z',
              notes: 'Expected Duration: 1 month'
            }
          ],
          active: [
            {
              id: '3',
              campaigns: { name: 'November B2B Outreach' },
              scheduled_start_time: '2024-11-01T09:00:00Z',
              notes: 'Progress: 65% • Messages sent: 156/240'
            }
          ],
          completed: [],
          cancelled: []
        };
        setScheduledCampaigns(mockSchedules);
        setScheduleCounts({
          upcoming: mockSchedules.upcoming.length,
          active: mockSchedules.active.length,
          completed: 0,
          cancelled: 0,
          total: mockSchedules.upcoming.length + mockSchedules.active.length
        });
      }
    } catch (error) {
      console.error('Failed to load scheduled campaigns:', error);
      // Fallback to empty state
      setScheduledCampaigns({ upcoming: [], active: [], completed: [], cancelled: [] });
      setScheduleCounts({ upcoming: 0, active: 0, completed: 0, cancelled: 0, total: 0 });
    } finally {
      setLoadingSchedules(false);
    }
  };

  const openScheduledCampaigns = () => {
    setShowScheduledCampaigns(true);
    loadScheduledCampaigns();
    loadCampaignsForCloning(); // Reuse campaign loading for dropdown
    // Reset form
    setSelectedScheduleCampaign('');
    setScheduleStartTime('');
    setScheduleEndTime('');
    setScheduleNotes('');
  };

  const handleScheduleCampaign = async () => {
    if (!selectedScheduleCampaign || !scheduleStartTime) {
      toastError('Please select a campaign and start time');
      return;
    }

    try {
      const response = await fetch('/api/campaigns/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaign_id: selectedScheduleCampaign,
          scheduled_start_time: scheduleStartTime,
          scheduled_end_time: scheduleEndTime || undefined,
          notes: scheduleNotes || undefined
        })
      });

      if (response.ok) {
        const result = await response.json();
        toastError(`Campaign "${result.campaign.name}" scheduled successfully!`);
        // Refresh schedules
        loadScheduledCampaigns();
        // Reset form
        setSelectedScheduleCampaign('');
        setScheduleStartTime('');
        setScheduleEndTime('');
        setScheduleNotes('');
      } else {
        const error = await response.json();
        toastError(`Failed to schedule campaign: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to schedule campaign:', error);
      toastError('Failed to schedule campaign. Please try again.');
    }
  };

  const handleScheduleAction = async (scheduleId: string, action: string) => {
    try {
      const response = await fetch('/api/campaigns/schedule', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schedule_id: scheduleId,
          action: action
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        // Refresh schedules
        loadScheduledCampaigns();
      } else {
        const error = await response.json();
        toastError(`Failed to ${action} schedule: ${error.error}`);
      }
    } catch (error) {
      console.error(`Failed to ${action} schedule:`, error);
      toastError(`Failed to ${action} schedule. Please try again.`);
    }
  };

  const loadABTests = async () => {
    setLoadingABTests(true);
    try {
      const response = await fetch('/api/campaigns/ab-testing');
      if (response.ok) {
        const result = await response.json();
        setAbTests(result.grouped || { active: [], completed: [], paused: [], stopped: [] });
        setAbTestCounts(result.counts || { active: 0, completed: 0, paused: 0, stopped: 0, total: 0 });
      } else {
        // Mock data will be provided by the API when database doesn't exist
        const result = await response.json();
        setAbTests(result.grouped || { active: [], completed: [], paused: [], stopped: [] });
        setAbTestCounts(result.counts || { active: 0, completed: 0, paused: 0, stopped: 0, total: 0 });
      }
    } catch (error) {
      console.error('Failed to load A/B tests:', error);
      // Fallback to empty state
      setAbTests({ active: [], completed: [], paused: [], stopped: [] });
      setAbTestCounts({ active: 0, completed: 0, paused: 0, stopped: 0, total: 0 });
    } finally {
      setLoadingABTests(false);
    }
  };

  const openABTesting = () => {
    setShowABTesting(true);
    loadABTests();
    loadCampaignsForCloning(); // Reuse campaign loading for dropdown
    // Reset form
    setTestName('');
    setTestType('connection_message');
    setVariantA('');
    setVariantB('');
    setSampleSize(100);
    setSplitRatio('50/50');
    setTestDuration(7);
  };

  const handleCreateABTest = async () => {
    if (!testName || !variantA || !variantB || !selectedCampaignId) {
      toastError('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/campaigns/ab-testing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test_name: testName,
          test_type: testType,
          campaign_id: selectedCampaignId,
          duration_days: testDuration,
          sample_size: sampleSize,
          split_ratio: splitRatio,
          variants: [
            { variant_name: 'A', content: variantA },
            { variant_name: 'B', content: variantB }
          ]
        })
      });

      if (response.ok) {
        const result = await response.json();
        toastError(`A/B test "${result.test.test_name}" created successfully!`);
        // Refresh tests
        loadABTests();
        // Reset form
        setTestName('');
        setVariantA('');
        setVariantB('');
        setSelectedCampaignId('');
      } else {
        const error = await response.json();
        toastError(`Failed to create A/B test: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to create A/B test:', error);
      toastError('Failed to create A/B test. Please try again.');
    }
  };

  const handleABTestAction = async (testId: string, action: string) => {
    try {
      const response = await fetch('/api/campaigns/ab-testing', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test_id: testId,
          action: action
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        // Refresh tests
        loadABTests();
      } else {
        const error = await response.json();
        toastError(`Failed to ${action} test: ${error.error}`);
      }
    } catch (error) {
      console.error(`Failed to ${action} test:`, error);
      toastError(`Failed to ${action} test. Please try again.`);
    }
  };

  const loadCampaignSettings = async () => {
    setLoadingSettings(true);
    try {
      const response = await fetch('/api/campaigns/settings?scope=workspace');
      if (response.ok) {
        const result = await response.json();
        setCampaignSettings(result.settings);
        setSettingsChanged(false);
      } else {
        // Use default settings if API fails
        const result = await response.json();
        setCampaignSettings(result.settings);
        setSettingsChanged(false);
      }
    } catch (error) {
      console.error('Failed to load campaign settings:', error);
      // Keep current default settings
    } finally {
      setLoadingSettings(false);
    }
  };

  const openCampaignSettings = () => {
    setShowCampaignSettings(true);
    loadCampaignSettings();
  };

  const handleSaveSettings = async () => {
    try {
      const response = await fetch('/api/campaigns/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scope: 'workspace',
          ...campaignSettings
        })
      });

      if (response.ok) {
        const result = await response.json();
        toastError('Campaign settings saved successfully!');
        setCampaignSettings(result.settings);
        setSettingsChanged(false);
      } else {
        const error = await response.json();
        toastError(`Failed to save settings: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to save campaign settings:', error);
      toastError('Failed to save settings. Please try again.');
    }
  };

  const updateSetting = (key: string, value: any) => {
    setCampaignSettings({
      ...campaignSettings,
      [key]: value
    });
    setSettingsChanged(true);
  };

  const handleCheckboxArrayChange = (key: string, value: string, checked: boolean) => {
    const currentValues = campaignSettings[key] || [];
    let newValues;
    
    if (checked) {
      newValues = [...currentValues, value];
    } else {
      newValues = currentValues.filter((v: string) => v !== value);
    }
    
    updateSetting(key, newValues);
  };

  // Check if we're in "auto-create mode" (prospects from approval)
  const isAutoCreateMode = initialProspects && initialProspects.length > 0 && showBuilder;

  // Mock campaigns data (use the same from CampaignList component)
  const mockCampaigns = [
    {
      id: '1',
      name: 'Q4 SaaS Outreach',
      status: 'active',
      type: 'connector',
      prospects: 145,
      sent: 92,
      replies: 23,
      connections: 67,
      response_rate: 25.0,
      created_at: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Holiday Networking Campaign',
      status: 'active',
      type: 'messenger',
      prospects: 234,
      sent: 189,
      replies: 41,
      connections: 78,
      response_rate: 21.7,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '3',
      name: 'FinTech Decision Makers',
      status: 'paused',
      type: 'open_inmail',
      prospects: 178,
      sent: 134,
      replies: 19,
      connections: 0,
      response_rate: 14.2,
      created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '4',
      name: 'Tech Summit 2025 Invitations',
      status: 'active',
      type: 'event_invite',
      prospects: 298,
      sent: 267,
      replies: 58,
      connections: 0,
      response_rate: 21.7,
      created_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '5',
      name: 'Company Page Growth',
      status: 'active',
      type: 'company_follow',
      prospects: 456,
      sent: 423,
      replies: 89,
      connections: 356,
      response_rate: 21.0,
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '6',
      name: 'Product Launch Group Campaign',
      status: 'active',
      type: 'group',
      prospects: 89,
      sent: 72,
      replies: 31,
      connections: 0,
      response_rate: 43.1,
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '7',
      name: 'Inbound Lead Follow-up',
      status: 'active',
      type: 'inbound',
      prospects: 67,
      sent: 67,
      replies: 28,
      connections: 0,
      response_rate: 41.8,
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '8',
      name: 'Webinar Attendee Follow-up',
      status: 'active',
      type: 'event_participants',
      prospects: 234,
      sent: 198,
      replies: 67,
      connections: 0,
      response_rate: 33.8,
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '9',
      name: 'Re-engagement Campaign',
      status: 'active',
      type: 'recovery',
      prospects: 512,
      sent: 445,
      replies: 89,
      connections: 23,
      response_rate: 20.0,
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '10',
      name: 'Email Newsletter Campaign',
      status: 'completed',
      type: 'email',
      prospects: 1023,
      sent: 1023,
      replies: 156,
      connections: 0,
      response_rate: 15.2,
      created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  // Filter campaigns based on selected tab
  const filteredCampaigns = mockCampaigns.filter(c => {
    if (campaignFilter === 'active') return c.status === 'active' || c.status === 'paused';
    if (campaignFilter === 'inactive') return c.status === 'paused';
    if (campaignFilter === 'archived') return c.status === 'completed';
    return true;
  });

  // Handle campaign action menu (open settings)
  const handleCampaignAction = (campaignId: string) => {
    console.log('Opening settings for campaign:', campaignId);
    const campaign = mockCampaigns.find(c => c.id === campaignId);
    setSelectedCampaign(campaign || null);
    setShowCampaignSettings(true);
  };
  const campaignName = initialProspects?.[0]?.campaignTag || 'New Campaign';

  return (
    <div className="h-full bg-gray-900 p-6">
      {/* Campaign Assistant Modal */}
      <CampaignAssistantChat
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onCampaignCreated={onCampaignCreated}
      />

      {/* Floating Assistant Button */}
      {!isAssistantOpen && (
        <button
          onClick={() => setIsAssistantOpen(true)}
          className="fixed bottom-6 right-6 z-[9999] group relative w-16 h-16 rounded-full transition-transform hover:scale-110 active:scale-95 shadow-2xl"
          style={{ position: 'fixed', bottom: '24px', right: '24px' }}
          title="Campaign Assistant"
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 animate-pulse" />
          <div className="absolute inset-[2px] rounded-full bg-gray-900" />
          <img
            src="/SAM.jpg"
            alt="SAM AI"
            className="relative w-14 h-14 rounded-full object-cover z-10"
            style={{ objectPosition: 'center 30%' }}
          />
          <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-gray-700">
            Campaign Assistant
          </div>
        </button>
      )}

      {/* Main Campaign Hub Content - Full Width */}
      <div className="h-full overflow-y-auto">
      {/* Header - Different for auto-create mode */}
      {isAutoCreateMode ? (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
                <Target className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Creating Campaign: {campaignName}</h1>
                <p className="text-gray-400 text-sm">{initialProspects.length} approved prospects ready to launch</p>
              </div>
            </div>
            <button
              onClick={() => setShowFullFeatures(!showFullFeatures)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
            >
              {showFullFeatures ? (
                <>
                  <Eye className="w-4 h-4" />
                  Hide Full Hub
                </>
              ) : (
                <>
                  <Grid3x3 className="w-4 h-4" />
                  Show Full Hub
                </>
              )}
            </button>
          </div>
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="text-green-400" size={20} />
            <div className="flex-1">
              <p className="text-white text-sm font-medium">Prospects Loaded from Data Approval</p>
              <p className="text-gray-400 text-xs">Add your message templates below to complete the campaign setup</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
              <Megaphone className="mr-3" size={32} />
              Campaign Hub
            </h1>
            <p className="text-gray-400">Design, approve, and launch marketing campaigns</p>
          </div>
        </div>
      )}

      <div className="w-full space-y-8">
        {/* Pending Approval Section - Shows campaigns from Data Approval */}
        {initialProspects && initialProspects.length > 0 && !showBuilder && (
          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <div className="px-6 py-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="text-green-400" size={24} />
                  <div>
                    <h2 className="text-lg font-bold text-white">Pending Approval</h2>
                    <p className="text-sm text-gray-400">Campaigns ready for message creation</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-400">
                    {initialProspects.length} prospects approved
                  </div>
                  <button
                    onClick={() => setShowBuilder(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    <Plus size={16} />
                    New Campaign
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6">
              {(() => {
                // Group prospects by campaign name
                const campaignGroups = initialProspects.reduce((acc: any, prospect: any) => {
                  const campaignName = prospect.campaignName || prospect.campaignTag || 'Unnamed Campaign';
                  if (!acc[campaignName]) {
                    acc[campaignName] = [];
                  }
                  acc[campaignName].push(prospect);
                  return acc;
                }, {});

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(campaignGroups).map(([campaignName, prospects]: [string, any]) => (
                      <div key={campaignName} className="bg-gray-750 rounded-lg border border-gray-700 p-5 hover:border-purple-500/50 transition-all">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-white font-semibold mb-1">{campaignName}</h3>
                            <div className="flex items-center space-x-2 text-sm text-gray-400">
                              <Users size={14} />
                              <span>{prospects.length} prospects</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <button
                            onClick={() => {
                              // Open campaign builder with these prospects
                              setShowBuilder(true);
                            }}
                            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
                          >
                            <MessageSquare size={14} />
                            <span>Draft Messages</span>
                          </button>

                          <button
                            onClick={() => {
                              // Show prospect details
                              console.log('Show prospects:', prospects);
                              toastInfo(`${prospects.length} prospects in ${campaignName}`);
                            }}
                            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                          >
                            <Eye size={14} />
                            <span>View Prospects</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Campaign Approval Screen */}
        {showApprovalScreen && campaignDataForApproval && (
          <CampaignApprovalScreen
            campaignData={campaignDataForApproval}
            onApprove={async (finalCampaignData) => {
              // Execute campaign creation and N8N trigger
              await handleApproveCampaign(finalCampaignData);
            }}
            onReject={() => {
              // Go back to campaign builder
              setShowApprovalScreen(false);
              setCampaignDataForApproval(null);
            }}
            onRequestSAMHelp={(context) => {
              // TODO: Trigger main SAM chat with context
              console.log('SAM help requested:', context);
              toastError(`SAM help requested. Context: ${context}\n\nThis will open the main chat window with SAM ready to help you draft your message.`);
            }}
          />
        )}

        {/* Campaign Builder */}
        {showBuilder && !showApprovalScreen && (
          <div className="mb-6">
            <CampaignBuilder
              onClose={() => {
                setShowBuilder(false);
                onCampaignCreated?.();
              }}
              initialProspects={initialProspects}
              onPrepareForApproval={(campaignData) => {
                // Show approval screen
                setCampaignDataForApproval(campaignData);
                setShowApprovalScreen(true);
              }}
            />
          </div>
        )}

        {/* Campaign List with Tabs */}
        {!showBuilder && !showApprovalScreen && (
          <div className="bg-gray-800 rounded-lg border border-gray-700">
            {/* Status Tabs */}
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => setCampaignFilter('active')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  campaignFilter === 'active'
                    ? 'text-white border-b-2 border-purple-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setCampaignFilter('inactive')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  campaignFilter === 'inactive'
                    ? 'text-white border-b-2 border-purple-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Inactive
              </button>
              <button
                onClick={() => setCampaignFilter('archived')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  campaignFilter === 'archived'
                    ? 'text-white border-b-2 border-purple-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Archived
              </button>
              {/* Pending Approval Tab - Always visible */}
              <button
                onClick={() => setCampaignFilter('approval')}
                className={`px-6 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
                  campaignFilter === 'approval'
                    ? 'text-white border-b-2 border-yellow-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Pending Approval
                {approvalCounts.pending > 0 && (
                  <span className="px-2 py-0.5 bg-yellow-600 text-white text-xs rounded-full">
                    {approvalCounts.pending}
                  </span>
                )}
              </button>
            </div>

            {/* Conditional Content: Campaign Table OR Approval Table */}
            {campaignFilter === 'approval' ? (
              /* Message Approval Table */
              <div className="overflow-x-auto">
                {loadingApproval ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400">Loading pending approvals...</div>
                  </div>
                ) : approvalMessages.pending.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="mx-auto text-green-400 mb-4" size={48} />
                    <div className="text-white font-medium mb-2">All messages approved!</div>
                    <div className="text-gray-400">No pending message approvals at this time.</div>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-750">
                      <tr className="text-left text-gray-400 text-xs uppercase">
                        <th className="px-6 py-3 font-medium">Campaign</th>
                        <th className="px-6 py-3 font-medium">Step</th>
                        <th className="px-6 py-3 font-medium">Message Preview</th>
                        <th className="px-6 py-3 font-medium">Created</th>
                        <th className="px-6 py-3 font-medium">Characters</th>
                        <th className="px-6 py-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvalMessages.pending.map((msg: any) => (
                        <tr
                          key={msg.id}
                          onClick={() => setSelectedMessageForReview(msg)}
                          className="border-b border-gray-700 hover:bg-gray-750 transition-colors cursor-pointer"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                              <div>
                                <div className="text-white font-medium">{msg.campaign_name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-gray-300">Step {msg.step_number}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-gray-300 text-sm max-w-md truncate">
                              {msg.message_content}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-gray-400 text-sm">
                              {new Date(msg.created_at).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-sm ${msg.message_content?.length > 275 && msg.step_number === 1 ? 'text-yellow-400' : 'text-gray-400'}`}>
                              {msg.message_content?.length || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMessageForReview(msg);
                              }}
                              className="text-purple-400 hover:text-purple-300 transition-colors"
                            >
                              <Eye size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              /* Campaign Table */
              <div className="overflow-x-auto">
                <table className="w-full">
                <thead className="bg-gray-750">
                  <tr className="text-left text-gray-400 text-xs uppercase">
                    <th className="px-6 py-3 font-medium">Campaign</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Contacted</th>
                    <th className="px-6 py-3 font-medium">Connected</th>
                    <th className="px-6 py-3 font-medium">Replied</th>
                    <th className="px-6 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.map((campaign: any) => (
                    <tr
                      key={campaign.id}
                      onClick={() => handleCampaignAction(campaign.id)}
                      className="border-t border-gray-700 hover:bg-gray-750 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                          <div>
                            <div className="text-white font-medium">{campaign.name}</div>
                            <div className="text-gray-400 text-sm">Created {new Date(campaign.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-300">{getCampaignTypeLabel(campaign.type)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-white">{campaign.sent || 0}</div>
                        <div className="text-gray-400 text-sm">of {campaign.prospects || 0}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-white">{campaign.connections || 0}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-white">{campaign.replies || 0}</div>
                        <div className="text-gray-400 text-sm">{campaign.response_rate?.toFixed(1)}%</div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCampaignAction(campaign.id);
                          }}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          <Settings size={20} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {/* Performance Metrics - Hidden for now */}
        <div className="hidden grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <Mail className="text-blue-400 group-hover:scale-110 transition-transform" size={24} />
              <CheckCircle className="text-green-400" size={16} />
            </div>
            <div className="text-3xl font-bold text-white mb-2">179</div>
            <div className="text-gray-400 group-hover:text-purple-100 text-sm mb-1">Total Messages Sent</div>
            <div className="text-xs text-green-300">↑ 12% from last week</div>
          </div>
          
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <Eye className="text-blue-400 group-hover:scale-110 transition-transform" size={24} />
              <TrendingUp className="text-orange-400" size={16} />
            </div>
            <div className="text-3xl font-bold text-white mb-2">84</div>
            <div className="text-gray-400 group-hover:text-purple-100 text-sm mb-1">Messages Opened</div>
            <div className="text-xs text-orange-300">47% open rate</div>
          </div>
          
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <MessageSquare className="text-blue-400 group-hover:scale-110 transition-transform" size={24} />
              <Users className="text-purple-400" size={16} />
            </div>
            <div className="text-3xl font-bold text-white mb-2">17</div>
            <div className="text-gray-400 group-hover:text-purple-100 text-sm mb-1">Positive Replies</div>
            <div className="text-xs text-purple-300">9.5% reply rate</div>
          </div>
        </div>

      {/* Template Library Modal */}
      {showTemplateLibrary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 border border-gray-600 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Template Library</h3>
              <button
                onClick={() => setShowTemplateLibrary(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            {loadingTemplates ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-400">Loading templates...</div>
              </div>
            ) : (
              <div className="space-y-4">
                {templates.map((template) => (
                  <div key={template.id} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-white font-medium">{template.name}</h4>
                      <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded">
                        {template.type.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm mb-3">{template.description}</p>
                    <div className="space-y-2">
                      {template.steps?.map((step: any, index: number) => (
                        <div key={index} className="bg-gray-600 p-3 rounded cursor-pointer hover:bg-gray-500 transition-colors">
                          <div className="text-sm font-medium text-white mb-1">
                            Step {index + 1}: {step.step_type}
                          </div>
                          <div className="text-xs text-gray-300">
                            {step.message_template.substring(0, 100)}...
                          </div>
                          {step.delay_days > 0 && (
                            <div className="text-xs text-blue-300 mt-1">
                              Delay: {step.delay_days} days
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-600">
                      <span className="text-xs text-gray-400">
                        Expected Response: {template.expected_response_rate}%
                      </span>
                      <button className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors">
                        Use Template
                      </button>
                    </div>
                  </div>
                ))}
                {templates.length === 0 && !loadingTemplates && (
                  <div className="text-center py-12 text-gray-400">
                    No templates found. Check your API connection.
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowTemplateLibrary(false)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Cloning Modal */}
      {showCampaignCloning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 border border-gray-600">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Clone Campaign</h3>
              <button
                onClick={() => setShowCampaignCloning(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Select Campaign to Clone</label>
                <select 
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">Select a campaign...</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name} - {campaign.status}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">New Campaign Name</label>
                <input
                  type="text"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="Enter new campaign name..."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description (Optional)</label>
                <textarea
                  value={newCampaignDescription}
                  onChange={(e) => setNewCampaignDescription(e.target.value)}
                  placeholder="Enter description for cloned campaign..."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Clone Settings</label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        checked={cloneTemplates}
                        onChange={(e) => setCloneTemplates(e.target.checked)}
                        className="mr-2" 
                      />
                      <span className="text-gray-300 text-sm">Message templates</span>
                    </label>
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        checked={cloneSettings}
                        onChange={(e) => setCloneSettings(e.target.checked)}
                        className="mr-2" 
                      />
                      <span className="text-gray-300 text-sm">Campaign settings</span>
                    </label>
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        checked={cloneProspects}
                        onChange={(e) => setCloneProspects(e.target.checked)}
                        className="mr-2" 
                      />
                      <span className="text-gray-300 text-sm">Prospect list</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Modifications</label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" />
                      <span className="text-gray-300 text-sm">Update industry targeting</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" />
                      <span className="text-gray-300 text-sm">Adjust message tone</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" />
                      <span className="text-gray-300 text-sm">Change timing settings</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCampaignCloning(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCloneCampaign}
                disabled={isCloning || !selectedCampaignId || !newCampaignName.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isCloning ? 'Cloning...' : 'Clone Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Settings Modal */}
      {showCampaignSettings && selectedCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-3xl w-full mx-4 border border-gray-600 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Settings size={24} className="text-white" />
                <h3 className="text-xl font-semibold text-white">Settings</h3>
                <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded ml-2">
                  {selectedCampaign.type === 'linkedin' ? 'LinkedIn' :
                   selectedCampaign.type === 'email' ? 'Email' : 'Multi-Channel'}
                </span>
              </div>
              <button
                onClick={() => setShowCampaignSettings(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Campaign Name */}
              <div className="border-b border-gray-700 pb-6">
                <h4 className="text-white font-medium mb-2">Campaign name</h4>
                <p className="text-gray-400 text-sm mb-3">Rename your campaign here for easier campaign management.</p>
                <input
                  type="text"
                  defaultValue={selectedCampaign.name}
                  maxLength={100}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
                />
                <div className="text-right text-gray-400 text-xs mt-1">Characters: {selectedCampaign.name.length}/100</div>
              </div>

              {/* Campaign Limits */}
              <div className="border-b border-gray-700 pb-6">
                <h4 className="text-white font-medium mb-2">Campaign limits</h4>
                <p className="text-gray-400 text-sm mb-4">
                  Specify the daily limit for this campaign. These limits will be applied to reach out to your leads.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="text-gray-300 text-sm mb-2 block">
                      {selectedCampaign.type === 'linkedin'
                        ? 'Set the number of new connection requests to send daily:'
                        : selectedCampaign.type === 'email'
                        ? 'Set the number of new emails to send daily:'
                        : 'Set the number of new contacts to reach daily:'}
                    </label>
                    <input type="range" min="0" max="100" defaultValue="15" className="w-full" />
                    <div className="flex justify-between text-gray-400 text-xs mt-1">
                      <span>0</span>
                      <span className="text-white font-medium">15</span>
                      <span>100</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-gray-300 text-sm mb-2 block">
                      {selectedCampaign.type === 'linkedin'
                        ? 'Set the number of LinkedIn follow-up messages to send daily:'
                        : selectedCampaign.type === 'email'
                        ? 'Set the number of follow-up emails to send daily:'
                        : 'Set the number of follow-up messages to send daily:'}
                    </label>
                    <input type="range" min="0" max="100" defaultValue="20" className="w-full" />
                    <div className="flex justify-between text-gray-400 text-xs mt-1">
                      <span>0</span>
                      <span className="text-white font-medium">20</span>
                      <span>100</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Campaign Priority */}
              <div className="border-b border-gray-700 pb-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-medium">Campaign Priority</h4>
                  <label className="flex items-center gap-2">
                    <span className="text-gray-300 text-sm">Use priority</span>
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                  </label>
                </div>
                <p className="text-gray-400 text-sm mb-3">If enabled, each campaign will have a default priority value "Medium". If a campaign priority is changed to "High" more actions will be scheduled to be sent from it in comparison to campaigns with lower priority.</p>
                <select className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm">
                  <option>Medium</option>
                  <option>High</option>
                  <option>Low</option>
                </select>
              </div>

              {/* Schedule Campaign */}
              <div className="border-b border-gray-700 pb-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-medium">Schedule campaign</h4>
                  <label className="flex items-center gap-2">
                    <span className="text-gray-300 text-sm">Start immediately</span>
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                  </label>
                </div>
                <p className="text-gray-400 text-sm mb-3">
                  {selectedCampaign.type === 'linkedin' || selectedCampaign.type === 'multi_channel'
                    ? 'You can schedule when campaign will be active. Once set to active, LinkedIn messages will start being sent during your account\'s active hours.'
                    : 'You can schedule when campaign will be active. Once set to active, emails will start being sent immediately.'}
                </p>
                <input
                  type="datetime-local"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                />
                <p className="text-gray-400 text-xs mt-2">Times are set according to the time zone US/Mountain (GMT -0600), which can also be set from the <span className="text-purple-400">account settings</span>.</p>
              </div>

              {/* Prospects */}
              <div className="border-b border-gray-700 pb-6">
                <h4 className="text-white font-medium mb-2">Prospects</h4>
                {selectedCampaign.type === 'linkedin' || selectedCampaign.type === 'multi_channel' ? (
                  <>
                    <p className="text-gray-400 text-sm mb-3">Override and allow outreaching to LinkedIn profiles from the same company</p>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" className="w-4 h-4 rounded" />
                      <span className="text-white text-sm">Override LinkedIn profiles</span>
                    </label>
                    <p className="text-gray-400 text-xs mt-2">Enable duplicating leads between company campaigns</p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-400 text-sm mb-3">Email campaign prospect settings</p>
                    <label className="flex items-center gap-3 mb-2">
                      <input type="checkbox" className="w-4 h-4 rounded" />
                      <span className="text-white text-sm">Allow duplicate email addresses</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" className="w-4 h-4 rounded" defaultChecked />
                      <span className="text-white text-sm">Skip bounced emails</span>
                    </label>
                    <p className="text-gray-400 text-xs mt-2">Automatically skip previously bounced email addresses</p>
                  </>
                )}
              </div>

              {/* Campaign Steps / Message Sequence */}
              <div className="border-b border-gray-700 pb-6">
                <h4 className="text-white font-medium mb-2">Campaign steps</h4>
                <p className="text-gray-400 text-sm mb-4">
                  Configure your message sequence, timing, and personalization. Each step includes message text, delay days, and personalization tags.
                </p>

                {/* Quick Summary */}
                <div className="bg-gray-700 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium mb-1">Current sequence: 3 steps</div>
                      <div className="text-gray-400 text-sm">Connection request + 2 follow-ups over 10 days</div>
                    </div>
                    <div className="text-right">
                      <div className="text-green-400 text-sm">✓ Messages configured</div>
                      <div className="text-gray-400 text-xs">Last edited 2 days ago</div>
                    </div>
                  </div>
                </div>

                {/* Edit Steps Button */}
                <button
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                  onClick={() => setShowStepsEditor(true)}
                >
                  <Edit size={18} />
                  <span>Edit campaign steps & messages</span>
                </button>

                <div className="mt-3 text-xs text-gray-400 text-center">
                  Opens full editor with SAM chat assistant
                </div>
              </div>

              {/* Campaign Status */}
              <div className="border-b border-gray-700 pb-6">
                <h4 className="text-white font-medium mb-2">Campaign status</h4>
                <p className="text-gray-400 text-sm mb-3">
                  {selectedCampaign.type === 'linkedin'
                    ? 'You can turn this campaign on and off. An active campaign will send LinkedIn connection requests and messages according to your settings.'
                    : selectedCampaign.type === 'email'
                    ? 'You can turn this campaign on and off. An active campaign will send emails according to your settings.'
                    : 'You can turn this campaign on and off. An active campaign will send messages across all channels according to your settings.'}
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-600">
                    <div className={`w-3 h-3 rounded-full ${
                      selectedCampaign.status === 'active' ? 'bg-green-500' :
                      selectedCampaign.status === 'paused' ? 'bg-yellow-500' :
                      selectedCampaign.status === 'completed' ? 'bg-blue-500' :
                      'bg-gray-500'
                    }`}></div>
                    <span className="text-white capitalize">{selectedCampaign.status}</span>
                  </div>
                  <select className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm">
                    <option value="active">Active - Campaign is running</option>
                    <option value="paused">Paused - Campaign is temporarily stopped</option>
                    <option value="inactive">Inactive - Campaign draft</option>
                    <option value="completed">Completed - Campaign finished</option>
                    <option value="archived">Archived - Campaign archived</option>
                  </select>
                </div>
              </div>

              {/* Delete Campaign */}
              <div>
                <h4 className="text-white font-medium mb-2">Delete campaign</h4>
                <p className="text-gray-400 text-sm mb-3">Deleting a campaign will stop all the campaign's activity. Contacts from the campaign will remain in 'My Network' and in your 'Inbox', however, they will no longer receive messages from the deleted campaign. You will be able to continue manual communication with these contacts.</p>
                <button className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                  <X size={16} />
                  Delete campaign
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-700">
              <button className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Approval Modal - REPLACED BY APPROVAL TAB */}
      {false && showMessageApproval && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 border border-gray-600 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Message Approval Queue</h3>
              <button
                onClick={() => setShowMessageApproval(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Pending Messages */}
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-yellow-400 font-medium">
                    Pending Approval ({approvalCounts.pending})
                  </h4>
                  {approvalCounts.pending > 0 && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleBulkApproval('approve')}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded"
                      >
                        Approve All
                      </button>
                      <button 
                        onClick={() => handleBulkApproval('reject')}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
                      >
                        Reject All
                      </button>
                    </div>
                  )}
                </div>
                
                {loadingApproval ? (
                  <div className="text-center py-4">
                    <div className="text-gray-400">Loading messages...</div>
                  </div>
                ) : approvalMessages.pending.length === 0 ? (
                  <div className="text-center py-4">
                    <div className="text-gray-400">No pending messages</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {approvalMessages.pending.map((message: any) => (
                      <div key={message.id} className="bg-gray-700 rounded p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="text-white font-medium">
                              {message.campaign_prospects?.workspace_prospects?.first_name} {message.campaign_prospects?.workspace_prospects?.last_name}
                              {message.campaign_prospects?.workspace_prospects?.company_name && ` - ${message.campaign_prospects?.workspace_prospects?.company_name}`}
                            </span>
                            <span className="text-gray-400 text-sm ml-2">
                              {message.message_type || 'Message'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleApproveMessage(message.id)}
                              className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                            >
                              Approve
                            </button>
                            <button 
                              onClick={() => handleRejectMessage(message.id)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                        <div className="text-gray-300 text-sm bg-gray-600 p-2 rounded">
                          {message.message_content || message.message_text || 'No message content'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Approved Messages */}
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <h4 className="text-green-400 font-medium mb-3">
                  Recently Approved ({approvalCounts.approved})
                </h4>
                {approvalMessages.approved.length === 0 ? (
                  <div className="text-center py-2">
                    <div className="text-gray-400 text-sm">No recently approved messages</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {approvalMessages.approved.slice(0, 5).map((message: any) => (
                      <div key={message.id} className="bg-gray-700 rounded p-3 text-sm">
                        <span className="text-white">
                          {message.campaign_prospects?.workspace_prospects?.first_name} {message.campaign_prospects?.workspace_prospects?.last_name}
                          {message.campaign_prospects?.workspace_prospects?.company_name && ` - ${message.campaign_prospects?.workspace_prospects?.company_name}`}
                        </span>
                        <span className="text-gray-400 ml-2">
                          • Approved {message.approved_at ? new Date(message.approved_at).toLocaleString() : 'recently'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rejected Messages */}
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <h4 className="text-red-400 font-medium mb-3">
                  Recently Rejected ({approvalCounts.rejected})
                </h4>
                {approvalMessages.rejected.length === 0 ? (
                  <div className="text-center py-2">
                    <div className="text-gray-400 text-sm">No recently rejected messages</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {approvalMessages.rejected.slice(0, 5).map((message: any) => (
                      <div key={message.id} className="bg-gray-700 rounded p-3 text-sm">
                        <span className="text-white">
                          {message.campaign_prospects?.workspace_prospects?.first_name} {message.campaign_prospects?.workspace_prospects?.last_name}
                          {message.campaign_prospects?.workspace_prospects?.company_name && ` - ${message.campaign_prospects?.workspace_prospects?.company_name}`}
                        </span>
                        <span className="text-gray-400 ml-2">
                          • Rejected {message.approved_at ? new Date(message.approved_at).toLocaleString() : 'recently'}
                        </span>
                        {message.rejection_reason && (
                          <span className="text-red-400 ml-2">• Reason: {message.rejection_reason}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowMessageApproval(false)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled Campaigns Modal */}
      {showScheduledCampaigns && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-3xl w-full mx-4 border border-gray-600 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Scheduled Campaigns</h3>
              <button
                onClick={() => setShowScheduledCampaigns(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Create Schedule */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Schedule New Campaign</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Campaign</label>
                    <select className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm">
                      <option>Select campaign...</option>
                      <option>Q4 SaaS Outreach</option>
                      <option>Holiday Networking</option>
                      <option>New Year Prospecting</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Start Date</label>
                    <input type="datetime-local" className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">End Date</label>
                    <input type="datetime-local" className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm" />
                  </div>
                </div>
                <button className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
                  Schedule Campaign
                </button>
              </div>

              {/* Upcoming Schedules */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <h4 className="text-blue-400 font-medium mb-3">Upcoming Schedules</h4>
                <div className="space-y-3">
                  <div className="bg-gray-700 rounded p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-white font-medium">Holiday Networking Campaign</div>
                        <div className="text-gray-400 text-sm">Starts: Dec 15, 2024 at 9:00 AM</div>
                        <div className="text-gray-400 text-sm">Expected Duration: 2 weeks</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded">Edit</button>
                        <button className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded">Cancel</button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-700 rounded p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-white font-medium">Q1 2025 Prospecting Blitz</div>
                        <div className="text-gray-400 text-sm">Starts: Jan 2, 2025 at 8:00 AM</div>
                        <div className="text-gray-400 text-sm">Expected Duration: 1 month</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded">Edit</button>
                        <button className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded">Cancel</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Schedules */}
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <h4 className="text-green-400 font-medium mb-3">Currently Active</h4>
                <div className="bg-gray-700 rounded p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-white font-medium">November B2B Outreach</div>
                      <div className="text-gray-400 text-sm">Started: Nov 1, 2024 • Progress: 65%</div>
                      <div className="text-gray-400 text-sm">Messages sent: 156/240</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded">Pause</button>
                      <button className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded">Stop</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowScheduledCampaigns(false)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* A/B Testing Hub Modal */}
      {showABTesting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 border border-gray-600 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">A/B Testing Hub</h3>
              <button
                onClick={() => setShowABTesting(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Create New Test */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Create New A/B Test</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Test Name</label>
                    <input type="text" placeholder="e.g., Subject Line Test - Dec 2024" className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Test Type</label>
                    <select className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm">
                      <option>Connection Message</option>
                      <option>Follow-up Message</option>
                      <option>Message Timing</option>
                      <option>Subject Line</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Variant A</label>
                    <textarea rows={3} placeholder="Enter first variant..." className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm"></textarea>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Variant B</label>
                    <textarea rows={3} placeholder="Enter second variant..." className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm"></textarea>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Sample Size</label>
                    <input type="number" defaultValue="100" className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Split %</label>
                    <select className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm">
                      <option>50/50</option>
                      <option>60/40</option>
                      <option>70/30</option>
                      <option>80/20</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Duration (days)</label>
                    <input type="number" defaultValue="7" className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm" />
                  </div>
                </div>
                
                <button className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
                  Start A/B Test
                </button>
              </div>

              {/* Active Tests */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <h4 className="text-blue-400 font-medium mb-3">Active Tests (2)</h4>
                <div className="space-y-3">
                  <div className="bg-gray-700 rounded p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-white font-medium">Holiday Subject Line Test</div>
                        <div className="text-gray-400 text-sm">Started 3 days ago • 5 days remaining</div>
                      </div>
                      <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">Running</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-600 p-3 rounded">
                        <div className="text-sm text-gray-300 mb-1">Variant A: "Quick holiday question"</div>
                        <div className="text-white font-medium">Response Rate: 18.5%</div>
                        <div className="text-gray-400 text-xs">45 sent, 8 replies</div>
                      </div>
                      <div className="bg-gray-600 p-3 rounded">
                        <div className="text-sm text-gray-300 mb-1">Variant B: "End-of-year opportunity"</div>
                        <div className="text-white font-medium">Response Rate: 23.1%</div>
                        <div className="text-gray-400 text-xs">39 sent, 9 replies</div>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex gap-2">
                      <button className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded">Pause</button>
                      <button className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded">Stop</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Completed Tests */}
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <h4 className="text-green-400 font-medium mb-3">Completed Tests</h4>
                <div className="space-y-3">
                  <div className="bg-gray-700 rounded p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-white font-medium">Q4 Connection Message Test</div>
                        <div className="text-gray-400 text-sm">Completed 1 week ago</div>
                      </div>
                      <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">Winner: B</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-600 p-3 rounded">
                        <div className="text-sm text-gray-300 mb-1">Variant A: Professional approach</div>
                        <div className="text-white font-medium">Response Rate: 12.3%</div>
                        <div className="text-gray-400 text-xs">100 sent, 12 replies</div>
                      </div>
                      <div className="bg-gray-600 p-3 rounded border-2 border-green-500">
                        <div className="text-sm text-gray-300 mb-1">Variant B: Value-focused approach</div>
                        <div className="text-white font-medium">Response Rate: 19.8%</div>
                        <div className="text-gray-400 text-xs">100 sent, 20 replies</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowABTesting(false)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Steps Editor */}
      {showStepsEditor && selectedCampaign && (
        <CampaignStepsEditor
          campaignId={selectedCampaign.id}
          campaignName={selectedCampaign.name}
          campaignType={selectedCampaign.type}
          onClose={() => setShowStepsEditor(false)}
          onSave={(steps) => {
            console.log('Saved campaign steps:', steps);
            // TODO: Save steps to database
            setShowStepsEditor(false);
          }}
        />
      )}

      {/* Message Review Detail Modal */}
      {selectedMessageForReview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gray-750 px-6 py-4 border-b border-gray-700 flex items-center justify-between sticky top-0">
              <div>
                <h3 className="text-xl font-semibold text-white">{selectedMessageForReview.campaign_name}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-sm text-gray-400">
                    Step {selectedMessageForReview.step_number} • {new Date(selectedMessageForReview.created_at).toLocaleString()}
                  </p>
                  <span className="text-gray-600">•</span>
                  <button
                    onClick={() => loadCampaignProspects(selectedMessageForReview.campaign_id)}
                    disabled={loadingProspects}
                    className="text-sm text-purple-400 hover:text-purple-300 underline transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <Users size={14} />
                    {loadingProspects ? 'Loading...' : 'View Approved Prospects'}
                  </button>
                </div>
              </div>
              <button
                onClick={() => setSelectedMessageForReview(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Message Content */}
            <div className="p-6 space-y-6">
              {/* Message Body */}
              <div>
                <label className="text-sm font-medium text-gray-400 mb-2 block">Message Content</label>
                <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
                  <div className="text-gray-100 text-base leading-relaxed whitespace-pre-wrap">
                    {selectedMessageForReview.message_content}
                  </div>
                </div>
              </div>

              {/* Message Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-750 rounded-lg p-4 border border-gray-700">
                  <div className="text-gray-400 text-xs uppercase mb-1">Characters</div>
                  <div className={`text-2xl font-semibold ${selectedMessageForReview.message_content?.length > 275 && selectedMessageForReview.step_number === 1 ? 'text-yellow-400' : 'text-white'}`}>
                    {selectedMessageForReview.message_content?.length || 0}
                  </div>
                  {selectedMessageForReview.message_content?.length > 275 && selectedMessageForReview.step_number === 1 && (
                    <div className="text-yellow-400 text-xs mt-1 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      Exceeds LinkedIn limit
                    </div>
                  )}
                </div>
                <div className="bg-gray-750 rounded-lg p-4 border border-gray-700">
                  <div className="text-gray-400 text-xs uppercase mb-1">Personalization Tags</div>
                  <div className="text-2xl font-semibold text-white">
                    {(selectedMessageForReview.message_content?.match(/\{\{.*?\}\}/g) || []).length}
                  </div>
                  <div className="text-gray-400 text-xs mt-1">Dynamic fields</div>
                </div>
                <div className="bg-gray-750 rounded-lg p-4 border border-gray-700">
                  <div className="text-gray-400 text-xs uppercase mb-1">Status</div>
                  <div className="text-2xl font-semibold text-yellow-400">Pending</div>
                  <div className="text-gray-400 text-xs mt-1">Awaiting review</div>
                </div>
              </div>

              {/* Personalization Tags Used */}
              {(selectedMessageForReview.message_content?.match(/\{\{.*?\}\}/g) || []).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-400 mb-2 block">Personalization Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(selectedMessageForReview.message_content?.match(/\{\{.*?\}\}/g) || [])).map((tag: string, idx: number) => (
                      <span key={idx} className="px-3 py-1 bg-purple-600/20 text-purple-300 text-sm rounded-full border border-purple-500/40">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedMessageForReview(null)}
                    className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // TODO: Open SAM chat with context about this message
                      console.log('Ask SAM for help with message:', selectedMessageForReview);
                      toastError('SAM chat integration coming soon! This will open a chat with SAM to help improve this message.');
                    }}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Brain size={18} />
                    Ask SAM to Improve
                  </button>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      handleRejectMessage(selectedMessageForReview.id);
                      setSelectedMessageForReview(null);
                    }}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <XCircle size={18} />
                    Reject Message
                  </button>
                  <button
                    onClick={() => {
                      handleApproveMessage(selectedMessageForReview.id);
                      setSelectedMessageForReview(null);
                    }}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <CheckCircle size={18} />
                    Approve Message
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Prospects Modal */}
      {showCampaignProspects && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gray-750 px-6 py-4 border-b border-gray-700 flex items-center justify-between sticky top-0">
              <div>
                <h3 className="text-xl font-semibold text-white">Approved Prospects</h3>
                <p className="text-sm text-gray-400 mt-1">
                  {campaignProspects.length} prospect{campaignProspects.length !== 1 ? 's' : ''} approved for this campaign
                </p>
              </div>
              <button
                onClick={() => setShowCampaignProspects(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Prospect List */}
            <div className="p-6">
              {campaignProspects.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="mx-auto text-gray-600 mb-4" size={48} />
                  <div className="text-white font-medium mb-2">No prospects found</div>
                  <div className="text-gray-400">This campaign doesn't have any approved prospects yet.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaignProspects.map((prospect: any) => (
                    <div
                      key={prospect.id}
                      className="bg-gray-750 border border-gray-600 rounded-lg p-4 hover:border-purple-500/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-white font-semibold">{prospect.workspace_prospects?.full_name || prospect.name || 'Unknown'}</h4>
                            {prospect.approval_status === 'approved' && (
                              <span className="px-2 py-0.5 bg-green-600/20 text-green-400 text-xs rounded-full border border-green-500/40">
                                ✓ Approved
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            {prospect.workspace_prospects?.job_title && (
                              <div>
                                <span className="text-gray-400">Title:</span>
                                <span className="text-gray-300 ml-2">{prospect.workspace_prospects.job_title}</span>
                              </div>
                            )}
                            {prospect.workspace_prospects?.company_name && (
                              <div>
                                <span className="text-gray-400">Company:</span>
                                <span className="text-gray-300 ml-2">{prospect.workspace_prospects.company_name}</span>
                              </div>
                            )}
                            {prospect.workspace_prospects?.email && (
                              <div>
                                <span className="text-gray-400">Email:</span>
                                <span className="text-gray-300 ml-2">{prospect.workspace_prospects.email}</span>
                              </div>
                            )}
                            {prospect.workspace_prospects?.linkedin_url && (
                              <div>
                                <span className="text-gray-400">LinkedIn:</span>
                                <a
                                  href={prospect.workspace_prospects.linkedin_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-purple-400 hover:text-purple-300 ml-2 underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  View Profile
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-750 px-6 py-4 border-t border-gray-700 flex justify-end sticky bottom-0">
              <button
                onClick={() => setShowCampaignProspects(false)}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
    </div>
  );
};

export default CampaignHub;
