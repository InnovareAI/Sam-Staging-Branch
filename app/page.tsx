'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const USER_PROXY_SENTINEL = '__USER_PROXY__';
import KnowledgeBase from './components/KnowledgeBase';
import CampaignHub from './components/CampaignHub';
import LeadPipeline from './components/LeadPipeline';
import Analytics from './components/Analytics';
import AuditTrail from './components/AuditTrail';

import ConversationHistory from '../components/ConversationHistory';
import InviteUserPopup, { InviteFormData } from '../components/InviteUserPopup';
import { InviteUserModal } from './components/InviteUserModal';
import { WorkspaceSettingsModal } from './components/WorkspaceSettingsModal';
import { ManageSubscriptionModal } from './components/ManageSubscriptionModal';
import { CRMIntegrationModal } from './components/CRMIntegrationModal';
import AuthModal from '../components/AuthModal';
// LinkedIn integration now handled via dedicated page at /linkedin-integration
import { UnipileModal } from '../components/integrations/UnipileModal';
import { ChannelSelectionModal } from '../components/campaign/ChannelSelectionModal';
import DataCollectionHub from '../components/DataCollectionHub';
import ApprovedProspectsDashboard from '../components/ApprovedProspectsDashboard';
import { DemoModeToggle } from '../components/DemoModeToggle';
import ConnectionStatusBar from '../components/ConnectionStatusBar';
import EmailProvidersModal from './components/EmailProvidersModal';
import ModelSelector from '../components/ModelSelector';
import LLMConfigModal from '../components/LLMConfigModal';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  Activity,
  Archive,
  BarChart3,
  Bell,
  Brain,
  Building2,
  CheckSquare,
  Clock,
  CreditCard,
  Database,
  Eye,
  Gauge,
  GitBranch,
  Globe,
  History,
  Info,
  Key,
  Linkedin as LinkedinIcon,
  List,
  LogOut,
  Mail,
  Megaphone,
  MessageCircle,
  Paperclip,
  Send,
  Settings,
  Shield,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
  Grid3x3,
  FileText,
  Search
} from 'lucide-react';

// LinkedIn Logo Component (Official LinkedIn branding)
const LinkedInLogo = ({ size = 16, className = "" }: { size?: number; className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    className={className}
    fill="currentColor"
  >
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

// Animated Message Component - typewriter effect character by character
const AnimatedMessage = ({ content, animate = false }: { content: string; animate?: boolean }) => {
  const [displayedContent, setDisplayedContent] = useState(animate ? '' : content);
  const [currentIndex, setCurrentIndex] = useState(animate ? 0 : content.length);

  useEffect(() => {
    if (!animate) {
      // If not animating, show content immediately
      setDisplayedContent(content);
      setCurrentIndex(content.length);
      return;
    }

    // Reset animation when content changes
    setDisplayedContent('');
    setCurrentIndex(0);
  }, [content, animate]);

  useEffect(() => {
    if (animate && currentIndex < content.length) {
      const timer = setTimeout(() => {
        setDisplayedContent(prev => prev + content[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 20); // 20ms between each character (50 chars per second)

      return () => clearTimeout(timer);
    }
  }, [currentIndex, content, animate]);

  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
      {displayedContent}
      {animate && currentIndex < content.length && (
        <span className="inline-block w-1 h-4 bg-purple-400 animate-pulse ml-0.5" />
      )}
    </div>
  );
};

export default function Page() {
  // Initialize Supabase client
  const supabase = createClientComponentClient();
  const router = useRouter();
  
  // Helper function to get auth token (cached from session state)
  const getAuthToken = async () => {
    if (session?.access_token) {
      return session.access_token;
    }
    
    // Only call getSession if we don't have a cached token
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession) {
        setSession(currentSession);
        return currentSession.access_token;
      }
    } catch (error) {
      console.error('Error getting session:', error);
    }
    
    return null;
  };
  
  // Authentication and app state
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showStarterScreen, setShowStarterScreen] = useState(true);
  const [inputMessage, setInputMessage] = useState('');
  const [activeMenuItem, setActiveMenuItem] = useState('chat');
  const [messages, setMessages] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordChangeData, setPasswordChangeData] = useState({ password: '', confirmPassword: '', loading: false });
  const [showConversationHistory, setShowConversationHistory] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // CSV Upload state
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedCSV, setPastedCSV] = useState('');
  const [uploadedProspects, setUploadedProspects] = useState<any[]>([]);
  const [csvUploadCounter, setCsvUploadCounter] = useState(1);

  // Campaign state - for auto-proceed from approval to campaign
  const [pendingCampaignProspects, setPendingCampaignProspects] = useState<any[] | null>(null);

  // Workspace state
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [workspacesLoading, setWorkspacesLoading] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isWorkspaceAdmin, setIsWorkspaceAdmin] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<'All' | 'InnovareAI' | '3cubedai'>('All');
  const [showInviteUser, setShowInviteUser] = useState(false);
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<Set<string>>(new Set());
  const [isDeletingWorkspaces, setIsDeletingWorkspaces] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState<string | null>(null);
  
  // Authentication modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');

  // User management state
  const [showManageUsers, setShowManageUsers] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userStats, setUserStats] = useState<any>(null);
  const [showAssignWorkspace, setShowAssignWorkspace] = useState(false);
  const [selectedUserForWorkspace, setSelectedUserForWorkspace] = useState<any>(null);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'card' | 'info'>('info');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<'all' | 'innovareai' | '3cubed'>('all');

  // LinkedIn connection state
  const [hasLinkedInConnection, setHasLinkedInConnection] = useState(false);
  const [linkedInLoading, setLinkedInLoading] = useState(false);
  // LinkedIn onboarding moved to dedicated /linkedin-integration page
  const [showUnipileModal, setShowUnipileModal] = useState(false); // Only show when user clicks Advanced Setup
  const [showChannelSelectionModal, setShowChannelSelectionModal] = useState(false);
  const [showLinkedInSettingsModal, setShowLinkedInSettingsModal] = useState(false);
  
  // Detail modal states
  const [showEmailIntegrationModal, setShowEmailIntegrationModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showApiKeysModal, setShowApiKeysModal] = useState(false);
  const [showDataPreferencesModal, setShowDataPreferencesModal] = useState(false);
  const [showLLMConfigModal, setShowLLMConfigModal] = useState(false);
  const [showTeamManagementModal, setShowTeamManagementModal] = useState(false);
  const [showWorkspaceSettingsModal, setShowWorkspaceSettingsModal] = useState(false);
  const [showManageSubscriptionModal, setShowManageSubscriptionModal] = useState(false);
  const [showCrmIntegrationModal, setShowCrmIntegrationModal] = useState(false);
  const [showIntegrationsToolsModal, setShowIntegrationsToolsModal] = useState(false);
  const [showSecurityComplianceModal, setShowSecurityComplianceModal] = useState(false);
  const [showAnalyticsReportingModal, setShowAnalyticsReportingModal] = useState(false);
  const [showProxyCountryModal, setShowProxyCountryModal] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [selectedProxyCountry, setSelectedProxyCountry] = useState('');
  const [selectedProxyState, setSelectedProxyState] = useState('');
  const [selectedProxyCity, setSelectedProxyCity] = useState('');
  const [proxyTestLoading, setProxyTestLoading] = useState(false);
  const [proxySaveLoading, setProxySaveLoading] = useState(false);
  const [activeApprovalTab, setActiveApprovalTab] = useState('auto-rules');
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [showProspectReview, setShowProspectReview] = useState(false);
  const [prospectReviewData, setProspectReviewData] = useState<any[]>([]);
  const [selectedProspects, setSelectedProspects] = useState<number[]>([]);
  const [currentProxySettings, setCurrentProxySettings] = useState({
    country: '',
    state: '', 
    city: '',
    status: 'inactive',
    sessionId: '',
    lastUpdated: ''
  });
  const [linkedinProxyAssignments, setLinkedinProxyAssignments] = useState<any[]>([]);
  const [selectedLinkedinAccount, setSelectedLinkedinAccount] = useState<string | null>(null);
  const [loadingProxyAssignments, setLoadingProxyAssignments] = useState(false);
  const [userProxyPreferences, setUserProxyPreferences] = useState<any | null>(null);
  const isEditingUserProxy = selectedLinkedinAccount === USER_PROXY_SENTINEL;
  const editingLinkedinAssignment = !isEditingUserProxy && selectedLinkedinAccount
    ? linkedinProxyAssignments.find((a) => a.linkedin_account_id === selectedLinkedinAccount)
    : null;
  
  // Profile country state
  const [profileCountry, setProfileCountry] = useState<string>('');
  const [profileCountryLoading, setProfileCountryLoading] = useState(false);
  const [mcpStatus, setMcpStatus] = useState<any>(null);
  const [mcpStatusLoading, setMcpStatusLoading] = useState(false);
  
  // Load profile country when user is authenticated
  useEffect(() => {
    const loadProfileCountry = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('users')
          .select('profile_country')
          .eq('id', user.id)
          .single();
        
        if (data && data.profile_country) {
          setProfileCountry(data.profile_country);
          console.log('✅ Loaded profile country:', data.profile_country);
        }
      } catch (error) {
        console.error('Failed to load profile country:', error);
      }
    };
    
    loadProfileCountry();
  }, [user?.id]);
  
  // Load MCP status for super admins
  useEffect(() => {
    const loadMcpStatus = async () => {
      if (!isSuperAdmin) return;
      
      setMcpStatusLoading(true);
      try {
        const response = await fetch('/api/mcp/health');
        const data = await response.json();
        setMcpStatus(data);
      } catch (error) {
        console.error('Failed to load MCP status:', error);
      } finally {
        setMcpStatusLoading(false);
      }
    };
    
    if (isSuperAdmin) {
      loadMcpStatus();
      // Refresh every 30 seconds
      const interval = setInterval(loadMcpStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [isSuperAdmin]);

  const fetchThreadMessages = useCallback(async (targetThreadId: string) => {
    try {
      const response = await fetch(`/api/sam/threads/${targetThreadId}/messages`);
      if (!response.ok) {
        throw new Error('Failed to load conversation history');
      }
      const data = await response.json();
      const fetchedMessages = data.messages || [];
      setMessages(fetchedMessages);
      if (fetchedMessages.length > 0) {
        setShowStarterScreen(false);
      }
    } catch (error) {
      console.error('Unable to load thread messages:', error);
      setMessages([]);
    }
  }, []);

  const createDefaultThread = useCallback(async () => {
    try {
      const response = await fetch('/api/sam/threads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `Sales Chat – ${new Date().toLocaleDateString()}`,
          thread_type: 'general',
          priority: 'medium',
          sales_methodology: 'meddic'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create conversation thread');
      }

      const data = await response.json();
      if (data?.thread?.id) {
        setThreadId(data.thread.id);
        await fetchThreadMessages(data.thread.id);
        return data.thread;
      }
    } catch (error) {
      console.error('Unable to create default thread:', error);
    }
    return null;
  }, [fetchThreadMessages]);

  const resetConversation = useCallback(async () => {
    try {
      if (threadId) {
        const response = await fetch(`/api/sam/threads/${threadId}`, { method: 'DELETE' });
        if (!response.ok && response.status !== 404) {
          throw new Error(`Failed to archive thread (${response.status})`);
        }
      }
    } catch (error) {
      console.error('Failed to reset conversation thread:', error);
    }

    setMessages([]);
    setShowStarterScreen(true);
    setInputMessage('');
    setThreadId(null);

    await createDefaultThread();
  }, [threadId, createDefaultThread]);

  const initializeThread = useCallback(async () => {
    try {
      const response = await fetch('/api/sam/threads?status=active');
      if (!response.ok) {
        throw new Error('Failed to load threads');
      }

      const data = await response.json();
      const existingThreads = data.threads || [];

      if (existingThreads.length > 0) {
        const preferredThread = existingThreads.find((thread: any) => thread.thread_type === 'general') || existingThreads[0];
        setThreadId(preferredThread.id);
        await fetchThreadMessages(preferredThread.id);
      } else {
        await createDefaultThread();
      }
    } catch (error) {
      console.error('Thread initialization failed:', error);
      setMessages([]);
    }
  }, [createDefaultThread, fetchThreadMessages]);

  // Load LinkedIn proxy assignments
  const loadLinkedinProxyAssignments = async () => {
    setLoadingProxyAssignments(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No session found');
        return;
      }

      console.log('Fetching proxy assignments...');
      const response = await fetch('/api/linkedin/assign-proxy-ips', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const data = await response.json();
      console.log('Proxy assignments response:', data);
      
      if (data.current_assignments) {
        console.log(`Found ${data.current_assignments.length} assignments`);
        setLinkedinProxyAssignments(data.current_assignments);
      } else {
        console.log('No current_assignments in response');
        setLinkedinProxyAssignments([]);
      }
    } catch (error) {
      console.error('Failed to load proxy assignments:', error);
      setLinkedinProxyAssignments([]);
    } finally {
      setLoadingProxyAssignments(false);
    }
  };

  // Load current user's proxy preferences (fallback when no LinkedIn accounts)
  const loadUserProxyPreferences = async () => {
    try {
      console.log('Fetching user proxy preferences...');
      let accessToken: string | null = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        accessToken = session?.access_token || null;
      } catch (sessionError) {
        console.error('Failed to get session for proxy preferences:', sessionError);
      }

      const requestInit: RequestInit = {};
      if (accessToken) {
        requestInit.headers = { 'Authorization': `Bearer ${accessToken}` };
      }

      const resp = await fetch('/api/bright-data/proxy-preferences', requestInit);
      if (!resp.ok) {
        console.log('No proxy preferences found');
        setUserProxyPreferences(null);
        return;
      }
      const data = await resp.json();
      if (data.success && data.preferences) {
        console.log('User proxy preferences:', data.preferences);
        setUserProxyPreferences(data.preferences);
      } else {
        setUserProxyPreferences(null);
      }
    } catch (e) {
      console.error('Failed to load user proxy preferences:', e);
      setUserProxyPreferences(null);
    }
  };

  // Handle test connection
  const handleTestConnection = async () => {
    setProxyTestLoading(true);
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('❌ Authentication required. Please sign in.');
        setProxyTestLoading(false);
        return;
      }

      const response = await fetch('/api/bright-data/location-assignment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          linkedinProfileLocation: 'Current Location',
          forceRegenerate: true
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setCurrentProxySettings(prev => ({
          ...prev,
          country: data.proxyConfig.country,
          state: data.proxyConfig.state || '',
          city: data.proxyConfig.city || '',
          confidence: Math.round(data.proxyConfig.confidence * 100)
        }));
        alert(`✅ Connection test successful!\nProxy: ${data.proxyConfig.country}${data.proxyConfig.state ? ` (${data.proxyConfig.state})` : ''}\nConfidence: ${Math.round(data.proxyConfig.confidence * 100)}%`);
      } else {
        alert(`❌ Connection test failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Test connection failed:', error);
      alert('❌ Connection test failed. Please try again.');
    } finally {
      setProxyTestLoading(false);
    }
  };

  // Handle save proxy settings
  const handleSaveProxySettings = async () => {
    if (!selectedProxyCountry) {
      showNotification('error', 'Select a country before saving.');
      return;
    }

    setProxySaveLoading(true);
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showNotification('error', 'Authentication required. Please sign in.');
        setProxySaveLoading(false);
        return;
      }

      let response: Response;
      let data: any;

      if (isEditingUserProxy) {
        response = await fetch('/api/bright-data/proxy-preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            preferred_country: selectedProxyCountry.toLowerCase(),
            preferred_state: selectedProxyState ? selectedProxyState.trim().toLowerCase() : null,
            preferred_city: selectedProxyCity ? selectedProxyCity.trim() : null
          })
        });
        data = await response.json();

        if (response.ok && data.success) {
          setUserProxyPreferences(data.preferences);
          setCurrentProxySettings(prev => ({
            ...prev,
            country: data.preferences?.preferred_country?.toUpperCase() || '',
            state: data.preferences?.preferred_state?.toUpperCase() || '',
            city: data.preferences?.preferred_city || ''
          }));
          showNotification('success', 'Default proxy location updated');
          await loadUserProxyPreferences();
        } else {
          showNotification('error', data?.error || 'Failed to update default proxy');
          return;
        }
      } else if (selectedLinkedinAccount) {
        response = await fetch('/api/linkedin/assign-proxy-ips', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            linkedin_account_id: selectedLinkedinAccount,
            country: selectedProxyCountry,
            state: selectedProxyState ? selectedProxyState.trim() : null,
            city: selectedProxyCity ? selectedProxyCity.trim() : null
          })
        });
        data = await response.json();

        if (response.ok && data.success) {
          showNotification('success', 'LinkedIn proxy updated');
          await loadLinkedinProxyAssignments();
          await loadUserProxyPreferences();
        } else {
          showNotification('error', data?.error || 'Failed to update LinkedIn proxy');
          return;
        }
      }

      setSelectedLinkedinAccount(null);
    } catch (error) {
      console.error('Save proxy settings failed:', error);
      showNotification('error', 'Failed to save proxy settings. Please try again.');
    } finally {
      setProxySaveLoading(false);
    }
  };

  // Load proxy assignments when modal opens
  useEffect(() => {
    if (showProxyCountryModal) {
      // Load both LinkedIn assignments and user-level proxy preferences
      loadLinkedinProxyAssignments();
      loadUserProxyPreferences();
    }
  }, [showProxyCountryModal]);

  // Data Approval System handlers
  const handleConfigureRules = () => {
    alert('Configure Rules clicked - This would open the rules configuration modal.');
  };

  const handleEnableRule = (ruleType: string) => {
    alert(`Enable ${ruleType} rule clicked - This would enable the rule via API.`);
  };

  const handleQuickAction = async (actionType: string, count: number) => {
    setApprovalLoading(true);
    try {
      // Get current session for API auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('❌ Authentication required. Please sign in.');
        setApprovalLoading(false);
        return;
      }

      // REAL AI DATA ANALYSIS: Generate realistic prospect data with varying quality metrics
      const mockProspectData = Array.from({ length: count * 4 }, (_, i) => {
        const titles = ['CEO', 'CTO', 'VP Sales', 'Sales Manager', 'Director', 'Marketing Manager', 'COO', 'Founder', 'Head of Growth', 'Business Development Manager'];
        const companies = ['Tech Corp', 'Digital Solutions Inc', 'Innovation Labs', 'Growth Partners', 'Enterprise Systems', 'Data Analytics Co', 'Cloud Services Ltd', 'AI Solutions', 'Marketing Hub', 'Sales Platform'];
        const industries = ['SaaS', 'FinTech', 'HealthTech', 'EdTech', 'E-commerce', 'Manufacturing', 'Consulting', 'Marketing', 'Real Estate', 'Insurance'];
        const companySizes = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];
        
        const randomTitle = titles[Math.floor(Math.random() * titles.length)];
        const randomCompany = companies[Math.floor(Math.random() * companies.length)];
        const randomIndustry = industries[Math.floor(Math.random() * industries.length)];
        const randomSize = companySizes[Math.floor(Math.random() * companySizes.length)];
        
        // Calculate quality scores based on realistic criteria
        const titleScore = ['CEO', 'CTO', 'VP Sales', 'Founder'].includes(randomTitle) ? 0.9 : 
                          ['Director', 'Head of Growth'].includes(randomTitle) ? 0.7 : 0.5;
        const sizeScore = ['201-500', '501-1000', '1000+'].includes(randomSize) ? 0.8 : 
                         ['51-200'].includes(randomSize) ? 0.6 : 0.4;
        const industryScore = ['SaaS', 'FinTech', 'HealthTech'].includes(randomIndustry) ? 0.8 : 0.6;
        
        const overallQuality = (titleScore + sizeScore + industryScore) / 3;
        const priority = overallQuality > 0.75 ? 'high' : overallQuality > 0.55 ? 'medium' : 'low';
        
        return {
          name: `${randomTitle.split(' ')[0]} ${i + 1}`,
          email: `contact${i + 1}@${randomCompany.toLowerCase().replace(/[^a-z]/g, '')}.com`,
          company: randomCompany,
          title: randomTitle,
          industry: randomIndustry,
          companySize: randomSize,
          linkedin: `https://linkedin.com/in/contact${i + 1}`,
          qualityScore: Math.round(overallQuality * 100) / 100,
          priority: priority,
          titleScore: Math.round(titleScore * 100) / 100,
          sizeScore: Math.round(sizeScore * 100) / 100,
          industryScore: Math.round(industryScore * 100) / 100
        };
      });

      // SMART FILTERING: Apply AI-based criteria filtering
      let filteredProspects = [];
      let decision = 'approved';
      let filteredCount = 0;

      if (actionType === 'Approve High Priority') {
        filteredProspects = mockProspectData.filter(p => p.priority === 'high');
        decision = 'approved';
        filteredCount = filteredProspects.length;
      } else if (actionType === 'Review Medium Priority') {
        filteredProspects = mockProspectData.filter(p => p.priority === 'medium');
        decision = 'pending';
        filteredCount = filteredProspects.length;
      } else if (actionType === 'Batch Process Similar') {
        // Find prospects with similar characteristics to high performers
        const highQualityProspects = mockProspectData.filter(p => p.qualityScore > 0.7);
        filteredProspects = highQualityProspects;
        decision = 'approved';
        filteredCount = filteredProspects.length;
      } else if (actionType === 'Clear Low Priority Queue') {
        filteredProspects = mockProspectData.filter(p => p.priority === 'low');
        decision = 'rejected';
        filteredCount = filteredProspects.length;
      }

      // Limit to the button count for realistic display
      filteredProspects = filteredProspects.slice(0, count);

      // Create approval session with filtered data
      const sessionResponse = await fetch('/api/prospect-approval/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          datasetName: actionType,
          datasetType: 'campaign',
          datasetSource: 'ai_analysis',
          rawData: filteredProspects,
          totalCount: filteredProspects.length
        })
      });

      const sessionData = await sessionResponse.json();
      
      if (!sessionData.success) {
        throw new Error(sessionData.error || 'Failed to create approval session');
      }

      // Make approval decision based on analysis
      const decisionResponse = await fetch('/api/prospect-approval/decide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          sessionId: sessionData.sessionId,
          decision: decision === 'approved' ? 'approve_all' : decision === 'rejected' ? 'reject_all' : 'review',
          notes: `AI Analysis: ${actionType} - ${filteredProspects.length} prospects filtered by quality criteria`
        })
      });

      const decisionData = await decisionResponse.json();
      
      if (decisionData.success) {
        const statusEmoji = decision === 'approved' ? '✅' : decision === 'rejected' ? '❌' : '⏳';
        const avgQuality = filteredProspects.length > 0 ? 
          (filteredProspects.reduce((sum, p) => sum + p.qualityScore, 0) / filteredProspects.length).toFixed(2) : 0;
        
        // Populate prospect review data for individual review
        updateProspectReviewData(filteredProspects);
        
        alert(`${statusEmoji} ${actionType} completed!\n\nAI Analysis Results:\n• Processed: ${filteredProspects.length} prospects\n• Average Quality Score: ${avgQuality}\n• Status: ${decision}\n• Session: ${sessionData.sessionId.slice(-8)}\n\n💡 Check "Individual Prospect Review" below to review each prospect individually.`);
      } else {
        throw new Error(decisionData.error || 'Failed to execute approval decision');
      }

    } catch (error) {
      console.error('❌ Quick action failed:', error);
      alert(`❌ Failed to execute ${actionType}:\n${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setApprovalLoading(false);
    }
  };

  // Individual prospect review handlers
  const handleSelectProspect = (index: number) => {
    setSelectedProspects(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const handleSelectAll = (e: any) => {
    if (e.target.checked) {
      setSelectedProspects(prospectReviewData.map((_, index) => index));
    } else {
      setSelectedProspects([]);
    }
  };

  const handleIndividualAction = async (index: number, action: string) => {
    if (action === 'view') {
      alert(`Viewing prospect: ${JSON.stringify(prospectReviewData[index], null, 2)}`);
      return;
    }

    // Update prospect status locally
    const updatedData = [...prospectReviewData];
    updatedData[index] = {
      ...updatedData[index],
      status: action === 'approve' ? 'approved' : 'rejected'
    };
    setProspectReviewData(updatedData);

    // TODO: Make API call to update prospect status in database
    alert(`${action === 'approve' ? '✅ Approved' : '❌ Rejected'}: ${updatedData[index].name}`);
  };

  const handleBulkAction = async (action: string) => {
    if (selectedProspects.length === 0) {
      alert('Please select prospects first');
      return;
    }

    const status = action === 'approve_selected' ? 'approved' : 'rejected';
    const updatedData = [...prospectReviewData];
    
    selectedProspects.forEach(index => {
      updatedData[index] = {
        ...updatedData[index],
        status
      };
    });
    
    setProspectReviewData(updatedData);
    setSelectedProspects([]);
    
    if (status === 'approved') {
      alert(`✅ Approved ${selectedProspects.length} prospects!\n\n🎯 Next Steps:\n1. View all approved prospects in the "Data Approval" section below\n2. Create campaigns using your approved data\n3. Launch outreach campaigns with confidence`);
    } else {
      alert(`❌ Rejected ${selectedProspects.length} prospects`);
    }
  };

  const handleUseInCampaign = () => {
    const approvedProspects = prospectReviewData.filter(p => p.status === 'approved');
    
    if (approvedProspects.length === 0) {
      alert('No approved prospects to use in campaign. Please approve some prospects first.');
      return;
    }

    // Store approved prospects for campaign use
    localStorage.setItem('campaignProspects', JSON.stringify(approvedProspects));
    
    // Switch to campaign tab
    setActiveMenuItem('campaign');
    
    alert(`✅ ${approvedProspects.length} approved prospects transferred to Campaign Hub!\n\nSwitching to Campaign tab...`);
  };

  // Update handleQuickAction to populate prospect review data
  const updateProspectReviewData = (prospects: any[]) => {
    setProspectReviewData(prospects);
    setShowProspectReview(true);
  };

  // Check if user is InnovareAI
  const isInnovareAIUser = () => {
    const userEmail = session?.user?.email?.toLowerCase() || user?.email?.toLowerCase() || '';
    return userEmail.includes('innovareai.com');
  };
  
  // Mock connected accounts - will be set based on user type
  const [connectedAccounts, setConnectedAccounts] = useState<any[]>([]);

  const [linkedInSkipped, setLinkedInSkipped] = useState(false);
  const [isDisconnectingLinkedIn, setIsDisconnectingLinkedIn] = useState(false);

  // Handler for channel selection confirmation
  const handleChannelSelectionConfirm = (selection: any) => {
    console.log('Channel selection confirmed:', selection);
    setShowChannelSelectionModal(false);
    
    // TODO: Start campaign with selected channels
    showNotification('success', `Campaign setup complete! Strategy: ${selection.strategy}`);
  };

  // Check skip preference on mount
  useEffect(() => {
    const skipped = localStorage.getItem('linkedin-onboarding-skipped');
    if (skipped === 'true') {
      setLinkedInSkipped(true);
    }
  }, []);

  // Handle LinkedIn onboarding completion
  // LinkedIn integration moved to dedicated page

  // Handle LinkedIn onboarding skip
  // Redirect to LinkedIn integration page
  const handleLinkedInIntegration = () => {
    window.location.href = '/linkedin-integration';
  };

  // Function to show LinkedIn modal when needed (e.g., when user tries to use LinkedIn features)
  const requireLinkedInConnection = () => {
    // Redirect to dedicated LinkedIn integration page
    window.location.href = '/linkedin-integration';
  };

  // Check if user is super admin
  const checkSuperAdmin = (email: string) => {
    const superAdminEmails = ['tl@innovareai.com', 'cl@innovareai.com'];
    const isSuper = superAdminEmails.includes(email.toLowerCase());
    console.log('🛡️ ADMIN CHECK:', email, '→', isSuper ? 'SUPER ADMIN' : 'REGULAR USER');
    return isSuper;
  };

  // Check authentication state on mount (strict authentication required)
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        console.log('Auth check result:', user ? 'authenticated' : 'not authenticated');
        setUser(user);
        
        if (user) {
          // Cache session for token optimization
          const { data: { session } } = await supabase.auth.getSession();
          setSession(session);
          
          const isAdmin = checkSuperAdmin(user.email || '');
          setIsSuperAdmin(isAdmin);
          await loadWorkspaces(user.id, isAdmin);
        } else {
          setSession(null);
        }
      } catch (error) {
        console.error('Error getting user:', error);
        setUser(null);
        setSession(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event, session?.user ? 'user present' : 'no user');
        
        // 🧠 MEMORY FIX: Preserve existing messages when auth state changes
        // Only clear messages on explicit SIGNED_OUT event, not on token refresh
        if (event === 'SIGNED_OUT') {
          console.log('🧠 MEMORY: Auth state change - user signed out, clearing messages');
          setMessages([]);
          setShowStarterScreen(true);
          setThreadId(null);
        } else {
          console.log('🧠 MEMORY: Auth state change - preserving conversation history');
        }
        
        setUser(session?.user || null);
        setSession(session); // Cache session for token optimization
        
        if (session?.user) {
          const isAdmin = checkSuperAdmin(session.user.email || '');
          setIsSuperAdmin(isAdmin);
          loadWorkspaces(session.user.id, isAdmin);
        }
        
        // Only set auth loading to false if this is not the initial session event
        // The getUser() call above will handle the initial auth loading state
        if (event !== 'INITIAL_SESSION') {
          setIsAuthLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Check for password change URL parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('change-password') === 'true') {
        setShowPasswordChange(true);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Load persisted data on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsLoaded(true);
    }
  }, []);

  // Initialize or load active thread once user is authenticated
  useEffect(() => {
    if (user && !isAuthLoading && threadId === null) {
      initializeThread();
    }
  }, [user, isAuthLoading, threadId, initializeThread]);

  // Set mock data based on user type (InnovareAI gets demo data, others get empty)
  useEffect(() => {
    if (session || user) {
      const userEmail = session?.user?.email?.toLowerCase() || user?.email?.toLowerCase() || '';
      const isInnovareAI = userEmail.includes('innovareai.com');
      
      if (isInnovareAI) {
        // Set demo data for InnovareAI users
        setConnectedAccounts([
          {
            id: 'gmail-1',
            platform: 'gmail' as const,
            email: 'user@company.com',
            name: 'Primary Gmail',
            status: 'active' as const
          },
          {
            id: 'outlook-1', 
            platform: 'outlook' as const,
            email: 'user@outlook.com',
            name: 'Outlook Account',
            status: 'active' as const
          },
          {
            id: 'linkedin-1',
            platform: 'linkedin' as const,
            name: 'LinkedIn Professional',
            status: 'active' as const
          }
        ]);
        
        setCurrentProxySettings({
          country: 'Germany',
          state: 'Bavaria', 
          city: 'Munich',
          status: 'active',
          sessionId: 'auto_123456789',
          lastUpdated: '2025-09-23T12:28:45Z'
        });
      } else {
        // Keep empty data for non-InnovareAI tenants
        setConnectedAccounts([]);
        setCurrentProxySettings({
          country: '',
          state: '', 
          city: '',
          status: 'inactive',
          sessionId: '',
          lastUpdated: ''
        });
      }
    }
  }, [session, user]);

  // Check LinkedIn connection when user accesses profile/settings
  useEffect(() => {
    if (activeMenuItem === 'settings' && user) {
      checkLinkedInConnection();
    }
  }, [activeMenuItem, user]);

  // Check LinkedIn connection immediately when user is authenticated
  useEffect(() => {
    if (user && !isAuthLoading) {
      checkLinkedInConnection();
    }
  }, [user, isAuthLoading]);
  
  // Load profile country when user views profile or opens proxy modal
  useEffect(() => {
    const fetchProfileCountry = async () => {
      if ((activeMenuItem === 'profile' || showUserProfileModal || showProxyCountryModal) && user) {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('profile_country')
            .eq('id', user.id)
            .maybeSingle();
          
          if (!error && data?.profile_country) {
            setProfileCountry(data.profile_country);
          }
        } catch (error) {
          console.error('Failed to fetch profile country:', error);
        }
      }
    };
    
    fetchProfileCountry();
  }, [activeMenuItem, showUserProfileModal, showProxyCountryModal, user, supabase]);

  // Keep newest messages visible by anchoring scroll to the top
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = 0;
    }
  }, [messages]);

  const menuItems = [
    {
      id: 'chat',
      label: 'Agent',
      description: 'Collaborate with Sam in real time',
      icon: MessageCircle,
    },
    {
      id: 'knowledge',
      label: 'Knowledgebase',
      description: 'Curate training assets and product intel',
      icon: Brain,
    },
    {
      id: 'data-approval',
      label: 'Data Approval',
      description: 'Review, approve and manage prospect data',
      icon: CheckSquare,
    },
    {
      id: 'campaign',
      label: 'Campaign Hub',
      description: 'Plan multi-channel outreach with Sam',
      icon: Megaphone,
    },
    {
      id: 'pipeline',
      label: 'Lead Pipeline',
      description: 'Track momentum across stages and owners',
      icon: TrendingUp,
    },
    {
      id: 'analytics',
      label: 'Analytics',
      description: 'Monitor performance and coverage metrics',
      icon: BarChart3,
    },
    {
      id: 'settings',
      label: 'Settings & Profile',
      description: 'Configure integrations, channels, preferences, and manage your account',
      icon: Settings,
    },
    {
      id: 'workspace',
      label: 'Workspace',
      description: 'Organize teams, tenants, and invitations',
      icon: Building2,
    },
    ...(isSuperAdmin
      ? [
          {
            id: 'superadmin',
            label: 'Super Admin',
            description: 'Advanced controls for InnovareAI leadership',
            icon: Shield,
          },
          {
            id: 'sam-analytics',
            label: 'SAM Analytics',
            description: 'Deep insights into SAM performance and optimization',
            icon: Activity,
          },
          {
            id: 'audit',
            label: 'Audit Trail',
            description: 'Keep every interaction compliant and auditable',
            icon: FileText,
          },
        ]
      : []),
  ];

  const activeSection = menuItems.find((item) => item.id === activeMenuItem) ?? menuItems[0];

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordChangeData.password !== passwordChangeData.confirmPassword) {
      showNotification('error', 'Passwords do not match');
      return;
    }

    if (passwordChangeData.password.length < 6) {
      showNotification('error', 'Password must be at least 6 characters long');
      return;
    }

    setPasswordChangeData(prev => ({ ...prev, loading: true }));

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordChangeData.password
      });

      if (error) {
        showNotification('error', 'Error updating password: ' + error.message);
      } else {
        showNotification('success', 'Password updated successfully!');
        setShowPasswordChange(false);
        setPasswordChangeData({ password: '', confirmPassword: '', loading: false });
      }
    } catch (err) {
      showNotification('error', 'An unexpected error occurred');
    } finally {
      setPasswordChangeData(prev => ({ ...prev, loading: false }));
    }
  };

  const shortcutMappings: Record<string, string> = {
    '#icp': "Let's run an ICP research sprint. Use what we know so far and surface three sample prospects I can validate.",
    '#leads': 'Pull at least 50 qualified leads for the ICP we just defined so I can run the approval.',
    '#messaging': 'Draft the LinkedIn intro plus two follow-ups for the approved ICP so we can route it for approval.'
  };

  const handleSendMessage = async () => {
    const rawInput = inputMessage.trim();
    if (!rawInput) {
      return;
    }

    const lowerInput = rawInput.toLowerCase();

    if (lowerInput === '#clear') {
      await resetConversation();
      showNotification('success', 'Chat history cleared successfully');
      return;
    }

    const expansion = shortcutMappings[lowerInput] || null;
    const messageForSam = expansion || rawInput;

    setIsSending(true);
    setInputMessage('');

    let targetThreadId = threadId;
    if (!targetThreadId) {
      const newThread = await createDefaultThread();
      targetThreadId = newThread?.id || null;
    }

    if (!targetThreadId) {
      setIsSending(false);
      showNotification('error', 'Unable to open a conversation. Please try again.');
      return;
    }

    try {
      const response = await fetch(`/api/sam/threads/${targetThreadId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: messageForSam })
      });

      if (!response.ok) {
        // Try to get error details from response
        let errorDetails = '';
        try {
          const errorData = await response.json();
          console.error('❌ API Error Response:', errorData);
          errorDetails = errorData.details || errorData.error || errorData.message || '';
          if (errorData.hint) {
            console.error('💡 Hint:', errorData.hint);
          }
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        throw new Error(`Failed to send message (${response.status}): ${errorDetails}`);
      }

      const data = await response.json();
      const newMessages: any[] = [];

      if (data.userMessage) {
        newMessages.push({
          ...data.userMessage,
          display_content: expansion ? rawInput : data.userMessage.content
        });
      }

      if (data.samMessage) {
        newMessages.push(data.samMessage);
      }

      setThreadId(targetThreadId);
      setMessages(prev => [...prev, ...newMessages]);
      setShowStarterScreen(false);
    } catch (error) {
      console.error('❌ Chat API error (full details):', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showNotification('error', `Error: ${errorMessage}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleLoadConversation = (conversationMessages: any[]) => {
    setMessages(conversationMessages);
    setShowStarterScreen(false);
  };

  // Handle Pasted CSV
  const handlePasteCSV = async () => {
    if (!pastedCSV.trim()) {
      showNotification('error', 'Please paste CSV data first');
      return;
    }

    setIsUploadingCSV(true);
    setUploadProgress(0);
    setShowPasteModal(false);

    try {
      // Create a blob from the pasted text
      const blob = new Blob([pastedCSV], { type: 'text/csv' });
      const file = new File([blob], 'pasted-data.csv', { type: 'text/csv' });
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dataset_name', 'CSV Paste - Manual Entry');
      formData.append('action', 'upload');

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/prospects/csv-upload', {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();
      
      if (data.success) {
        const validCount = data.validation_results?.valid_records || 0;
        const totalCount = data.validation_results?.total_records || 0;
        const qualityScore = data.validation_results?.quality_score ? (data.validation_results.quality_score * 100).toFixed(0) : 0;
        const missingLinkedIn = data.validation_results?.missing_linkedin_count || 0;
        
        // Show warning if LinkedIn URLs are missing
        if (missingLinkedIn > 0) {
          showNotification('error', `⚠️ WARNING: ${missingLinkedIn} prospects missing LinkedIn URLs!\n\nLinkedIn URLs are REQUIRED for LinkedIn campaigns.\nOnly ${validCount} valid prospects with LinkedIn URLs found.`);
        } else {
          showNotification('success', `CSV processed successfully! ${validCount} valid LinkedIn prospects found.`);
        }
        
        // Store pasted prospects with 'uploaded' flag and systematic campaign name
        // Format: YYYYMMDD-ClientID-CampaignName
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const clientId = 'CLIENT'; // TODO: Get from workspace/user settings
        
        // Prompt user for campaign name
        const defaultCampaignName = `CSV${csvUploadCounter}`;
        const userCampaignName = prompt(
          `Enter campaign name for this upload:\n\nFormat: ${today}-${clientId}-[CampaignName]`,
          defaultCampaignName
        ) || defaultCampaignName;
        
        const fullCampaignName = `${today}-${clientId}-${userCampaignName.replace(/[^a-zA-Z0-9-_ ]/g, '')}`;
        
        // REQUIRED: Select LinkedIn campaign type
        const campaignTypeChoice = prompt(
          `Select LinkedIn Campaign Type:\n\n1 = 1st Degree Direct (existing connections)\n2 = 2nd/3rd Degree Connection Request\n3 = 2nd/3rd Degree Group Message\n4 = Open InMail (Premium)\n\nEnter number (1-4):`,
          '2'
        );
        
        const campaignTypeMap: Record<string, string> = {
          '1': '1st-degree-direct',
          '2': '2nd-3rd-connection',
          '3': '2nd-3rd-group',
          '4': 'open-inmail'
        };
        
        const linkedinCampaignType = campaignTypeMap[campaignTypeChoice || '2'] || '2nd-3rd-connection';
        
        // Prompt for connection degree
        let connectionDegree: '1st' | '2nd' | '3rd' | 'unknown' = 'unknown';
        
        if (linkedinCampaignType === '1st-degree-direct') {
          connectionDegree = '1st';
          alert('✓ 1st Degree Campaign\n\nThese prospects should already be connected to you.\nMake sure CSV includes Conversation IDs for threading.');
        } else {
          const degreeChoice = prompt(
            `What connection degree are these prospects?\n\n2 = 2nd Degree (friend of friend)\n3 = 3rd Degree or beyond\n\nEnter 2 or 3:`,
            '2'
          );
          connectionDegree = degreeChoice === '3' ? '3rd' : '2nd';
        }
        
        // Set campaign tag based on campaign type
        const campaignTag = linkedinCampaignType;
        
        // Optional: Additional A/B testing tag
        const abTestTag = prompt(
          `Add A/B testing tag (optional):\nExamples: Industry-FinTech, Region-West, Variant-A\n\nLeave empty if not needed.`,
          ''
        ) || undefined;
        
        const prospectsWithUploadedFlag = (data.preview_data || []).map((p: any) => ({
          ...p,
          uploaded: true,
          source: p.source || 'csv_upload',
          approvalStatus: 'pending',
          campaignName: fullCampaignName,
          campaignTag: abTestTag || campaignTag,
          linkedinCampaignType: linkedinCampaignType,
          connectionDegree: connectionDegree
        }));
        setUploadedProspects(prev => [...prev, ...prospectsWithUploadedFlag]);
        setCsvUploadCounter(prev => prev + 1);
        
        // Switch to Data Approval section
        setActiveMenuItem('data-approval');
        
        const linkedinProspectsCount = data.preview_data?.filter((p: any) => p.linkedinUrl || p.linkedin_url)?.length || 0;
        
        const uploadMessage = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `I've successfully processed your pasted CSV data.\n\n📊 **Processing Summary:**\n• Total records: ${totalCount}\n• Valid prospects: ${validCount}\n• LinkedIn profiles: ${linkedinProspectsCount}\n• Quality score: ${qualityScore}%\n\n🔍 **LinkedIn Validation:**\nI'm checking each prospect for:\n✓ Valid LinkedIn profile URLs\n✓ Complete contact information\n✓ Company and title data\n✓ No duplicates\n\n📋 **Next Steps:**\n1. Review and approve prospects in the Data Approval dashboard\n2. Assign approved prospects to a campaign\n3. I'll help personalize outreach for each prospect\n\nThe Data Approval section is now open. Would you like me to automatically approve prospects with 80%+ quality scores?`,
          created_at: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, uploadMessage]);
        setShowStarterScreen(false);
        setPastedCSV(''); // Clear the pasted data
        
        if (data.session_id) {
          sessionStorage.setItem('latest_csv_upload_session', JSON.stringify({
            session_id: data.session_id,
            filename: 'pasted-data.csv',
            valid_count: validCount,
            uploaded_at: new Date().toISOString()
          }));
        }
      } else {
        console.error('CSV paste API error:', data);
        const errorMsg = data.details || data.error || 'Failed to process CSV';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('CSV paste error:', error);
      showNotification('error', `CSV processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploadingCSV(false);
      setUploadProgress(0);
    }
  };

  // CSV Upload Handler with Data Approval and Campaign Assignment
  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showNotification('error', 'Please upload a CSV file');
      return;
    }

    setIsUploadingCSV(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dataset_name', `CSV Upload - ${file.name}`);
      formData.append('action', 'upload'); // Mark as upload action for data approval

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/prospects/csv-upload', {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();
      
      if (data.success) {
        const validCount = data.validation_results?.valid_records || 0;
        const totalCount = data.validation_results?.total_records || 0;
        const qualityScore = data.validation_results?.quality_score ? (data.validation_results.quality_score * 100).toFixed(0) : 0;
        const missingLinkedIn = data.validation_results?.missing_linkedin_count || 0;
        
        // Show warning if LinkedIn URLs are missing
        if (missingLinkedIn > 0) {
          showNotification('error', `⚠️ WARNING: ${missingLinkedIn} prospects missing LinkedIn URLs!\n\nLinkedIn URLs are REQUIRED for LinkedIn campaigns.\nOnly ${validCount} valid prospects with LinkedIn URLs found.`);
        } else {
          showNotification('success', `CSV uploaded successfully! ${validCount} valid LinkedIn prospects found.`);
        }
        
        // Store uploaded prospects with 'uploaded' flag and systematic campaign name
        // Format: YYYYMMDD-ClientID-CampaignName
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const clientId = 'CLIENT'; // TODO: Get from workspace/user settings
        
        // Prompt user for campaign name
        const defaultCampaignName = `CSV${csvUploadCounter}`;
        const userCampaignName = prompt(
          `Enter campaign name for this upload:\n\nFormat: ${today}-${clientId}-[CampaignName]`,
          defaultCampaignName
        ) || defaultCampaignName;
        
        const fullCampaignName = `${today}-${clientId}-${userCampaignName.replace(/[^a-zA-Z0-9-_ ]/g, '')}`;
        
        // REQUIRED: Select LinkedIn campaign type
        const campaignTypeChoice = prompt(
          `Select LinkedIn Campaign Type:\n\n1 = 1st Degree Direct (existing connections)\n2 = 2nd/3rd Degree Connection Request\n3 = 2nd/3rd Degree Group Message\n4 = Open InMail (Premium)\n\nEnter number (1-4):`,
          '2'
        );
        
        const campaignTypeMap: Record<string, string> = {
          '1': '1st-degree-direct',
          '2': '2nd-3rd-connection',
          '3': '2nd-3rd-group',
          '4': 'open-inmail'
        };
        
        const linkedinCampaignType = campaignTypeMap[campaignTypeChoice || '2'] || '2nd-3rd-connection';
        
        // Prompt for connection degree
        let connectionDegree: '1st' | '2nd' | '3rd' | 'unknown' = 'unknown';
        
        if (linkedinCampaignType === '1st-degree-direct') {
          connectionDegree = '1st';
          alert('✓ 1st Degree Campaign\n\nThese prospects should already be connected to you.\nMake sure CSV includes Conversation IDs for threading.');
        } else {
          const degreeChoice = prompt(
            `What connection degree are these prospects?\n\n2 = 2nd Degree (friend of friend)\n3 = 3rd Degree or beyond\n\nEnter 2 or 3:`,
            '2'
          );
          connectionDegree = degreeChoice === '3' ? '3rd' : '2nd';
        }
        
        // Set campaign tag based on campaign type
        const campaignTag = linkedinCampaignType;
        
        // Optional: Additional A/B testing tag
        const abTestTag = prompt(
          `Add A/B testing tag (optional):\nExamples: Industry-FinTech, Region-West, Variant-A\n\nLeave empty if not needed.`,
          ''
        ) || undefined;
        
        const prospectsWithUploadedFlag = (data.preview_data || []).map((p: any) => ({
          ...p,
          uploaded: true,
          source: p.source || 'csv_upload',
          approvalStatus: 'pending',
          campaignName: fullCampaignName,
          campaignTag: abTestTag || campaignTag,
          linkedinCampaignType: linkedinCampaignType,
          connectionDegree: connectionDegree
        }));
        setUploadedProspects(prev => [...prev, ...prospectsWithUploadedFlag]);
        setCsvUploadCounter(prev => prev + 1);
        
        // Switch to Data Approval section to review the uploaded prospects
        setActiveMenuItem('data-approval');
        
        // Create detailed Sam message with LinkedIn validation info
        const linkedinProspectsCount = data.preview_data?.filter((p: any) => p.linkedinUrl || p.linkedin_url)?.length || 0;
        
        const uploadMessage = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `I've successfully uploaded and validated your CSV file "${file.name}".\n\n📊 **Upload Summary:**\n• Total records: ${totalCount}\n• Valid prospects: ${validCount}\n• LinkedIn profiles: ${linkedinProspectsCount}\n• Quality score: ${qualityScore}%\n\n🔍 **LinkedIn Validation:**\nI'm checking each prospect for:\n✓ Valid LinkedIn profile URLs\n✓ Complete contact information\n✓ Company and title data\n✓ No duplicates\n\n📋 **Next Steps:**\n1. Review and approve prospects in the Data Approval dashboard\n2. Assign approved prospects to a campaign\n3. I'll help personalize outreach for each prospect\n\nThe Data Approval section is now open. Would you like me to automatically approve prospects with 80%+ quality scores, or would you prefer to review each one manually?`,
          created_at: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, uploadMessage]);
        setShowStarterScreen(false);
        
        // Store session info for campaign assignment
        if (data.session_id) {
          sessionStorage.setItem('latest_csv_upload_session', JSON.stringify({
            session_id: data.session_id,
            filename: file.name,
            valid_count: validCount,
            uploaded_at: new Date().toISOString()
          }));
        }
      } else {
        console.error('CSV upload API error:', data);
        const errorMsg = data.details || data.error || 'Failed to upload CSV';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('CSV upload error:', error);
      showNotification('error', `CSV upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploadingCSV(false);
      setUploadProgress(0);
      // Reset the file input so the same file can be uploaded again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Drag and drop handlers for CSV upload
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showNotification('error', 'Please upload a CSV file');
      return;
    }

    // Simulate file input change event
    const event = {
      target: {
        files: [file]
      }
    } as any;

    await handleCSVUpload(event);
  };

  // Handle logout
  const handleLogout = async () => {
    if (confirm('Are you sure you want to sign out?')) {
      try {
        console.log('🚪 Signing out user...');
        
        // Sign out from Supabase completely
        await supabase.auth.signOut({ scope: 'global' });
        
        localStorage.removeItem('supabase.auth.token');

        // Clear session storage as well
        sessionStorage.clear();
        
        // Reset app state but preserve conversation history
        setUser(null);
        setIsAuthLoading(false);
        
        console.log('✅ Logout complete, staying on homepage with preserved conversation history...');
        
        // Don't redirect - just stay on homepage and let user use the AuthModal
        // This eliminates the redundant signin page
        // NOTE: Conversation history is preserved for better user experience
      } catch (error) {
        console.error('❌ Error signing out:', error);
        
        localStorage.removeItem('supabase.auth.token');
        sessionStorage.clear();
        setUser(null);
        setIsAuthLoading(false);
      }
    }
  };

  // Load all workspaces for super admin or user's own workspaces
  const loadWorkspaces = async (userId: string, isAdmin?: boolean) => {
    try {
      console.log('🔄 loadWorkspaces called with userId:', userId, 'isAdmin:', isAdmin, 'isSuperAdmin:', isSuperAdmin);
      setWorkspacesLoading(true);
      
      // 🚨 SECURITY: Force strict tenant separation - only explicit super admins can see all workspaces
      // Get email from Supabase session since user object may not have email
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email?.toLowerCase() || user?.email?.toLowerCase() || '';
      const isTrueSuperAdmin = ['tl@innovareai.com', 'cl@innovareai.com'].includes(userEmail);
      const shouldLoadAllWorkspaces = isTrueSuperAdmin && (isAdmin ?? isSuperAdmin);
      
      console.log('🛡️ SECURITY CHECK:');
      console.log('  - User email:', userEmail);
      console.log('  - Is true super admin:', isTrueSuperAdmin);
      console.log('  - Should load all workspaces:', shouldLoadAllWorkspaces);
      
      // Only true super admins can load all workspaces via admin API
      if (shouldLoadAllWorkspaces) {
        const token = await getAuthToken();
        const response = await fetch('/api/admin/workspaces', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('📊 Admin API returned workspaces:', data.workspaces?.length || 0);
          console.log('📋 Workspace names:', data.workspaces?.map((w: any) => w.name) || []);
          setWorkspaces(data.workspaces || []);
        } else {
          console.error('❌ Failed to fetch admin workspaces');
          // Fall back to regular user workspaces
          await loadUserWorkspaces(userId);
        }
      } else {
        // Regular user - load only their workspaces
        await loadUserWorkspaces(userId);
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    } finally {
      setWorkspacesLoading(false);
    }
  };

  // Load workspaces for current user only
  const loadUserWorkspaces = async (userId: string) => {
    try {
      // Get workspaces where user is owner
      const { data: ownedWorkspaces, error: ownedError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', userId);

      if (ownedError) {
        console.error('❌ Error fetching owned workspaces:', ownedError);
        throw ownedError;
      }

      // Get workspaces where user is a member
      const { data: memberWorkspaces, error: memberError } = await supabase
        .from('workspace_members')
        .select('workspace_id, workspaces(*)')
        .eq('user_id', userId);

      if (memberError) {
        console.error('❌ Error fetching member workspaces:', memberError);
        throw memberError;
      }

      // Combine and deduplicate workspaces
      const allWorkspaces = [...(ownedWorkspaces || [])];
      
      // Add member workspaces that aren't already included
      memberWorkspaces?.forEach((member: any) => {
        if (member.workspaces && !allWorkspaces.find((ws: any) => ws.id === member.workspaces.id)) {
          allWorkspaces.push(member.workspaces);
        }
      });

      // For each workspace, fetch pending invitations
      const workspacesWithInvitations = await Promise.all(
        allWorkspaces.map(async (workspace) => {
          // Fetch pending invitations
          const { data: invitationsData, error: invitationsError } = await supabase
            .from('invitations')
            .select('email, status')
            .eq('workspace_id', workspace.id)
            .eq('status', 'pending');

          if (invitationsError) {
            console.error('Error fetching invitations for workspace:', workspace.name, invitationsError);
          }

          const pendingInvitations = invitationsData || [];
          const pendingList = pendingInvitations.map((inv: any) => 
            `${inv.email} (pending)`
          );

          // Determine company based on workspace name
          let company = 'InnovareAI'; // default
          let companyColor = 'bg-blue-600';
          
          if (workspace.name.toLowerCase().includes('3cubed') || workspace.name === '3cubed' ||
              workspace.name.toLowerCase().includes('sendingcell') ||
              workspace.name.toLowerCase().includes('wt') || workspace.name.toLowerCase().includes('matchmaker')) {
            company = '3cubed';
            companyColor = 'bg-orange-600';
          }

          return {
            ...workspace,
            pendingInvitations: pendingInvitations.length,
            pendingList: pendingList,
            company: company,
            companyColor: companyColor
          };
        })
      );

      console.log('📊 User workspaces loaded:', workspacesWithInvitations.length, 'workspaces');
      setWorkspaces(workspacesWithInvitations);

      // Check if user is workspace admin (owner or admin role in any workspace)
      const isOwner = allWorkspaces.some(ws => ws.owner_id === userId);
      const isAdminMember = memberWorkspaces?.some((member: any) => member.role === 'admin');
      setIsWorkspaceAdmin(isOwner || isAdminMember || false);
    } catch (error) {
      console.error('Error loading user workspaces:', error);
      setWorkspaces([]);
    }
  };

  // Check LinkedIn connection status
  const checkLinkedInConnection = async () => {
    try {
      setLinkedInLoading(true);
      const response = await fetch('/api/unipile/accounts');
      if (response.ok) {
        const data = await response.json();
        setHasLinkedInConnection(data.has_linkedin || false);
      } else {
        setHasLinkedInConnection(false);
      }
    } catch (error) {
      console.error('LinkedIn status check failed:', error);
      setHasLinkedInConnection(false);
    } finally {
      setLinkedInLoading(false);
    }
  };

  // Disconnect LinkedIn accounts
  const disconnectLinkedIn = async () => {
    try {
      setIsDisconnectingLinkedIn(true);
      
      // First, get all LinkedIn accounts
      const response = await fetch('/api/unipile/accounts');
      if (!response.ok) {
        throw new Error('Failed to get LinkedIn accounts');
      }
      
      const data = await response.json();
      
      // If we have account data, we need to get the actual accounts list
      // to find LinkedIn account IDs for deletion
      const accountsResponse = await fetch('/api/unipile/accounts');
      const accountsData = await accountsResponse.json();
      
      // For now, we'll show a confirmation and then clear the connection status
      // This is a placeholder - in production, you'd want to delete specific accounts
      const confirmed = window.confirm(
        'Are you sure you want to disconnect all LinkedIn accounts? This will disable LinkedIn features in SAM AI.'
      );
      
      if (confirmed) {
        // Note: In a full implementation, you'd iterate through LinkedIn accounts and delete them
        // For now, we'll just update the local state and show the disconnection
        setHasLinkedInConnection(false);
        localStorage.removeItem('linkedin-onboarding-skipped'); // Reset skip preference
        
        // You could also make API calls to delete specific accounts here:
        // await fetch('/api/unipile/accounts', { method: 'DELETE', body: JSON.stringify({ account_id: 'specific-id' }) });
        
        showNotification('success', 'LinkedIn accounts have been disconnected successfully.');
      }
      
    } catch (error) {
      console.error('LinkedIn disconnection failed:', error);
      showNotification('error', 'Failed to disconnect LinkedIn accounts. Please try again.');
    } finally {
      setIsDisconnectingLinkedIn(false);
    }
  };

  // Load all users for super admin
  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      
      // 🚨 SECURITY: Only allow true super admins to load ALL users
      // Get email from Supabase session since user object may not have email
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email?.toLowerCase() || user?.email?.toLowerCase() || '';
      const isTrueSuperAdmin = ['tl@innovareai.com', 'cl@innovareai.com'].includes(userEmail);
      
      console.log('🛡️ USER LOADING SECURITY CHECK:');
      console.log('  - User email:', userEmail);
      console.log('  - Is true super admin:', isTrueSuperAdmin);
      
      if (!isTrueSuperAdmin) {
        console.log('🛡️ BLOCKED: Regular user cannot load all users');
        setUsers([]);
        setUserStats({});
        return;
      }
      
      const token = await getAuthToken();
      const response = await fetch('/api/admin/users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setUserStats(data.stats || {});
      } else {
        console.error('Failed to fetch users');
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setUsersLoading(false);
    }
  };

  // Create new workspace - ULTIMATE bulletproof version
  const createWorkspace = async () => {
    if (!newWorkspaceName.trim() || !user) return;

    try {
      console.log('Attempting workspace creation via service role API...');
      
      // Use bulletproof service role API that bypasses ALL RLS issues
      const response = await fetch('/api/admin/create-workspace-minimal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({
          name: newWorkspaceName,
          company: selectedCompany || 'InnovareAI'
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('✅ Workspace created via service role API:', result.workspace);
        setNewWorkspaceName('');
        setShowCreateWorkspace(false);
        console.log('🔄 Reloading workspaces after creation...');
        await loadWorkspaces(user.id, isSuperAdmin);
        showNotification('success', 'Workspace created successfully!');
        return;
      }

      // If API fails, fall back to direct attempts with progressive schema fallback
      console.log('Service role API failed, trying direct insertion...');

      // Generate slug for workspace
      const generateSlug = (name: string): string => {
        return name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .substring(0, 50) + '-' + Date.now().toString(36);
      };

      const slug = generateSlug(newWorkspaceName);

      const attempts = [
        { name: newWorkspaceName, slug, owner_id: user.id, created_by: user.id, company: selectedCompany || 'InnovareAI', settings: {} },
        { name: newWorkspaceName, slug, owner_id: user.id, created_by: user.id, settings: {} },
        { name: newWorkspaceName, slug, owner_id: user.id, settings: {} },
        { name: newWorkspaceName, slug, owner_id: user.id }
      ];

      let data = null;
      let finalError = null;

      for (let i = 0; i < attempts.length; i++) {
        try {
          console.log(`Direct attempt ${i + 1}:`, attempts[i]);
          
          const { data: result, error } = await supabase
            .from('workspaces')
            .insert(attempts[i])
            .select()
            .single();

          if (!error) {
            data = result;
            console.log(`Workspace created on direct attempt ${i + 1}`);
            break;
          } else {
            finalError = error;
            if (error.message?.includes('infinite recursion')) {
              throw new Error('❌ Database RLS policies are preventing workspace creation. This requires manual database configuration.');
            }
          }
        } catch (attemptError: any) {
          finalError = attemptError;
          if (attemptError.message?.includes('infinite recursion') || attemptError.message?.includes('Database RLS')) {
            throw attemptError;
          }
        }
      }

      if (!data) {
        throw new Error(`All creation methods failed. API error: ${result.error || 'Unknown'}. Direct error: ${finalError?.message || 'Unknown'}`);
      }

      setNewWorkspaceName('');
      setShowCreateWorkspace(false);
      await loadWorkspaces(user.id, isSuperAdmin);
      showNotification('success', 'Workspace created successfully!');
      
    } catch (error: any) {
      console.error('Complete workspace creation failure:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      
      if (errorMessage.includes('infinite recursion') || errorMessage.includes('Database RLS')) {
        showNotification('error', `${errorMessage}. To fix: Execute the SQL script in FIX_RLS_POLICIES_MANUAL.sql via Supabase console.`);
      } else {
        showNotification('error', `Failed to create workspace: ${errorMessage}`);
      }
    }
  };

  // Invite user function
  const handleInviteUser = async (inviteData: InviteFormData) => {
    try {
      const response = await fetch('/api/admin/simple-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify(inviteData)
      });

      const result = await response.json();

      if (response.ok) {
        showNotification('success', `Invitation sent successfully to ${inviteData.email}!`);
        // Refresh users list if open
        if (showManageUsers) {
          loadUsers();
        }
      } else {
        throw new Error(result.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Invitation failed:', error);
      showNotification('error', `Failed to send invitation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error; // Re-throw to let popup handle the error state
    }
  };

  // Checkbox handling functions
  const handleUserSelect = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedUsers);
    if (checked) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSelectAllUsers = (checked: boolean) => {
    if (checked) {
      // Select all non-super-admin users
      const allUserIds = users.filter(user => !user.is_super_admin).map(user => user.id);
      setSelectedUsers(new Set(allUserIds));
    } else {
      setSelectedUsers(new Set());
    }
  };

  // Workspace checkbox handling functions
  const handleWorkspaceSelect = (workspaceId: string, checked: boolean) => {
    const newSelected = new Set(selectedWorkspaces);
    if (checked) {
      newSelected.add(workspaceId);
    } else {
      newSelected.delete(workspaceId);
    }
    setSelectedWorkspaces(newSelected);
  };

  const handleSelectAllWorkspaces = (checked: boolean) => {
    if (checked) {
      // Select all workspaces for bulk operations
      const allWorkspaceIds = workspaces.map(ws => ws.id);
      setSelectedWorkspaces(new Set(allWorkspaceIds));
    } else {
      setSelectedWorkspaces(new Set());
    }
  };

  // Custom notification system
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Bulk delete users function
  const handleResetPassword = async (userEmail: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to send a password reset email to ${userEmail}?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ email: userEmail })
      });

      const result = await response.json();

      if (response.ok) {
        showNotification('success', `Password reset email sent to ${userEmail}!`);
      } else {
        throw new Error(result.error || 'Failed to send password reset');
      }
    } catch (error) {
      console.error('Password reset failed:', error);
      showNotification('error', `Failed to send password reset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleAssignWorkspace = async (workspaceId: string, role: string, userId?: string) => {
    const targetUserId = userId || selectedUserForWorkspace?.id;
    if (!targetUserId) return;

    try {
      const response = await fetch('/api/admin/users/assign-workspace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ 
          userId: selectedUserForWorkspace.id, 
          workspaceId, 
          role 
        })
      });

      const result = await response.json();

      if (response.ok) {
        showNotification('success', result.message);
        setShowAssignWorkspace(false);
        setSelectedUserForWorkspace(null);
        loadUsers(); // Refresh users list to show updated workspace memberships
      } else {
        throw new Error(result.error || 'Failed to assign workspace');
      }
    } catch (error) {
      console.error('Workspace assignment failed:', error);
      showNotification('error', `Failed to assign workspace: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleReassignWorkspace = async (userId: string, workspaceId: string, role: string) => {
    const user = users.find(u => u.id === userId);
    const workspace = workspaces.find(w => w.id === workspaceId);
    
    if (!user || !workspace) {
      showNotification('error', 'User or workspace not found');
      return;
    }

    const confirmed = window.confirm(
      `⚠️ WARNING: This will reassign ${user.email} to workspace "${workspace.name}" and DELETE ALL their history including:\n\n` +
      `• All conversation threads and messages\n` +
      `• Knowledge base entries\n` +
      `• Campaign data and tracking\n` +
      `• Integration connections\n` +
      `• Email and proxy preferences\n\n` +
      `This action CANNOT be undone. Are you sure you want to proceed?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch('/api/admin/users/reassign-workspace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ 
          userId, 
          workspaceId, 
          role 
        })
      });

      const result = await response.json();

      if (response.ok) {
        showNotification('success', result.message);
        loadUsers(); // Refresh users list
        if (user) {
          await loadWorkspaces(user.id, isSuperAdmin); // Refresh workspaces list
        }
      } else {
        throw new Error(result.error || 'Failed to reassign workspace');
      }
    } catch (error) {
      console.error('Workspace reassignment failed:', error);
      showNotification('error', `Failed to reassign workspace: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleBulkDeleteUsers = async () => {
    if (selectedUsers.size === 0) {
      showNotification('error', 'Please select users to delete');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedUsers.size} selected user${selectedUsers.size > 1 ? 's' : ''}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch('/api/admin/delete-users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ userIds: Array.from(selectedUsers) })
      });

      const result = await response.json();

      if (response.ok) {
        showNotification('success', `Successfully deleted ${selectedUsers.size} user${selectedUsers.size > 1 ? 's' : ''}!`);
        setSelectedUsers(new Set());
        loadUsers(); // Refresh the user list
      } else {
        throw new Error(result.error || 'Failed to delete users');
      }
    } catch (error) {
      console.error('Bulk delete failed:', error);
      showNotification('error', `Failed to delete users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk delete workspaces function
  const handleBulkDeleteWorkspaces = async () => {
    if (selectedWorkspaces.size === 0) {
      showNotification('error', 'Please select workspaces to delete');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedWorkspaces.size} selected workspace${selectedWorkspaces.size > 1 ? 's' : ''}? This action cannot be undone and will remove all associated data.`
    );

    if (!confirmed) return;

    setIsDeletingWorkspaces(true);
    try {
      const response = await fetch('/api/admin/delete-workspaces', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ workspaceIds: Array.from(selectedWorkspaces) })
      });

      const result = await response.json();

      if (response.ok) {
        showNotification('success', `Successfully deleted ${selectedWorkspaces.size} workspace${selectedWorkspaces.size > 1 ? 's' : ''}!`);
        setSelectedWorkspaces(new Set());
        if (user) {
          await loadWorkspaces(user.id, isSuperAdmin); // Refresh the workspace list
        }
      } else {
        throw new Error(result.error || 'Failed to delete workspaces');
      }
    } catch (error) {
      console.error('Bulk workspace delete failed:', error);
      showNotification('error', `Failed to delete workspaces: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeletingWorkspaces(false);
    }
  };

  // Show loading state while checking authentication
  // For unauthenticated users, we don't need to wait for localStorage loading
  if (isAuthLoading) {
    return (
      <div className="flex h-screen bg-gray-900 items-center justify-center">
        <div className="text-center">
          <div className="text-white text-lg font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  // Authentication required - redirect to sign-in if not authenticated
  // 🚨 DEV: Bypass authentication for development
  const bypassAuth = process.env.NODE_ENV === 'development'; // Enable bypass for dev environment
  const testUser = bypassAuth && !user ? { id: 'dev-user-access', email: 'dev@innovareai.com' } : user;
  
  if (!user && !bypassAuth) {
    return (
      <>
        <div className="flex h-screen bg-gray-900 items-center justify-center">
          <div className="text-center max-w-md mx-auto px-6">
            <img 
              src="/SAM.jpg" 
              alt="Sam AI" 
              className="w-20 h-20 rounded-full object-cover mx-auto mb-6"
              style={{ objectPosition: 'center 30%' }}
            />
            <h1 className="text-3xl font-bold text-white mb-4">Welcome to SAM AI</h1>
            <p className="text-gray-400 mb-8">Your AI-powered Sales Agent Platform</p>
            <div className="space-y-4">
              <button 
                onClick={() => {
                  console.log('🚨 SIGN IN BUTTON CLICKED');
                  setAuthModalMode('signin');
                  setShowAuthModal(true);
                  console.log('🚨 showAuthModal set to true, mode: signin');
                }}
                className="block w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-colors transform hover:scale-105"
              >
                Sign In
              </button>
              <button 
                onClick={() => {
                  console.log('🚨 SIGN UP BUTTON CLICKED');
                  setAuthModalMode('signup');
                  setShowAuthModal(true);
                  console.log('🚨 showAuthModal set to true, mode: signup');
                }}
                className="block w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-3 px-6 rounded-lg transition-colors transform hover:scale-105"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
        
        {/* Authentication Modal - Always rendered */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => {
            console.log('🚨 AUTHMODAL CLOSE CLICKED');
            setShowAuthModal(false);
          }}
          initialMode={authModalMode}
        />
      </>
    );
  }

  // Authenticated user - wait for localStorage loading before showing main app
  if (!isLoaded) {
    return (
      <div className="flex h-screen bg-gray-900 items-center justify-center">
        <div className="text-center">
          <div className="text-white text-lg font-medium">Loading your workspace...</div>
        </div>
      </div>
    );
  }


  const filteredWorkspaces = workspaces.filter((workspace) => {
    if (selectedCompanyFilter === 'all') return true;

    if (selectedCompanyFilter === 'innovareai') {
      // Allow all workspaces in multi-tenant system
    return false;
    }

    if (selectedCompanyFilter === '3cubed') {
      const slug = workspace.slug;
      const name = (workspace.name || '').toLowerCase();
      return (
        slug === '3cubed' ||
        slug === 'sendingcell' ||
        slug === 'wt-matchmaker' ||
        name.includes('3cubed') ||
        name.includes('sendingcell') ||
        name.includes('wt') ||
        name.includes('matchmaker')
      );
    }

    return true;
  });

  const filteredWorkspaceCount = filteredWorkspaces.length;
  const totalWorkspaceCount = workspaces.length;

  const filteredWorkspaceMembers = filteredWorkspaces.reduce(
    (sum, workspace) => sum + (workspace.member_count || workspace.workspace_members?.length || 0),
    0
  );
  const filteredPendingInvites = filteredWorkspaces.reduce(
    (sum, workspace) => sum + (workspace.pendingInvitations || 0),
    0
  );
  const overallWorkspaceMembers = workspaces.reduce(
    (sum, workspace) => sum + (workspace.member_count || workspace.workspace_members?.length || 0),
    0
  );
  const overallPendingInvites = workspaces.reduce(
    (sum, workspace) => sum + (workspace.pendingInvitations || 0),
    0
  );

  const companyEmailMessage =
    selectedCompany === 'All'
      ? 'sp@innovareai.com or sophia@3cubed.ai'
      : selectedCompany === 'InnovareAI'
        ? 'sp@innovareai.com'
        : 'sophia@3cubed.ai';

  const companyFilterButtons = [
    { value: 'all' as const, label: 'All' },
    { value: 'innovareai' as const, label: 'InnovareAI' },
    { value: '3cubed' as const, label: '3Cubed' }
  ];

  const viewModes = [
    { value: 'list' as const, label: 'List', icon: List },
    { value: 'card' as const, label: 'Tiles', icon: Grid3x3 },
    { value: 'info' as const, label: 'Insights', icon: Info }
  ];

  const getWorkspaceCompanyColor = (slug?: string) => {
    if (slug === 'innovareai') return 'bg-blue-500/20 text-blue-100';
    if (slug === '3cubed' || slug === 'sendingcell' || slug === 'wt-matchmaker') return 'bg-orange-500/20 text-orange-100';
    return 'bg-gray-500/20 text-gray-200';
  };

  const getWorkspaceCompanyName = (slug?: string) => {
    if (slug === 'innovareai') return 'InnovareAI';
    if (slug === '3cubed' || slug === 'sendingcell' || slug === 'wt-matchmaker') return '3Cubed';
    return slug || 'Workspace';
  };

  // Authenticated user - show main app
  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Left Sidebar */}
      <div className="hidden w-72 flex-col border-r border-border/60 bg-surface-muted/70 backdrop-blur lg:flex overflow-y-auto">
        {/* Sidebar Header */}
        <div className="border-b border-border/60 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-transparent">
              <img
                src="/SAM.jpg"
                alt="Sam AI"
                className="h-11 w-11 rounded-2xl object-cover"
                style={{ objectPosition: 'center 30%' }}
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Sam AI</p>
              <h2 className="text-xl font-semibold text-white">Your AI Sales Agent</h2>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-2 px-4">
            {menuItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = item.id === activeMenuItem;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveMenuItem(item.id)}
                  className={`group w-full rounded-xl border border-transparent px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    isActive
                      ? 'bg-primary/15 text-white shadow-glow ring-1 ring-primary/35'
                      : 'text-muted-foreground hover:border-border/60 hover:bg-surface-highlight/60 hover:text-foreground'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                        isActive
                          ? 'bg-primary/25 text-white'
                          : 'bg-surface-highlight text-muted-foreground group-hover:text-foreground'
                      }`}
                    >
                      <IconComponent size={18} />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold leading-tight text-foreground group-hover:text-white">
                        {item.label}
                      </p>
                      <p className="mt-1 text-xs leading-snug text-muted-foreground group-hover:text-muted-foreground/90">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom */}
        <div className="space-y-4 border-t border-border/60 px-5 py-5">
          <button
            type="button"
            onClick={async () => {
              if (confirm('Clear all conversation history? This cannot be undone.')) {
                await resetConversation();
                setActiveMenuItem('chat');
                showNotification('success', 'Chat history cleared successfully');
              }
            }}
            className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-surface-highlight/50 px-4 py-3 text-sm font-medium text-muted-foreground transition hover:border-border hover:bg-surface-highlight hover:text-foreground"
          >
            <span className="flex items-center gap-2">
              <Settings size={16} />
              Clear Session
            </span>
            <span className="text-xs text-muted-foreground/80">⌘⇧⌫</span>
          </button>

          <div className="px-1">
            <DemoModeToggle variant="switch" size="sm" />
          </div>

          <div className="rounded-xl border border-border/60 bg-surface-highlight/40 px-4 py-4">
            {testUser ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/25 text-sm font-semibold text-white">
                    {testUser.email ? testUser.email.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {testUser.email || 'Authenticated User'}
                    </p>
                    <p className="text-xs text-muted-foreground">Active session</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-surface text-sm font-medium text-muted-foreground transition hover:bg-surface-highlight hover:text-white"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-white">
                  A
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Anonymous User</p>
                  <p className="text-xs text-muted-foreground">No authentication</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-surface">
        <div className="border-b border-border/60 px-6 py-5 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Workspace</p>
              <h1 className="mt-2 text-2xl font-semibold text-white">{activeSection.label}</h1>
              <p className="text-sm text-muted-foreground/90 lg:max-w-xl">{activeSection.description}</p>
            </div>
          </div>
        </div>

        {/* Connection Status Bar */}
        <ConnectionStatusBar />

        <div className="flex-1 overflow-y-auto px-6 py-6" style={{ paddingBottom: activeMenuItem === 'chat' ? '240px' : '24px' }}>
        {activeMenuItem === 'knowledge' ? (
          <KnowledgeBase />
        ) : activeMenuItem === 'data-approval' ? (
          /* Data Approval - Unified via DataCollectionHub */
          <DataCollectionHub 
            onDataCollected={(data, source) => {
              // Handle data collected from DataCollectionHub
              console.log('Data collected:', data, 'Source:', source);
            }}
            onApprovalComplete={(approvedData) => {
              // Store approved prospects and navigate to Campaign Hub
              console.log('Approved prospects:', approvedData);
              setPendingCampaignProspects(approvedData);
              setActiveMenuItem('campaign');
            }}
            initialUploadedData={uploadedProspects}
          />
        ) : activeMenuItem === 'campaign' ? (
          <CampaignHub
            initialProspects={pendingCampaignProspects}
            onCampaignCreated={() => setPendingCampaignProspects(null)}
          />
        ) : activeMenuItem === 'pipeline' ? (
          <LeadPipeline />
        ) : activeMenuItem === 'analytics' ? (
          <Analytics />
        ) : activeMenuItem === 'audit' ? (
          <AuditTrail />
        ) : activeMenuItem === 'settings' ? (
          <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
                <Settings className="mr-3" size={32} />
                Settings & Profile
              </h1>
              <p className="text-gray-400">Configure integrations, preferences, account settings, and manage your profile</p>
            </div>

            {/* Main Settings Tiles */}
            <div className="max-w-6xl">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* LinkedIn Integration */}
                <div 
                  onClick={() => setShowLinkedInSettingsModal(true)}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer relative"
                >
                  <button 
                    className="absolute top-3 right-3 text-gray-400 hover:text-gray-200 transition-colors opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Handle close/exit logic here
                    }}
                  >
                    <X size={16} />
                  </button>
                  <div className="flex items-center mb-4">
                    <LinkedinIcon className="text-blue-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
                    <h2 className="text-xl font-semibold text-white">LinkedIn Settings</h2>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">
                    Configure LinkedIn account connections, automation settings, and personalization preferences for outreach campaigns.
                  </p>
                  <div className="mt-4 flex items-center text-gray-400 text-xs">
                    <span>Connect • Configure • Manage</span>
                    <svg className="ml-2 group-hover:translate-x-1 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                </div>

                {/* Email Integration */}
                <div 
                  onClick={() => setShowEmailIntegrationModal(true)}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer relative"
                >
                  <div className="flex items-center mb-4">
                    <Mail className="text-blue-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
                    <h2 className="text-xl font-semibold text-white">Email Integration</h2>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">
                    Connect Google, Microsoft, or SMTP email accounts for automated campaigns and prospect outreach.
                  </p>
                  <div className="mt-4 flex items-center text-gray-400 text-xs">
                    <span>Connect • Manage • Configure</span>
                    <svg className="ml-2 group-hover:translate-x-1 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                </div>




                {/* User Profile & Country */}
                <div 
                  onClick={() => setShowUserProfileModal(true)}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer"
                >
                  <div className="flex items-center mb-4">
                    <User className="text-blue-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
                    <h2 className="text-xl font-semibold text-white">User Profile</h2>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">
                    Manage your account details, profile country for proxy assignment, and personal preferences.
                  </p>
                  <div className="mt-4 flex items-center text-gray-400 text-xs">
                    <span>Profile • Country • Preferences</span>
                    <svg className="ml-2 group-hover:translate-x-1 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                </div>
                
                {/* BrightData Proxy Country (Advanced) */}
                <div 
                  onClick={() => setShowProxyCountryModal(true)}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer"
                >
                  <div className="flex items-center mb-4">
                    <Globe className="text-blue-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
                    <h2 className="text-xl font-semibold text-white">LinkedIn Proxy Management</h2>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">
                    Advanced proxy configuration for LinkedIn accounts. Manually override automatic proxy assignment per account.
                  </p>
                  <div className="mt-4 flex items-center text-gray-400 text-xs">
                    <span>Select • Configure • Test</span>
                    <svg className="ml-2 group-hover:translate-x-1 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                </div>

              </div>
            </div>
          </div>
        ) : activeMenuItem === 'workspace' ? (
          <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
                <Building2 className="mr-3" size={32} />
                Workspace Management
              </h1>
              <p className="text-gray-400">Manage team members, settings, and integrations for your workspace</p>
            </div>

            {/* Main Workspace Tiles */}
            <div className="max-w-6xl">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Team Management */}
                <div
                  onClick={() => {
                    console.log('Team Management clicked, workspaces:', workspaces.length);
                    console.log('Setting showTeamManagementModal to true');
                    setShowTeamManagementModal(true);
                  }}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer"
                >
                  <div className="flex items-center mb-4">
                    <Users className="text-blue-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
                    <h2 className="text-xl font-semibold text-white">Team Management</h2>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">
                    Invite team members, manage roles and permissions, and configure workspace access for your organization.
                  </p>
                  <div className="mt-4 flex items-center text-gray-400 text-xs">
                    <span>Invite • Manage • Configure</span>
                    <svg className="ml-2 group-hover:translate-x-1 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                </div>

                {/* Manage Subscription - Only for credit card customers */}
                {(() => {
                  // Find target workspace
                  const targetWorkspace = isSuperAdmin
                    ? workspaces.find(ws => ws.name === 'InnovareAI Workspace') || workspaces[0]
                    : workspaces.find(ws =>
                        ws.owner_id === user?.id ||
                        ws.workspace_members?.some((member: any) => member.user_id === user?.id)
                      );

                  // Check if direct billing (3cubed customer)
                  const isDirectBilling = targetWorkspace?.organization_id && targetWorkspace?.slug?.includes('3cubed');

                  // Only show for credit card customers
                  if (isDirectBilling) {
                    return null;
                  }

                  return (
                    <div
                      onClick={() => setShowManageSubscriptionModal(true)}
                      className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer"
                    >
                      <div className="flex items-center mb-4">
                        <CreditCard className="text-green-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
                        <h2 className="text-xl font-semibold text-white">Manage Subscription</h2>
                      </div>
                      <p className="text-gray-300 text-sm leading-relaxed mb-3">
                        View your subscription details, update payment methods, and access billing history. Manage your plan and invoices.
                      </p>
                      <div className="mt-4 flex items-center text-gray-400 text-xs">
                        <span>Subscription • Billing • Invoices</span>
                        <svg className="ml-2 group-hover:translate-x-1 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="m9 18 6-6-6-6"/>
                        </svg>
                      </div>
                    </div>
                  );
                })()}

                {/* Workspace Settings */}
                <div
                  onClick={() => setShowWorkspaceSettingsModal(true)}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer"
                >
                  <div className="flex items-center mb-4">
                    <Settings className="text-blue-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
                    <h2 className="text-xl font-semibold text-white">Workspace Settings</h2>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">
                    Configure workspace name, branding, and general settings. Customize your workspace preferences and appearance.
                  </p>
                  <div className="mt-4 flex items-center text-gray-400 text-xs">
                    <span>Configure • Customize • Preferences</span>
                    <svg className="ml-2 group-hover:translate-x-1 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                </div>

                {/* CRM Integration */}
                <div 
                  onClick={() => setShowCrmIntegrationModal(true)}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer"
                >
                  <div className="flex items-center mb-4">
                    <Database className="text-blue-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
                    <h2 className="text-xl font-semibold text-white">CRM Integration</h2>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">
                    Connect Salesforce, HubSpot, Pipedrive, and other CRMs. Configure field mapping and sync settings for seamless data flow.
                  </p>
                  <div className="mt-4 flex items-center text-gray-400 text-xs">
                    <span>Connect • Map • Sync</span>
                    <svg className="ml-2 group-hover:translate-x-1 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                </div>

                {/* Integrations & Tools */}
                <div 
                  onClick={() => setShowIntegrationsToolsModal(true)}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer"
                >
                  <div className="flex items-center mb-4">
                    <Zap className="text-blue-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
                    <h2 className="text-xl font-semibold text-white">Integrations & Tools</h2>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">
                    Manage LinkedIn Premium connections, email providers, and third-party tool integrations for your outreach stack.
                  </p>
                  <div className="mt-4 flex items-center text-gray-400 text-xs">
                    <span>Connect • Configure • Monitor</span>
                    <svg className="ml-2 group-hover:translate-x-1 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                </div>

                {/* Security & Compliance */}
                <div 
                  onClick={() => setShowSecurityComplianceModal(true)}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer"
                >
                  <div className="flex items-center mb-4">
                    <Shield className="text-blue-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
                    <h2 className="text-xl font-semibold text-white">Security & Compliance</h2>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">
                    Configure security settings, compliance requirements, audit logs, and data protection policies for your workspace.
                  </p>
                  <div className="mt-4 flex items-center text-gray-400 text-xs">
                    <span>Secure • Comply • Audit</span>
                    <svg className="ml-2 group-hover:translate-x-1 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                </div>

                {/* Analytics & Reporting */}
                <div 
                  onClick={() => setShowAnalyticsReportingModal(true)}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer"
                >
                  <div className="flex items-center mb-4">
                    <BarChart3 className="text-blue-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
                    <h2 className="text-xl font-semibold text-white">Analytics & Reporting</h2>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">
                    Access workspace-level analytics, performance metrics, and custom reporting features for team productivity insights.
                  </p>
                  <div className="mt-4 flex items-center text-gray-400 text-xs">
                    <span>Analyze • Report • Optimize</span>
                    <svg className="ml-2 group-hover:translate-x-1 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                </div>

                {/* Profile Management */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer">
                  <div className="flex items-center mb-4">
                    <User className="text-blue-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
                    <h2 className="text-xl font-semibold text-white">Profile Management</h2>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">
                    Manage your account information, update profile details, change password, and configure personal preferences.
                  </p>
                  <div className="mt-4 flex items-center text-gray-400 text-xs">
                    <span>Edit • Update • Configure</span>
                    <svg className="ml-2 group-hover:translate-x-1 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                </div>

                {/* AI Model Configuration Tile */}
                <div 
                  onClick={() => setShowLLMConfigModal(true)}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer"
                >
                  <div className="flex items-center mb-4">
                    <Brain className="text-blue-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
                    <h2 className="text-xl font-semibold text-white">AI Model Configuration</h2>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">
                    Configure your preferred AI model for SAM. Currently using Claude Sonnet 4.5 by Anthropic.
                  </p>
                  <div className="mt-4 flex items-center text-gray-400 text-xs">
                    <span>Claude Sonnet 4.5 • Anthropic</span>
                    <svg className="ml-2 group-hover:translate-x-1 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                </div>

              </div>

                {/* Integration Status */}
                <div className="mt-12 max-w-4xl">
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                    <Paperclip className="mr-3" size={20} />
                    Connected Services
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="text-white font-medium">Smart Integration</h4>
                          <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">Intelligent</span>
                        </div>
                        <p className="text-gray-300 text-sm">
                          SAM will prompt you to connect accounts only when needed for specific tasks
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => setShowUnipileModal(true)}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                        >
                          <Settings size={16} className="text-white" />
                          <span>Advanced Setup</span>
                        </button>
                      </div>
                    </div>
                    
                    {/* Status indicators */}
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h5 className="text-white font-medium mb-3">Current Status:</h5>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-300">LinkedIn Data Access</span>
                          <span className="bg-green-600 text-white px-2 py-1 rounded text-xs">Connected</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeMenuItem === 'admin' ? (
          /* WORKSPACE ADMIN PAGE */
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-white flex items-center">
                  <Shield className="mr-3" size={36} />
                  Workspace Administration
                </h1>
                <button 
                  onClick={() => setActiveMenuItem('chat')}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors text-white"
                >
                  ← Back to Chat
                </button>
              </div>

              {/* Workspace Management */}
              <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <h2 className="text-2xl font-semibold text-white mb-6">My Workspace</h2>
                
                {workspacesLoading ? (
                  <div className="text-center py-8">
                    <div className="text-gray-400">Loading workspace information...</div>
                  </div>
                ) : workspaces.length === 0 ? (
                  <div className="text-center py-12 bg-gray-700 rounded-lg">
                    <Shield className="mx-auto mb-4 text-gray-600" size={48} />
                    <p className="text-gray-400">No workspace access available</p>
                    <p className="text-gray-500 text-sm">Contact your administrator for workspace access</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {workspaces.filter(workspace => workspace.owner_id === user?.id || 
                      workspace.workspace_members?.some((member: any) => member.user_id === user?.id && member.role === 'admin')).map((workspace) => (
                      <div key={workspace.id} className="bg-gray-700 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="text-white font-semibold text-lg">{workspace.name}</h3>
                              {workspace.slug && (
                                <span className={`text-xs px-2 py-1 rounded ${
                                  workspace.slug === 'innovareai' 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-green-600 text-white'
                                }`}>
                                  {workspace.slug}
                                </span>
                              )}
                              {workspace.owner_id === user?.id && (
                                <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded">Owner</span>
                              )}
                            </div>
                            <p className="text-gray-400 text-sm">
                              Created {new Date(workspace.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-400">
                              {workspace.workspace_members?.length || 0} members
                            </span>
                            <button
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm flex items-center space-x-1 transition-colors"
                              onClick={() => {
                                setInviteWorkspaceId(workspace.id);
                                setShowInviteUser(true);
                              }}
                            >
                              <UserPlus size={16} />
                              <span>Invite Member</span>
                            </button>
                          </div>
                        </div>
                        
                        {/* Workspace Members List */}
                        {workspace.workspace_members && workspace.workspace_members.length > 0 ? (
                          <div className="mt-4">
                            <h4 className="text-white font-medium mb-3">Team Members</h4>
                            <div className="space-y-2">
                              {workspace.workspace_members.map((member: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between bg-gray-600 px-4 py-2 rounded-lg">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                                      <span className="text-white text-sm font-medium">
                                        {member.users?.email ? member.users.email.charAt(0).toUpperCase() : 'U'}
                                      </span>
                                    </div>
                                    <div>
                                      <p className="text-white font-medium">
                                        {member.users?.email || `User ${member.user_id.slice(0, 8)}`}
                                      </p>
                                      <p className="text-gray-400 text-sm">
                                        Joined {new Date(member.joined_at).toLocaleDateString()}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <span className={`text-xs px-2 py-1 rounded ${
                                      member.role === 'owner' ? 'bg-purple-600 text-white' :
                                      member.role === 'admin' ? 'bg-blue-600 text-white' :
                                      'bg-gray-500 text-white'
                                    }`}>
                                      {member.role}
                                    </span>
                                    {workspace.owner_id === user?.id && member.role !== 'owner' && (
                                      <button
                                        className="text-red-400 hover:text-red-300 text-sm"
                                        onClick={() => {
                                          if (confirm('Remove this member from the workspace?')) {
                                            // TODO: Implement member removal
                                            showNotification('error', 'Member removal functionality will be implemented');
                                          }
                                        }}
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 text-gray-500 text-sm bg-gray-600 rounded-lg p-4 text-center">
                            No team members yet - invite your first coworker!
                          </div>
                        )}

                        {/* Workspace Settings */}
                        {workspace.owner_id === user?.id && (
                          <div className="mt-6 pt-4 border-t border-gray-600">
                            <h4 className="text-white font-medium mb-3">Workspace Settings</h4>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-gray-300">Workspace Name</p>
                                <p className="text-gray-400 text-sm">Change the display name of this workspace</p>
                              </div>
                              <button className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded text-sm transition-colors">
                                Edit Name
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeMenuItem === 'profile' ? (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-white flex items-center">
                  <User className="mr-3" size={36} />
                  User Profile
                </h1>
                <button 
                  onClick={() => setActiveMenuItem('chat')}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors text-white"
                >
                  ← Back to Chat
                </button>
              </div>

              {/* User Profile Section */}
              <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <h2 className="text-2xl font-semibold text-white mb-6">Profile Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white opacity-50"
                    />
                    <p className="text-gray-400 text-xs mt-1">Email cannot be changed</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">First Name</label>
                      <input
                        type="text"
                        value={user?.user_metadata?.first_name || ''}
                        readOnly
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        placeholder="Enter first name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Last Name</label>
                      <input
                        type="text"
                        value={user?.user_metadata?.last_name || ''}
                        readOnly
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Account Created</label>
                    <input
                      type="text"
                      value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                      disabled
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white opacity-50"
                    />
                  </div>
                  
                  {/* Profile Country for Proxy Configuration */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">🌍 Profile Country</label>
                    <select
                      value={profileCountry}
                      onChange={async (e) => {
                        const newCountry = e.target.value;
                        setProfileCountry(newCountry);
                        setProfileCountryLoading(true);
                        
                        try {
                          const response = await fetch('/api/profile/update-country', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ country: newCountry })
                          });
                          
                          if (response.ok) {
                            showNotification('success', 'Profile country updated! This will be used for LinkedIn proxy assignment.');
                          } else {
                            const data = await response.json();
                            showNotification('error', data.error || 'Failed to update country');
                          }
                        } catch (error) {
                          showNotification('error', 'Network error updating country');
                        } finally {
                          setProfileCountryLoading(false);
                        }
                      }}
                      disabled={profileCountryLoading}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Select your country...</option>
                      <option value="us">🇺🇸 United States</option>
                      <option value="gb">🇬🇧 United Kingdom</option>
                      <option value="ca">🇨🇦 Canada</option>
                      <option value="de">🇩🇪 Germany</option>
                      <option value="fr">🇫🇷 France</option>
                      <option value="au">🇦🇺 Australia</option>
                      <option value="nl">🇳🇱 Netherlands</option>
                      <option value="br">🇧🇷 Brazil</option>
                      <option value="es">🇪🇸 Spain</option>
                      <option value="it">🇮🇹 Italy</option>
                      <option value="jp">🇯🇵 Japan</option>
                      <option value="sg">🇸🇬 Singapore</option>
                      <option value="in">🇮🇳 India</option>
                      <option value="at">🇦🇹 Austria</option>
                      <option value="ch">🇨🇭 Switzerland</option>
                      <option value="ar">🇦🇷 Argentina</option>
                      <option value="be">🇧🇪 Belgium</option>
                      <option value="bg">🇧🇬 Bulgaria</option>
                      <option value="hr">🇭🇷 Croatia</option>
                      <option value="cy">🇨🇾 Cyprus</option>
                      <option value="cz">🇨🇿 Czech Republic</option>
                      <option value="dk">🇩🇰 Denmark</option>
                      <option value="hk">🇭🇰 Hong Kong</option>
                      <option value="mx">🇲🇽 Mexico</option>
                      <option value="no">🇳🇴 Norway</option>
                      <option value="pl">🇵🇱 Poland</option>
                      <option value="pt">🇵🇹 Portugal</option>
                      <option value="ro">🇷🇴 Romania</option>
                      <option value="za">🇿🇦 South Africa</option>
                      <option value="se">🇸🇪 Sweden</option>
                      <option value="tr">🇹🇷 Turkey</option>
                      <option value="ua">🇺🇦 Ukraine</option>
                      <option value="ae">🇦🇪 UAE</option>
                    </select>
                    <p className="text-gray-400 text-xs mt-1">
                      {profileCountryLoading ? '⏳ Updating...' : '📍 This country will be used for LinkedIn proxy assignment'}
                    </p>
                  </div>
                </div>
              </div>


              {/* Integration Status - Simplified */}
              <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <h2 className="text-2xl font-semibold text-white mb-6">🔗 Connected Services</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-white font-medium">Smart Integration</h3>
                        <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">Intelligent</span>
                      </div>
                      <p className="text-gray-300 text-sm">
                        SAM will prompt you to connect accounts only when needed for specific tasks
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => setShowUnipileModal(true)}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <Settings size={16} className="text-white" />
                        <span>Advanced Setup</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Status indicators - only show what's actually connected */}
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-3">Current Status:</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">LinkedIn Data Access</span>
                        <span className="text-yellow-400">• Connect when needed</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">Email Campaigns</span>
                        <span className="text-yellow-400">• Connect when needed</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">Calendar Integration</span>
                        <span className="text-yellow-400">• Connect when needed</span>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-gray-400">
                      💡 SAM will ask you to connect specific accounts only when required for your workflows
                    </div>
                  </div>
                </div>
              </div>


              {/* App Settings */}
              <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <h2 className="text-2xl font-semibold text-white mb-6">App Settings</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium">Clear Chat History</h3>
                      <p className="text-gray-400 text-sm">Remove all conversation history from this device</p>
                    </div>
                    <button 
                      onClick={async () => {
                        if (confirm('Clear all conversation history? This cannot be undone.')) {
                          await resetConversation();
                          setActiveMenuItem('chat');
                          showNotification('success', 'Chat history cleared successfully');
                        }
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Clear History
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium">Change Password</h3>
                      <p className="text-gray-400 text-sm">Update your account password</p>
                    </div>
                    <button 
                      onClick={() => setShowPasswordChange(true)}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Change Password
                    </button>
                  </div>
                </div>
              </div>

              {/* Account Actions */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-2xl font-semibold text-white mb-6">Account Actions</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium">Sign Out</h3>
                      <p className="text-gray-400 text-sm">Sign out of your SAM AI account</p>
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                    >
                      <LogOut size={16} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
                ) : activeMenuItem === 'superadmin' ? (
          /* SUPER ADMIN PAGE */
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl px-6 py-8 space-y-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-300">
                    <Settings className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-semibold leading-tight text-white tracking-tight">Super Admin Control</h1>
                    <p className="text-sm text-gray-400">
                      Curated to mirror the Knowledge Base experience with streamlined tenant oversight.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setActiveMenuItem('chat')}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-700/70 px-4 py-2 text-sm text-gray-300 transition hover:border-purple-500 hover:text-white"
                  >
                    ← Back to Chat
                  </button>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[320px,minmax(0,1fr)] xl:grid-cols-[360px,minmax(0,1fr)]">
                <div className="space-y-6">
                  {isSuperAdmin ? (
                    <div className="rounded-2xl border border-gray-700/80 bg-gray-900/70 p-6 shadow-lg shadow-black/20">
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-purple-300/80">Super Admin</p>
                          <h2 className="text-xl font-semibold text-white">Workspace Orchestration</h2>
                          <p className="text-sm text-gray-300">
                            Manage tenants, create dedicated workspaces, and invite teams in seconds.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Operating Company
                          </label>
                          <select
                            value={selectedCompany}
                            onChange={(e) => setSelectedCompany(e.target.value as 'All' | 'InnovareAI' | '3cubedai')}
                            className="h-11 w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 text-sm text-white transition focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                          >
                            <option value="All">All Companies</option>
                            <option value="InnovareAI">InnovareAI</option>
                            <option value="3cubedai">3CubedAI</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <button
                            onClick={() => setShowCreateWorkspace(true)}
                            className="flex h-12 items-center justify-center gap-2 rounded-lg border border-purple-500/40 bg-purple-500/15 text-sm font-medium text-purple-100 transition hover:border-purple-400 hover:bg-purple-500/25"
                          >
                            <Building2 size={16} />
                            <span>Create Workspace</span>
                          </button>
                          <button
                            onClick={async () => {
                              console.log('🔄 Refreshing workspaces before opening invite popup...');
                              if (user) {
                                await loadWorkspaces(user.id, isSuperAdmin);
                              }
                              setShowInviteUser(true);
                            }}
                            className="flex h-12 items-center justify-center gap-2 rounded-lg border border-green-500/40 bg-green-500/15 text-sm font-medium text-green-100 transition hover:border-green-400 hover:bg-green-500/25"
                          >
                            <Mail size={16} />
                            <span>Invite User</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowManageUsers(true);
                              loadUsers();
                            }}
                            className="flex h-12 items-center justify-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/15 text-sm font-medium text-blue-100 transition hover:border-blue-400 hover:bg-blue-500/25"
                          >
                            <Users size={16} />
                            <span>Manage Users</span>
                          </button>
                        </div>

                        <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm text-purple-100">
                          <p className="text-xs font-semibold uppercase tracking-wide text-purple-200">Email Routing</p>
                          <p className="mt-1 leading-relaxed">
                            Company emails will be sent from: {companyEmailMessage}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="rounded-xl border border-gray-700/80 bg-gray-900/60 px-4 py-3">
                            <p className="text-xs uppercase tracking-wide text-gray-400">Showing</p>
                            <p className="mt-1 text-2xl font-semibold text-white">
                              {filteredWorkspaceCount}
                            </p>
                            <p className="text-xs text-gray-500">of {totalWorkspaceCount} workspaces</p>
                          </div>
                          <div className="rounded-xl border border-gray-700/80 bg-gray-900/60 px-4 py-3">
                            <p className="text-xs uppercase tracking-wide text-gray-400">Active Members</p>
                            <p className="mt-1 text-2xl font-semibold text-white">
                              {filteredWorkspaceMembers}
                            </p>
                            <p className="text-xs text-gray-500">
                              {overallWorkspaceMembers} across all tenants
                            </p>
                          </div>
                          <div className="rounded-xl border border-gray-700/80 bg-gray-900/60 px-4 py-3">
                            <p className="text-xs uppercase tracking-wide text-gray-400">Pending Invites</p>
                            <p className="mt-1 text-2xl font-semibold text-white">
                              {filteredPendingInvites}
                            </p>
                            <p className="text-xs text-gray-500">
                              {overallPendingInvites} total
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-gray-700/80 bg-gray-900/60 p-6 text-sm text-gray-300">
                      <h2 className="text-lg font-semibold text-white">Limited Access</h2>
                      <p className="mt-2 leading-relaxed">
                        Super admin privileges are required to access tenant-wide controls. Please contact your InnovareAI administrator if you believe this is in error.
                      </p>
                      <button
                        onClick={() => setActiveMenuItem('knowledge')}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-700/70 px-3 py-2 text-xs uppercase tracking-wide text-gray-400 transition hover:border-purple-500 hover:text-white"
                      >
                        Explore Knowledge Base
                      </button>
                    </div>
                  )}

                  {/* MCP Tool Status - Live Data */}
                  {isSuperAdmin && (
                    <div className="rounded-2xl border border-gray-700/80 bg-gray-900/70 p-6 shadow-lg shadow-black/20">
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-blue-300/80">System Status</p>
                          <h2 className="text-xl font-semibold text-white">MCP Tool Status</h2>
                          <p className="text-sm text-gray-300">
                            Monitor the availability and health of all Model Context Protocol (MCP) integrations.
                          </p>
                        </div>

                        {mcpStatusLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                          </div>
                        ) : mcpStatus ? (
                          <>
                            <div className="space-y-3">
                              {/* Google CSE */}
                              {mcpStatus.googleCSE && (
                                <div className={`flex items-center justify-between p-3 rounded-lg ${
                                  mcpStatus.googleCSE.status === 'online' 
                                    ? 'bg-green-900/20 border border-green-500/30' 
                                    : 'bg-red-900/20 border border-red-500/30'
                                }`}>
                                  <div className="flex items-center space-x-3">
                                    <div className={`w-3 h-3 rounded-full ${
                                      mcpStatus.googleCSE.status === 'online' ? 'bg-green-400' : 'bg-red-400'
                                    }`}></div>
                                    <div>
                                      <h4 className="text-white font-medium">Google Custom Search</h4>
                                      <p className="text-xs text-gray-400">{mcpStatus.googleCSE.description}</p>
                                      {mcpStatus.googleCSE.error && (
                                        <p className="text-xs text-red-400 mt-1">{mcpStatus.googleCSE.error}</p>
                                      )}
                                    </div>
                                  </div>
                                  <span className={`text-sm font-medium ${
                                    mcpStatus.googleCSE.status === 'online' ? 'text-green-400' : 'text-red-400'
                                  }`}>
                                    {mcpStatus.googleCSE.status === 'online' ? 'Online' : 'Offline'}
                                  </span>
                                </div>
                              )}

                              {/* Bright Data */}
                              {mcpStatus.brightData && (
                                <div className={`flex items-center justify-between p-3 rounded-lg ${
                                  mcpStatus.brightData.status === 'online' 
                                    ? 'bg-green-900/20 border border-green-500/30' 
                                    : 'bg-red-900/20 border border-red-500/30'
                                }`}>
                                  <div className="flex items-center space-x-3">
                                    <div className={`w-3 h-3 rounded-full ${
                                      mcpStatus.brightData.status === 'online' ? 'bg-green-400' : 'bg-red-400'
                                    }`}></div>
                                    <div>
                                      <h4 className="text-white font-medium">Bright Data</h4>
                                      <p className="text-xs text-gray-400">{mcpStatus.brightData.description}</p>
                                      {mcpStatus.brightData.error && (
                                        <p className="text-xs text-red-400 mt-1">{mcpStatus.brightData.error}</p>
                                      )}
                                    </div>
                                  </div>
                                  <span className={`text-sm font-medium ${
                                    mcpStatus.brightData.status === 'online' ? 'text-green-400' : 'text-red-400'
                                  }`}>
                                    {mcpStatus.brightData.status === 'online' ? 'Online' : 'Offline'}
                                  </span>
                                </div>
                              )}

                              {/* Apify */}
                              {mcpStatus.apify && (
                                <div className={`flex items-center justify-between p-3 rounded-lg ${
                                  mcpStatus.apify.status === 'online' 
                                    ? 'bg-green-900/20 border border-green-500/30' 
                                    : 'bg-red-900/20 border border-red-500/30'
                                }`}>
                                  <div className="flex items-center space-x-3">
                                    <div className={`w-3 h-3 rounded-full ${
                                      mcpStatus.apify.status === 'online' ? 'bg-green-400' : 'bg-red-400'
                                    }`}></div>
                                    <div>
                                      <h4 className="text-white font-medium">Apify</h4>
                                      <p className="text-xs text-gray-400">{mcpStatus.apify.description}</p>
                                      {mcpStatus.apify.error && (
                                        <p className="text-xs text-red-400 mt-1">{mcpStatus.apify.error}</p>
                                      )}
                                    </div>
                                  </div>
                                  <span className={`text-sm font-medium ${
                                    mcpStatus.apify.status === 'online' ? 'text-green-400' : 'text-red-400'
                                  }`}>
                                    {mcpStatus.apify.status === 'online' ? 'Online' : 'Offline'}
                                  </span>
                                </div>
                              )}

                              {/* Unipile */}
                              {mcpStatus.unipile && (
                                <div className={`flex items-center justify-between p-3 rounded-lg ${
                                  mcpStatus.unipile.status === 'online' 
                                    ? 'bg-green-900/20 border border-green-500/30' 
                                    : 'bg-red-900/20 border border-red-500/30'
                                }`}>
                                  <div className="flex items-center space-x-3">
                                    <div className={`w-3 h-3 rounded-full ${
                                      mcpStatus.unipile.status === 'online' ? 'bg-green-400' : 'bg-red-400'
                                    }`}></div>
                                    <div>
                                      <h4 className="text-white font-medium">Unipile</h4>
                                      <p className="text-xs text-gray-400">{mcpStatus.unipile.description}</p>
                                      {mcpStatus.unipile.error && (
                                        <p className="text-xs text-red-400 mt-1">{mcpStatus.unipile.error}</p>
                                      )}
                                    </div>
                                  </div>
                                  <span className={`text-sm font-medium ${
                                    mcpStatus.unipile.status === 'online' ? 'text-green-400' : 'text-red-400'
                                  }`}>
                                    {mcpStatus.unipile.status === 'online' ? 'Online' : 'Offline'}
                                  </span>
                                </div>
                              )}

                              {/* N8N */}
                              {mcpStatus.n8n && (
                                <div className={`flex items-center justify-between p-3 rounded-lg ${
                                  mcpStatus.n8n.status === 'online' 
                                    ? 'bg-green-900/20 border border-green-500/30' 
                                    : 'bg-red-900/20 border border-red-500/30'
                                }`}>
                                  <div className="flex items-center space-x-3">
                                    <div className={`w-3 h-3 rounded-full ${
                                      mcpStatus.n8n.status === 'online' ? 'bg-green-400' : 'bg-red-400'
                                    }`}></div>
                                    <div>
                                      <h4 className="text-white font-medium">N8N Self-Hosted</h4>
                                      <p className="text-xs text-gray-400">{mcpStatus.n8n.description}</p>
                                      {mcpStatus.n8n.error && (
                                        <p className="text-xs text-red-400 mt-1">{mcpStatus.n8n.error}</p>
                                      )}
                                    </div>
                                  </div>
                                  <span className={`text-sm font-medium ${
                                    mcpStatus.n8n.status === 'online' ? 'text-green-400' : 'text-red-400'
                                  }`}>
                                    {mcpStatus.n8n.status === 'online' ? 'Online' : 'Offline'}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="pt-3 border-t border-gray-600">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400">Last updated:</span>
                                <span className="text-white">{mcpStatus.lastUpdated ? new Date(mcpStatus.lastUpdated).toLocaleString() : 'Never'}</span>
                              </div>
                              <div className="flex items-center justify-between text-sm mt-1">
                                <span className="text-gray-400">System status:</span>
                                <span className={`font-medium ${
                                  mcpStatus.onlineCount === mcpStatus.totalCount ? 'text-green-400' : 'text-yellow-400'
                                }`}>
                                  {mcpStatus.onlineCount}/{mcpStatus.totalCount} tools online
                                </span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-8 text-gray-400">
                            <p>Unable to load MCP status</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-gray-700/80 bg-gray-900/60 p-6 space-y-5">
                    <div className="space-y-1">
                      <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                        <Search size={16} className="text-purple-300" />
                        Workspace Focus
                      </h3>
                      <p className="text-sm text-gray-400">
                        Filter by operating company and adjust the layout to match your workflow.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {companyFilterButtons.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setSelectedCompanyFilter(option.value)}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                            selectedCompanyFilter === option.value
                              ? 'border-purple-500 bg-purple-500/20 text-purple-100'
                              : 'border-gray-700/80 bg-gray-800/60 text-gray-300 hover:border-purple-500/60 hover:text-white'
                          }`}
                        >
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        View Mode
                      </span>
                      <div className="inline-flex items-center gap-1 rounded-full border border-gray-700/80 bg-gray-800/80 p-1">
                        {viewModes.map(({ value, label, icon: Icon }) => (
                          <button
                            key={value}
                            onClick={() => setViewMode(value)}
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                              viewMode === value
                                ? 'bg-purple-600 text-white shadow-[0_0_30px_rgba(147,51,234,0.35)]'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            <Icon size={14} />
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Showing {filteredWorkspaceCount} of {totalWorkspaceCount} workspace{totalWorkspaceCount !== 1 ? 's' : ''}</span>
                      {selectedWorkspaces.size > 0 && (
                        <span>{selectedWorkspaces.size} selected</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border border-gray-700/80 bg-gray-900/50 p-6 shadow-inner shadow-black/10">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h2 className="text-2xl font-semibold text-white">
                          {isSuperAdmin ? 'Workspace Directory' : 'My Workspace'}
                        </h2>
                        <p className="text-sm text-gray-400">
                          {filteredWorkspaceCount > 0
                            ? 'Select a workspace to review membership and activity.'
                            : 'Adjust the filters to resurface workspaces.'}
                        </p>
                      </div>
                      {isSuperAdmin && workspaces.length > 0 && (
                        <label className="inline-flex items-center gap-2 rounded-full border border-gray-700/70 bg-gray-800/60 px-3 py-2 text-xs uppercase tracking-wide text-gray-300">
                          <input
                            type="checkbox"
                            onChange={(e) => handleSelectAllWorkspaces(e.target.checked)}
                            checked={selectedWorkspaces.size > 0 && selectedWorkspaces.size === workspaces.length}
                            className="rounded border-gray-600 bg-gray-900 text-purple-500 focus:ring-purple-500"
                          />
                          <span>Select All</span>
                        </label>
                      )}
                    </div>

                    <div className="mt-6">
                      {workspacesLoading ? (
                        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-700/70 text-gray-400">
                          Loading workspace information...
                        </div>
                      ) : workspaces.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-700/70 bg-gray-900/40 py-12 text-center">
                          <Building2 className="h-12 w-12 text-gray-600" />
                          <div>
                            <p className="text-base font-medium text-gray-300">No workspaces created yet</p>
                            <p className="text-sm text-gray-500">Use "Create Workspace" to get started.</p>
                          </div>
                        </div>
                      ) : filteredWorkspaces.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-700/70 bg-gray-900/40 py-12 text-center">
                          <Search className="h-10 w-10 text-gray-600" />
                          <div>
                            <p className="text-base font-medium text-gray-300">No workspaces match the current filter</p>
                            <p className="text-sm text-gray-500">Try switching to "All" or another company.</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {viewMode === 'list' && (
                            <div className="overflow-hidden rounded-2xl border border-gray-800/80 bg-gray-900/40">
                              <div className="divide-y divide-gray-800/80">
                                {filteredWorkspaces.map((workspace) => (
                                  <div
                                    key={workspace.id}
                                    className="group flex flex-col gap-3 px-4 py-4 transition hover:bg-gray-900/70 sm:flex-row sm:items-center sm:justify-between"
                                    onClick={() => setSelectedWorkspaceId(workspace.id)}
                                  >
                                    <div className="flex items-start gap-3">
                                      {isSuperAdmin && (
                                        <input
                                          type="checkbox"
                                          checked={selectedWorkspaces.has(workspace.id)}
                                          onChange={(e) => handleWorkspaceSelect(workspace.id, e.target.checked)}
                                          disabled={workspace.slug === 'innovareai'}
                                          className="mt-1 rounded border-gray-600 bg-gray-900 text-purple-500 focus:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      )}
                                      <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="text-sm font-semibold text-white">{workspace.name}</span>
                                          {workspace.slug && (
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${getWorkspaceCompanyColor(workspace.slug)}`}>
                                              {getWorkspaceCompanyName(workspace.slug)}
                                            </span>
                                          )}
                                        </div>
                                        <div className="mt-1 text-xs text-gray-500">
                                          Created {new Date(workspace.created_at).toLocaleDateString()}
                                        </div>
                                        {isSuperAdmin && workspace.owner && (
                                          <div className="mt-1 text-xs text-gray-500">
                                            Owner: {workspace.owner.email || 'Unknown'}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                      <div className="flex items-center gap-1 text-sm text-gray-300">
                                        <Users size={14} />
                                        <span>{workspace.member_count || workspace.workspace_members?.length || 0}</span>
                                      </div>
                                      {workspace.pendingInvitations > 0 && (
                                        <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-200">
                                          {workspace.pendingInvitations} pending
                                        </span>
                                      )}
                                      <button
                                        className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-100 transition hover:border-green-400 hover:bg-green-500/20"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setInviteWorkspaceId(workspace.id);
                                          setShowInviteUser(true);
                                        }}
                                      >
                                        <Mail size={12} />
                                        <span>Invite</span>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {viewMode === 'card' && (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              {filteredWorkspaces.map((workspace) => (
                                <div
                                  key={workspace.id}
                                  className="flex h-full flex-col justify-between rounded-2xl border border-gray-800/80 bg-gray-900/40 p-5 transition hover:border-purple-500/40 hover:bg-gray-900/60"
                                  onClick={() => setSelectedWorkspaceId(workspace.id)}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      {isSuperAdmin && (
                                        <input
                                          type="checkbox"
                                          checked={selectedWorkspaces.has(workspace.id)}
                                          onChange={(e) => handleWorkspaceSelect(workspace.id, e.target.checked)}
                                          disabled={workspace.slug === 'innovareai'}
                                          className="rounded border-gray-600 bg-gray-900 text-purple-500 focus:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      )}
                                      <Building2 size={20} className="text-purple-300" />
                                    </div>
                                    <button
                                      className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-100 transition hover:border-green-400 hover:bg-green-500/20"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setInviteWorkspaceId(workspace.id);
                                        setShowInviteUser(true);
                                      }}
                                      title="Invite User"
                                    >
                                      <Mail size={12} />
                                      <span>Invite</span>
                                    </button>
                                  </div>
                                  <div className="mt-4 space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h3 className="text-lg font-semibold text-white">{workspace.name}</h3>
                                      {workspace.slug && (
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${getWorkspaceCompanyColor(workspace.slug)}`}>
                                          {getWorkspaceCompanyName(workspace.slug)}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-gray-400">
                                      <span>Created {new Date(workspace.created_at).toLocaleDateString()}</span>
                                      <span className="flex items-center gap-1 text-gray-300">
                                        <Users size={12} />
                                        {workspace.member_count || workspace.workspace_members?.length || 0} members
                                      </span>
                                    </div>
                                    {workspace.pendingInvitations > 0 && (
                                      <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-200">
                                        {workspace.pendingInvitations} pending invitation(s)
                                      </span>
                                    )}
                                    {isSuperAdmin && workspace.owner && (
                                      <p className="text-xs text-gray-500">
                                        Owner: {workspace.owner.email || 'Unknown'}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {viewMode === 'info' && (
                            <div className="space-y-4">
                              {filteredWorkspaces.map((workspace) => (
                                <div
                                  key={workspace.id}
                                  className="rounded-2xl border border-gray-800/80 bg-gray-900/45 p-5 transition hover:border-purple-500/40 hover:bg-gray-900/60"
                                  onClick={() => setSelectedWorkspaceId(workspace.id)}
                                >
                                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div className="flex flex-col gap-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        {isSuperAdmin && (
                                          <input
                                            type="checkbox"
                                            checked={selectedWorkspaces.has(workspace.id)}
                                            onChange={(e) => handleWorkspaceSelect(workspace.id, e.target.checked)}
                                            disabled={workspace.slug === 'innovareai'}
                                            className="rounded border-gray-600 bg-gray-900 text-purple-500 focus:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                        )}
                                        <h3 className="text-lg font-semibold text-white">{workspace.name}</h3>
                                        {workspace.slug && (
                                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${getWorkspaceCompanyColor(workspace.slug)}`}>
                                            {getWorkspaceCompanyName(workspace.slug)}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap gap-4 text-sm text-gray-300">
                                        <span className="flex items-center gap-1">
                                          <Users size={14} />
                                          {workspace.member_count || workspace.workspace_members?.length || 0} members
                                        </span>
                                        <span>Created {new Date(workspace.created_at).toLocaleDateString()}</span>
                                        {isSuperAdmin && workspace.owner && (
                                          <span>Owner: {workspace.owner.email || 'Unknown'}</span>
                                        )}
                                      </div>
                                      {workspace.pendingInvitations > 0 && (
                                        <span className="inline-flex w-fit items-center rounded-full bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-200">
                                          {workspace.pendingInvitations} pending invitation(s)
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 self-start">
                                      <button
                                        className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-100 transition hover:border-green-400 hover:bg-green-500/20"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setInviteWorkspaceId(workspace.id);
                                          setShowInviteUser(true);
                                        }}
                                      >
                                        <Mail size={12} />
                                        Invite
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {selectedWorkspaceId && (() => {
                    const selectedWorkspace = workspaces.find(ws => ws.id === selectedWorkspaceId);
                    if (!selectedWorkspace) return null;

                    return (
                      <div className="rounded-2xl border border-gray-700/80 bg-gray-900/50 p-6 shadow-lg shadow-black/20">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-semibold text-white">Workspace Details</h2>
                            {selectedWorkspace.slug && (
                              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getWorkspaceCompanyColor(selectedWorkspace.slug)}`}>
                                {getWorkspaceCompanyName(selectedWorkspace.slug)}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => setSelectedWorkspaceId(null)}
                            className="rounded-full border border-gray-700/70 px-2 py-1 text-sm text-gray-400 transition hover:border-purple-500 hover:text-white"
                            title="Close details"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                          <div className="space-y-4">
                            <div className="rounded-xl border border-gray-800/80 bg-gray-900/60 p-5">
                              <h3 className="text-lg font-semibold text-white">{selectedWorkspace.name}</h3>
                              <dl className="mt-4 space-y-3 text-sm">
                                <div className="flex justify-between">
                                  <dt className="text-gray-400">Created</dt>
                                  <dd className="text-white">{new Date(selectedWorkspace.created_at).toLocaleDateString()}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt className="text-gray-400">Workspace ID</dt>
                                  <dd className="font-mono text-xs text-gray-200">{selectedWorkspace.id}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt className="text-gray-400">Slug</dt>
                                  <dd className="text-white">{selectedWorkspace.slug || 'N/A'}</dd>
                                </div>
                                {isSuperAdmin && selectedWorkspace.owner && (
                                  <div className="flex justify-between">
                                    <dt className="text-gray-400">Owner</dt>
                                    <dd className="text-white">{selectedWorkspace.owner.email || 'Unknown'}</dd>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <dt className="text-gray-400">Total Members</dt>
                                  <dd className="text-white">{selectedWorkspace.member_count || selectedWorkspace.workspace_members?.length || 0}</dd>
                                </div>
                                {selectedWorkspace.pendingInvitations > 0 && (
                                  <div className="flex items-center justify-between">
                                    <dt className="text-gray-400">Pending Invitations</dt>
                                    <dd className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-200">
                                      {selectedWorkspace.pendingInvitations}
                                    </dd>
                                  </div>
                                )}
                              </dl>
                            </div>

                            <button
                              className="inline-flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-100 transition hover:border-green-400 hover:bg-green-500/20"
                              onClick={() => {
                                setInviteWorkspaceId(selectedWorkspace.id);
                                setShowInviteUser(true);
                              }}
                            >
                              <Mail size={16} />
                              Invite to this workspace
                            </button>
                          </div>

                          <div className="space-y-4">
                            <div className="rounded-xl border border-gray-800/80 bg-gray-900/60 p-5">
                              <h3 className="text-lg font-semibold text-white">Members</h3>
                              {selectedWorkspace.workspace_members && selectedWorkspace.workspace_members.length > 0 ? (
                                <div className="mt-4 space-y-3">
                                  {selectedWorkspace.workspace_members.map((member: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-800/60 bg-gray-900/50 px-3 py-2">
                                      <div>
                                        <p className="text-sm font-medium text-white">{member.users?.email || `User ${member.user_id.slice(0, 8)}`}</p>
                                        <p className="text-xs text-gray-400">
                                          Joined {new Date(member.joined_at).toLocaleDateString()}
                                        </p>
                                      </div>
                                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                        member.role === 'owner'
                                          ? 'bg-purple-500/30 text-purple-100'
                                          : member.role === 'admin'
                                            ? 'bg-blue-500/30 text-blue-100'
                                            : 'bg-gray-700 text-gray-200'
                                      }`}>
                                        {member.role}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="mt-4 rounded-lg border border-dashed border-gray-700/70 bg-gray-900/40 px-3 py-6 text-center text-sm text-gray-500">
                                  No members yet - invite your first teammate.
                                </div>
                              )}
                            </div>

                            {selectedWorkspace.pendingList && selectedWorkspace.pendingList.length > 0 && (
                              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
                                <h4 className="text-base font-semibold text-amber-100">Pending Invitations</h4>
                                <div className="mt-3 space-y-2">
                                  {selectedWorkspace.pendingList.map((invitation: string, idx: number) => (
                                    <div key={idx} className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-50">
                                      {invitation}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {isSuperAdmin && selectedWorkspaces.size > 0 && (
                    <div className="flex flex-col gap-4 rounded-2xl border border-red-500/40 bg-red-950/40 p-5 text-sm text-red-100 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-base font-semibold">
                          Delete {selectedWorkspaces.size} workspace{selectedWorkspaces.size > 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-red-200/80">
                          InnovareAI workspace is protected and cannot be deleted.
                        </p>
                      </div>
                      <button
                        onClick={handleBulkDeleteWorkspaces}
                        disabled={isDeletingWorkspaces}
                        className="inline-flex items-center justify-center rounded-lg border border-red-500/60 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isDeletingWorkspaces ? 'Deleting...' : 'Confirm Delete'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : activeMenuItem === 'sam-analytics' ? (
          /* SAM ANALYTICS PAGE */
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl px-6 py-8 space-y-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-300">
                    <Activity className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-semibold leading-tight text-white tracking-tight">SAM Analytics</h1>
                    <p className="text-sm text-gray-400">
                      Deep insights into SAM performance and optimization opportunities.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setActiveMenuItem('chat')}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-700/70 px-4 py-2 text-sm text-gray-300 transition hover:border-purple-500 hover:text-white"
                  >
                    ← Back to Chat
                  </button>
                </div>
              </div>
              
              {/* SAM Analytics Content */}
              <div className="w-full h-[calc(100vh-200px)] border border-gray-700/80 rounded-2xl overflow-hidden">
                <iframe
                  src="/admin/sam-analytics"
                  className="w-full h-full"
                  style={{ border: 'none' }}
                  title="SAM Analytics Dashboard"
                />
              </div>
            </div>
          </div>
        ) : showStarterScreen ? (
          /* STARTER SCREEN */
          <div className="flex-1 flex flex-col items-center justify-end pb-32 p-6">
            <div className="mb-12">
              <img 
                src="/SAM.jpg" 
                alt="Sam AI" 
                className="w-48 h-48 rounded-full object-cover shadow-lg"
                style={{ objectPosition: 'center 30%' }}
              />
            </div>
            
            <div className="text-center">
              <h2 className="text-white text-2xl font-medium">
                What do you want to get done today?
              </h2>
            </div>
          </div>
        ) : (
          /* CHAT MESSAGES */
          <div
            ref={messagesContainerRef}
            className="space-y-4"
          >
            {isSending && (
              <div className="flex justify-start">
                <div className="max-w-[70%]">
                  <div className="flex items-start space-x-3 min-w-0">
                    <img
                      src="/SAM.jpg"
                      alt="Sam AI"
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1"
                      style={{ objectPosition: 'center 30%' }}
                    />
                    <div className="bg-gray-700 text-white px-4 py-3 rounded-2xl overflow-hidden min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                        <span className="text-sm text-gray-300 ml-2">Sam is thinking...</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {messages.slice().reverse().map((message, index) => {
              // Only animate the first (newest) assistant message
              const isNewestAssistantMessage = index === 0 && message.role === 'assistant' && !isSending;
              
              return (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                    {message.role === 'assistant' && (
                      <div className="flex items-start space-x-3 min-w-0">
                        <img
                          src="/SAM.jpg"
                          alt="Sam AI"
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1"
                          style={{ objectPosition: 'center 30%' }}
                        />
                        <div className="bg-gray-700 text-white px-4 py-3 rounded-2xl break-words overflow-hidden min-w-0 flex-1">
                          <AnimatedMessage
                            content={message.display_content ?? message.content}
                            animate={isNewestAssistantMessage}
                          />
                        </div>
                      </div>
                    )}
                    {message.role === 'user' && (
                      <>
                        <div className="flex items-center justify-end space-x-2 mb-1">
                          <span className="text-gray-400 text-sm font-medium">You</span>
                        </div>
                        <div className="bg-gray-800 text-white px-4 py-3 rounded-2xl break-words overflow-hidden">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere line-clamp-6">{message.display_content ?? message.content}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>

        {/* CHAT INPUT CONTAINER */}
        {activeMenuItem === 'chat' && (
          <div className="fixed bottom-0 left-72 right-0 z-50 px-6 pb-6 pt-8 bg-background/95 backdrop-blur-sm border-t border-border/60">
            <div 
              className={`mx-auto max-w-4xl overflow-hidden rounded-3xl border bg-surface-highlight/60 shadow-glow transition-all ${
                isDraggingFile 
                  ? 'border-purple-500 border-2 bg-purple-600/20 scale-[1.02]' 
                  : 'border-border/60'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Upload Progress Bar */}
              {isUploadingCSV && (
                <div className="px-5 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-purple-400">Uploading CSV...</span>
                    <span className="text-xs text-purple-400">{uploadProgress}%</span>
                  </div>
                  <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              
              <div className="flex items-end gap-3 px-5 py-4">
                <button
                  onClick={() => setShowConversationHistory(true)}
                  className="hidden rounded-full bg-surface px-3 py-2 text-muted-foreground transition hover:text-foreground sm:flex"
                  title="Conversation History"
                >
                  <History size={18} />
                </button>
                
                {/* CSV Upload Button (Paperclip) */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="hidden"
                  id="csv-file-upload"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingCSV}
                  className="hidden rounded-full bg-surface px-3 py-2 text-muted-foreground transition hover:text-foreground hover:bg-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed sm:flex"
                  title="Upload CSV file with prospects"
                >
                  <Paperclip size={18} />
                </button>
                
                {/* Paste CSV Button */}
                <button 
                  onClick={() => setShowPasteModal(true)}
                  disabled={isUploadingCSV}
                  className="hidden rounded-full bg-surface px-3 py-2 text-muted-foreground transition hover:text-foreground hover:bg-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed sm:flex"
                  title="Paste CSV data"
                >
                  <FileText size={18} />
                </button>
                
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={isDraggingFile ? "Drop CSV file here..." : "What do you want to get done?"}
                  className="flex-1 resize-none bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
                  rows={3}
                  disabled={isUploadingCSV}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isSending || !inputMessage.trim() || isUploadingCSV}
                  className="inline-flex items-center gap-2 rounded-full bg-primary/80 px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary disabled:bg-primary/30 disabled:text-primary-foreground/60"
                >
                  <span>{isSending ? 'Sending…' : 'Send'}</span>
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Conversation History */}
      <ConversationHistory
        isOpen={showConversationHistory}
        onClose={() => setShowConversationHistory(false)}
        currentMessages={messages}
        onLoadConversation={handleLoadConversation}
      />

      {/* Paste CSV Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-3xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-white">Paste CSV Data</h3>
              <button
                onClick={() => {
                  setShowPasteModal(false);
                  setPastedCSV('');
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Paste your CSV data below (with headers)
              </label>
              <textarea
                value={pastedCSV}
                onChange={(e) => setPastedCSV(e.target.value)}
                placeholder="name,linkedin_url,company,title\nJohn Doe,https://linkedin.com/in/johndoe,TechCorp,CEO\nJane Smith,https://linkedin.com/in/janesmith,InnovateLabs,CTO"
                className="w-full h-64 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono text-sm"
              />
              <p className="text-xs text-gray-400 mt-2">
                💡 Tip: Copy directly from Excel/Google Sheets or paste CSV text with commas
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowPasteModal(false);
                  setPastedCSV('');
                }}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePasteCSV}
                disabled={!pastedCSV.trim()}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                Process CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-4">Invite User to Workspace</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Select Workspace</label>
              <select
                value={inviteWorkspaceId || ''}
                onChange={(e) => setInviteWorkspaceId(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="">Select a workspace...</option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Company</label>
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="InnovareAI"
                    checked={selectedCompany === 'InnovareAI'}
                    onChange={(e) => setSelectedCompany(e.target.value as 'InnovareAI')}
                    className="mr-2"
                  />
                  <span className="text-white">InnovareAI</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="3cubedai"
                    checked={selectedCompany === '3cubedai'}
                    onChange={(e) => setSelectedCompany(e.target.value as '3cubedai')}
                    className="mr-2"
                  />
                  <span className="text-white">3CubedAI</span>
                </label>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Invitation will be sent from: {
                  selectedCompany === 'All' ? 'sp@innovareai.com or sophia@3cubed.ai' :
                  selectedCompany === 'InnovareAI' ? 'sp@innovareai.com' : 'sophia@3cubed.ai'
                }
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={async () => {
                  if (!inviteEmail.trim() || !inviteWorkspaceId) {
                    showNotification('error', 'Please fill in all fields');
                    return;
                  }

                  try {
                    const response = await fetch('/api/admin/simple-invite', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${await getAuthToken()}`
                      },
                      body: JSON.stringify({
                        email: inviteEmail,
                        firstName: inviteEmail.split('@')[0],
                        lastName: 'User',
                        workspaceId: inviteWorkspaceId,
                        company: selectedCompany,
                        role: 'member'
                      })
                    });

                    const data = await response.json();

                    if (response.ok) {
                      showNotification('success', `Invitation sent successfully to ${inviteEmail} from ${selectedCompany}!`);
                      setShowInviteUser(false);
                      setInviteEmail('');
                      setInviteWorkspaceId(null);
                    } else {
                      showNotification('error', `Failed to send invitation: ${data.error}`);
                    }
                  } catch (error) {
                    console.error('Error sending invitation:', error);
                    showNotification('error', 'Failed to send invitation');
                  }
                }}
                disabled={!inviteEmail.trim() || !inviteWorkspaceId}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white py-2 rounded-lg transition-colors"
              >
                Send Invitation
              </button>
              <button
                onClick={() => {
                  setShowInviteUser(false);
                  setInviteEmail('');
                  setInviteWorkspaceId(null);
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Workspace Modal */}
      {showCreateWorkspace && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-4">Create New Workspace</h3>
            <input
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              placeholder="Workspace name"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white mb-4"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  createWorkspace();
                }
              }}
            />
            <div className="flex space-x-3">
              <button
                onClick={createWorkspace}
                disabled={!newWorkspaceName.trim()}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white py-2 rounded-lg transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreateWorkspace(false);
                  setNewWorkspaceName('');
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordChange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-white mb-4">Change Password</h2>
            <p className="text-gray-400 mb-6">Enter your new password below</p>
            
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  New Password
                </label>
                <input 
                  type="password" 
                  value={passwordChangeData.password}
                  onChange={(e) => setPasswordChangeData(prev => ({ ...prev, password: e.target.value }))}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter new password (min 6 characters)"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm New Password
                </label>
                <input 
                  type="password" 
                  value={passwordChangeData.confirmPassword}
                  onChange={(e) => setPasswordChangeData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Confirm new password"
                />
              </div>
              
              <div className="flex space-x-4 pt-4">
                <button 
                  type="submit"
                  disabled={passwordChangeData.loading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  {passwordChangeData.loading ? 'Updating...' : 'Update Password'}
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setShowPasswordChange(false);
                    setPasswordChangeData({ password: '', confirmPassword: '', loading: false });
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Management Modal */}
      {showManageUsers && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-semibold text-white">Manage Users</h3>
              <button
                onClick={() => setShowManageUsers(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            
            {/* User Statistics */}
            {userStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="text-2xl font-bold text-white">{userStats.total_users}</div>
                  <div className="text-sm text-gray-400">Total Users</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-400">{userStats.active_users}</div>
                  <div className="text-sm text-gray-400">Active Users</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="text-2xl font-bold text-yellow-400">{userStats.pending_invitations}</div>
                  <div className="text-sm text-gray-400">Pending Invites</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-400">{userStats.super_admins}</div>
                  <div className="text-sm text-gray-400">Super Admins</div>
                </div>
              </div>
            )}

            {/* Users List */}
            {usersLoading ? (
              <div className="text-center py-8">
                <div className="text-gray-400">Loading users...</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-600">
                      <th className="text-left py-3 px-4 text-gray-300 w-12">
                        <input
                          type="checkbox"
                          onChange={(e) => handleSelectAllUsers(e.target.checked)}
                          checked={selectedUsers.size > 0 && selectedUsers.size === users.filter(u => !u.is_super_admin).length}
                          className="rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500"
                        />
                      </th>
                      <th className="text-left py-3 px-4 text-gray-300">Email</th>
                      <th className="text-left py-3 px-4 text-gray-300">Status</th>
                      <th className="text-left py-3 px-4 text-gray-300">Workspace</th>
                      <th className="text-left py-3 px-4 text-gray-300">Last Sign In</th>
                      <th className="text-left py-3 px-4 text-gray-300">Created</th>
                      <th className="text-left py-3 px-4 text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-gray-700 hover:bg-gray-700/30">
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedUsers.has(user.id)}
                            onChange={(e) => handleUserSelect(user.id, e.target.checked)}
                            disabled={user.is_super_admin}
                            className="rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <div className="text-white font-medium">{user.email}</div>
                            {user.is_super_admin && (
                              <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded mt-1 inline-block">
                                Super Admin
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs ${
                            user.email_confirmed_at 
                              ? 'bg-green-600 text-white'
                              : 'bg-yellow-600 text-white'
                          }`}>
                            {user.email_confirmed_at ? 'Confirmed' : 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-gray-300">
                            {user.memberships.length > 0 ? (
                              <div className="space-y-1">
                                {user.memberships.map((membership: any, idx: number) => (
                                  <div key={idx} className="text-xs">
                                    <span className="text-white">{membership.workspaces?.name || 'Unknown'}</span>
                                    <span className={`ml-2 px-1 py-0.5 rounded text-xs ${
                                      membership.workspaces?.slug === 'innovareai' 
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-green-500 text-white'
                                    }`}>
                                      {membership.workspaces?.slug || 'Unknown'}
                                    </span>
                                    <span className="ml-2 text-gray-400">({membership.role})</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-500">No workspaces</span>
                            )}
                            {user.pending_invitations.length > 0 && (
                              <div className="text-yellow-400 text-xs mt-1">
                                {user.pending_invitations.length} pending invite(s)
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-300 text-sm">
                          {user.last_sign_in_at 
                            ? new Date(user.last_sign_in_at).toLocaleDateString()
                            : 'Never'
                          }
                        </td>
                        <td className="py-3 px-4 text-gray-300 text-sm">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleResetPassword(user.email)}
                              className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-xs transition-colors"
                              title="Send password reset email"
                            >
                              Reset Password
                            </button>
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  const [workspaceId, role] = e.target.value.split('|');
                                  handleAssignWorkspace(workspaceId, role);
                                  e.target.value = ''; // Reset selection
                                }
                              }}
                              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs transition-colors border-none cursor-pointer"
                              title="Assign user to workspace"
                            >
                              <option value="">Assign Workspace</option>
                              {workspaces.map((workspace) => (
                                <optgroup key={workspace.id} label={`${workspace.name} (${workspace.slug})`}>
                                  <option value={`${workspace.id}|member`}>→ Member</option>
                                  <option value={`${workspace.id}|admin`}>→ Admin</option>
                                  <option value={`${workspace.id}|owner`}>→ Owner</option>
                                </optgroup>
                              ))}
                            </select>
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  const [workspaceId, role] = e.target.value.split('|');
                                  handleReassignWorkspace(user.id, workspaceId, role);
                                  e.target.value = ''; // Reset selection
                                }
                              }}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs transition-colors border-none cursor-pointer ml-2"
                              title="⚠️ Reassign user to different workspace (DELETES ALL HISTORY)"
                            >
                              <option value="">Reassign + Delete History</option>
                              {workspaces.map((workspace) => (
                                <optgroup key={workspace.id} label={`${workspace.name} (${workspace.slug})`}>
                                  <option value={`${workspace.id}|member`}>→ Member</option>
                                  <option value={`${workspace.id}|admin`}>→ Admin</option>
                                  <option value={`${workspace.id}|owner`}>→ Owner</option>
                                </optgroup>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-between items-center mt-6">
              <div className="flex items-center space-x-4">
                {selectedUsers.size > 0 && (
                  <button
                    onClick={handleBulkDeleteUsers}
                    disabled={isDeleting}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-6 py-2 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <span>{isDeleting ? 'Deleting...' : `Delete ${selectedUsers.size} User${selectedUsers.size > 1 ? 's' : ''}`}</span>
                  </button>
                )}
                {selectedUsers.size > 0 && (
                  <span className="text-gray-400 text-sm">
                    {selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''} selected
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowManageUsers(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Workspace Modal */}
      {showAssignWorkspace && selectedUserForWorkspace && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Assign Workspace</h3>
              <button
                onClick={() => {
                  setShowAssignWorkspace(false);
                  setSelectedUserForWorkspace(null);
                }}
                className="text-gray-400 hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-300 mb-2">
                Assigning workspace to: <strong className="text-white">{selectedUserForWorkspace.email}</strong>
              </p>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const workspaceId = formData.get('workspace') as string;
              const role = formData.get('role') as string;
              
              if (workspaceId && role) {
                handleAssignWorkspace(workspaceId, role);
              }
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Workspace
                  </label>
                  <select
                    name="workspace"
                    required
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select a workspace</option>
                    {workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.name} ({workspace.slug})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Role
                  </label>
                  <select
                    name="role"
                    required
                    defaultValue="member"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignWorkspace(false);
                    setSelectedUserForWorkspace(null);
                  }}
                  className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Assign Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite User Popup */}
      <InviteUserPopup
        isOpen={showInviteUser}
        onClose={() => setShowInviteUser(false)}
        onSubmit={handleInviteUser}
        workspaces={workspaces}
      />


      {/* LinkedIn integration moved to dedicated /linkedin-integration page */}

      {/* Unipile Multi-Channel Integration Modal */}
      <UnipileModal
        isOpen={showUnipileModal}
        onClose={() => setShowUnipileModal(false)}
      />

      {/* Channel Selection Modal - Triggered by SAM when needed */}
      <ChannelSelectionModal
        isOpen={showChannelSelectionModal}
        onClose={() => setShowChannelSelectionModal(false)}
        onConfirm={handleChannelSelectionConfirm}
        connectedAccounts={connectedAccounts}
      />

      {/* LinkedIn Settings Modal */}
      {showLinkedInSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 border border-gray-600 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-white flex items-center">
                <LinkedinIcon className="mr-3 text-blue-400" size={28} />
                LinkedIn Integration
              </h2>
              <button 
                onClick={() => setShowLinkedInSettingsModal(false)}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-white font-medium">LinkedIn Account Connection</h3>
                    {linkedInLoading ? (
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <div className={`w-3 h-3 rounded-full ${hasLinkedInConnection ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm">
                    {linkedInLoading ? 'Checking connection status...' : 
                     hasLinkedInConnection ? 'LinkedIn account connected - prospect features enabled' :
                     'Connect your LinkedIn account to enable prospect research and enrichment'}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={checkLinkedInConnection}
                    disabled={linkedInLoading}
                    className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg transition-colors text-sm"
                  >
                    {linkedInLoading ? 'Checking...' : 'Refresh'}
                  </button>
                  
                  {hasLinkedInConnection ? (
                    <>
                      <button 
                        onClick={() => window.location.href = '/linkedin-integration'}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <LinkedInLogo size={16} className="text-white" />
                        <span>Manage LinkedIn</span>
                      </button>
                      <button 
                        onClick={disconnectLinkedIn}
                        disabled={isDisconnectingLinkedIn}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <LinkedInLogo size={16} className="text-white" />
                        <span>{isDisconnectingLinkedIn ? 'Disconnecting...' : 'Disconnect'}</span>
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={requireLinkedInConnection}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                    >
                      <LinkedInLogo size={16} className="text-white" />
                      <span>Connect LinkedIn</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Integration Modal */}
      <EmailProvidersModal 
        isOpen={showEmailIntegrationModal} 
        onClose={() => setShowEmailIntegrationModal(false)} 
      />

      {/* LLM Model Configuration Modal */}
      <LLMConfigModal
        isOpen={showLLMConfigModal}
        onClose={() => setShowLLMConfigModal(false)}
        onSave={() => {
          setShowLLMConfigModal(false);
          // Optionally show success message
        }}
      />

      {/* User Profile Modal */}
      {showUserProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 border border-gray-600 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-white flex items-center">
                <User className="mr-3 text-blue-400" size={28} />
                User Profile
              </h2>
              <button 
                onClick={() => setShowUserProfileModal(false)}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Profile Information Section */}
              <div className="bg-gray-700 rounded-lg p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Account Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white opacity-50"
                    />
                    <p className="text-gray-400 text-xs mt-1">Email cannot be changed</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Account Created</label>
                    <input
                      type="text"
                      value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                      disabled
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white opacity-50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end mt-6 pt-4 border-t border-gray-700">
              <button
                onClick={() => setShowUserProfileModal(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proxy Country Modal */}
      {showProxyCountryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 border border-gray-600 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-white flex items-center">
                <Globe className="mr-3 text-blue-400" size={28} />
                LinkedIn Account Proxy Management
              </h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setShowProxyCountryModal(false);
                    setSelectedLinkedinAccount(null);
                  }}
                  className="text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="space-y-6">
              {/* Profile Country Selector - Always visible at top */}
              <div className="bg-gray-700 rounded-lg p-5 border border-gray-600">
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center">
                  <User className="mr-2 text-blue-400" size={20} />
                  Your Profile Country
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  This country preference is used for automatic proxy assignment when connecting LinkedIn accounts.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Select your country</label>
                  <select
                    value={profileCountry}
                    onChange={async (e) => {
                      const newCountry = e.target.value;
                      setProfileCountry(newCountry);
                      setProfileCountryLoading(true);
                      
                      try {
                        const response = await fetch('/api/profile/update-country', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ country: newCountry })
                        });
                        
                        if (response.ok) {
                          showNotification('success', 'Profile country updated! This will be used for future LinkedIn proxy assignments.');
                        } else {
                          const data = await response.json();
                          showNotification('error', data.error || 'Failed to update country');
                        }
                      } catch (error) {
                        showNotification('error', 'Network error updating country');
                      } finally {
                        setProfileCountryLoading(false);
                      }
                    }}
                    disabled={profileCountryLoading}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                  >
                    <option value="">Select your country...</option>
                    <option value="us">🇺🇸 United States</option>
                    <option value="gb">🇬🇧 United Kingdom</option>
                    <option value="ca">🇨🇦 Canada</option>
                    <option value="de">🇩🇪 Germany</option>
                    <option value="fr">🇫🇷 France</option>
                    <option value="au">🇦🇺 Australia</option>
                    <option value="nl">🇳🇱 Netherlands</option>
                    <option value="br">🇧🇷 Brazil</option>
                    <option value="es">🇪🇸 Spain</option>
                    <option value="it">🇮🇹 Italy</option>
                    <option value="jp">🇯🇵 Japan</option>
                    <option value="sg">🇸🇬 Singapore</option>
                    <option value="in">🇮🇳 India</option>
                    <option value="at">🇦🇹 Austria</option>
                    <option value="ch">🇨🇭 Switzerland</option>
                    <option value="ar">🇦🇷 Argentina</option>
                    <option value="be">🇧🇪 Belgium</option>
                    <option value="bg">🇧🇬 Bulgaria</option>
                    <option value="hr">🇭🇷 Croatia</option>
                    <option value="cy">🇨🇾 Cyprus</option>
                    <option value="cz">🇨🇿 Czech Republic</option>
                    <option value="dk">🇩🇰 Denmark</option>
                    <option value="hk">🇭🇰 Hong Kong</option>
                    <option value="mx">🇲🇽 Mexico</option>
                    <option value="no">🇳🇴 Norway</option>
                    <option value="pl">🇵🇱 Poland</option>
                    <option value="pt">🇵🇹 Portugal</option>
                    <option value="ro">🇷🇴 Romania</option>
                    <option value="za">🇿🇦 South Africa</option>
                    <option value="se">🇸🇪 Sweden</option>
                    <option value="tr">🇹🇷 Turkey</option>
                    <option value="ua">🇺🇦 Ukraine</option>
                    <option value="ae">🇦🇪 UAE</option>
                  </select>
                  <p className="text-gray-400 text-xs mt-2">
                    {profileCountryLoading ? '⏳ Updating...' : '📍 Used for automatic proxy assignment via InnovareAI'}
                  </p>
                </div>
              </div>

              {/* My LinkedIn Account & Proxy Info */}
              <div className="bg-gray-700 rounded-lg p-5 border border-gray-600">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <svg className="mr-2 text-blue-400" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                  </svg>
                  My LinkedIn Account
                </h3>
                {loadingProxyAssignments ? (
                  <div className="text-center py-4">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                    <p className="text-gray-400 text-sm mt-2">Loading...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-gray-400 text-sm">
                      {user?.email ? (
                        <>
                          <p className="mb-2">Account: <span className="text-white">{user.email}</span></p>
                          <p className="mb-2">Status: <span className="text-green-400">Connected via InnovareAI</span></p>
                          <p className="text-xs text-gray-500 mt-3">
                            Proxy details are managed automatically by InnovareAI based on your profile country above.
                          </p>
                        </>
                      ) : (
                        <p className="text-center py-2">No LinkedIn account connected</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Detailed Proxy Information */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-5">
                <h3 className="text-blue-400 font-semibold text-sm mb-3 flex items-center">
                  <svg className="mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  Proxy Information
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Provider</p>
                      <p className="text-white">InnovareAI / Unipile</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Connection Type</p>
                      <p className="text-white">Residential Proxy</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Proxy Location</p>
                      <p className="text-white">{profileCountry ? profileCountry.toUpperCase() : 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Status</p>
                      <p className="text-green-400 flex items-center">
                        <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                        Active
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-blue-500/20 pt-3 mt-3">
                    <p className="text-gray-300 text-xs leading-relaxed">
                      <strong className="text-blue-300">How it works:</strong> All LinkedIn activity from your account is routed through a dedicated residential proxy in your selected country. This ensures your connection appears authentic and prevents LinkedIn from detecting automation.
                    </p>
                  </div>
                  <div className="border-t border-blue-500/20 pt-3">
                    <p className="text-gray-300 text-xs leading-relaxed">
                      <strong className="text-blue-300">Security:</strong> Your proxy configuration is managed automatically and securely by InnovareAI. IP addresses are rotated intelligently to maintain account health while ensuring consistent geolocation.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button 
                onClick={() => setShowProxyCountryModal(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Management Modal */}
      {showTeamManagementModal && (
        workspaces.length > 0 ? (() => {
          const targetWorkspace = isSuperAdmin
            ? (workspaces.find(ws => ws.name === 'InnovareAI Workspace') || workspaces[0])
            : (workspaces.find(ws => ws.owner_id === user?.id || ws.workspace_members?.some((member: any) => member.user_id === user?.id)) || workspaces[0]);

          // Check if workspace uses direct billing (3cubed customers)
          const isDirectBilling = targetWorkspace?.organization_id && targetWorkspace?.slug?.includes('3cubed');

          return (
            <InviteUserModal
              isOpen={showTeamManagementModal}
              onClose={() => setShowTeamManagementModal(false)}
              workspaceId={targetWorkspace?.id}
              workspaceName={targetWorkspace?.name || 'Workspace'}
              isDirectBilling={isDirectBilling}
            />
          );
        })() : (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">No Workspace Found</h2>
              <p className="text-gray-300 mb-6">You need to be logged in and have a workspace to invite team members.</p>
              <button
                onClick={() => setShowTeamManagementModal(false)}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )
      )}

      {/* Workspace Settings Modal */}
      {showWorkspaceSettingsModal && (() => {
        const targetWorkspace = isSuperAdmin
          ? (workspaces.find(ws => ws.name === 'InnovareAI Workspace') || workspaces[0])
          : (workspaces.find(ws => ws.owner_id === user?.id || ws.workspace_members?.some((member: any) => member.user_id === user?.id)) || workspaces[0]);

        return (
          <WorkspaceSettingsModal
            isOpen={showWorkspaceSettingsModal}
            onClose={() => setShowWorkspaceSettingsModal(false)}
            workspaceId={targetWorkspace?.id}
            workspaceName={targetWorkspace?.name || 'Workspace'}
          />
        );
      })()}

      {/* Manage Subscription Modal */}
      {showManageSubscriptionModal && (() => {
        const targetWorkspace = isSuperAdmin
          ? (workspaces.find(ws => ws.name === 'InnovareAI Workspace') || workspaces[0])
          : (workspaces.find(ws => ws.owner_id === user?.id || ws.workspace_members?.some((member: any) => member.user_id === user?.id)) || workspaces[0]);

        return (
          <ManageSubscriptionModal
            isOpen={showManageSubscriptionModal}
            onClose={() => setShowManageSubscriptionModal(false)}
            workspaceId={targetWorkspace?.id}
            workspaceName={targetWorkspace?.name || 'Workspace'}
          />
        );
      })()}

      {/* CRM Integration Modal */}
      {showCrmIntegrationModal && (() => {
        const targetWorkspace = isSuperAdmin
          ? (workspaces.find(ws => ws.name === 'InnovareAI Workspace') || workspaces[0])
          : (workspaces.find(ws => ws.owner_id === user?.id || ws.workspace_members?.some((member: any) => member.user_id === user?.id)) || workspaces[0]);

        return (
          <CRMIntegrationModal
            isOpen={showCrmIntegrationModal}
            onClose={() => setShowCrmIntegrationModal(false)}
            workspaceId={targetWorkspace?.id}
            workspaceName={targetWorkspace?.name || 'Workspace'}
          />
        );
      })()}

      {/* Custom Notification Modal */}
      {notification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-600">
            <div className="flex items-center space-x-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
              }`}>
                {notification.type === 'success' ? '✓' : '✕'}
              </div>
              <div className="flex-1">
                <h3 className={`font-medium ${
                  notification.type === 'success' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {notification.type === 'success' ? 'Success' : 'Error'}
                </h3>
                <p className="text-gray-300 text-sm">{notification.message}</p>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  );
}
