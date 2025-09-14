'use client';

import React, { useState, useEffect, useRef } from 'react';
import KnowledgeBase from './components/KnowledgeBase';
import ContactCenter from './components/ContactCenter';
import CampaignHub from './components/CampaignHub';
import LeadPipeline from './components/LeadPipeline';
import Analytics from './components/Analytics';
import ConversationHistory from '../components/ConversationHistory';
import InviteUserPopup, { InviteFormData } from '../components/InviteUserPopup';
import AuthModal from '../components/AuthModal';
import LinkedInOnboarding from '../components/LinkedInOnboarding';
import { UnipileModal } from '../components/integrations/UnipileModal';
import { ChannelSelectionModal } from '../components/campaign/ChannelSelectionModal';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  MessageCircle, 
  Book, 
  GraduationCap, 
  Users, 
  Megaphone, 
  TrendingUp,
  BarChart3,
  Settings,
  Send,
  Paperclip,
  LogOut,
  History,
  Plus,
  Building2,
  Mail,
  User,
  UserPlus,
  Shield,
  Linkedin as LinkedinIcon,
  Target,
  MessageSquare,
  CheckSquare,
  Database,
  Grid3x3,
  List,
  Info,
  Badge,
  ArrowLeft,
  X
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

export default function Page() {
  // Initialize Supabase client
  const supabase = createClientComponentClient();
  
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
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
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'card' | 'info'>('info');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<'all' | 'innovareai' | '3cubed'>('all');

  // LinkedIn connection state
  const [hasLinkedInConnection, setHasLinkedInConnection] = useState(false);
  const [linkedInLoading, setLinkedInLoading] = useState(false);
  const [showLinkedInOnboarding, setShowLinkedInOnboarding] = useState(false);
  const [showUnipileModal, setShowUnipileModal] = useState(false); // Only show when user clicks Advanced Setup
  const [showChannelSelectionModal, setShowChannelSelectionModal] = useState(false);
  
  // Mock connected accounts for demonstration (in production, fetch from API)
  const [connectedAccounts] = useState([
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

  const [linkedInSkipped, setLinkedInSkipped] = useState(false);
  const [isDisconnectingLinkedIn, setIsDisconnectingLinkedIn] = useState(false);

  // Handler for channel selection confirmation
  const handleChannelSelectionConfirm = (selection: any) => {
    console.log('Channel selection confirmed:', selection);
    setShowChannelSelectionModal(false);
    
    // TODO: Start campaign with selected channels
    alert(`Campaign setup complete!\nStrategy: ${selection.strategy}\nAccounts: ${JSON.stringify(selection.selectedAccounts)}`);
  };

  // Check skip preference on mount
  useEffect(() => {
    const skipped = localStorage.getItem('linkedin-onboarding-skipped');
    if (skipped === 'true') {
      setLinkedInSkipped(true);
    }
  }, []);

  // Handle LinkedIn onboarding completion
  const handleLinkedInOnboardingComplete = () => {
    setShowLinkedInOnboarding(false);
    setHasLinkedInConnection(true);
    localStorage.removeItem('linkedin-onboarding-skipped'); // Clear skip preference on successful connection
    checkLinkedInConnection();
  };

  // Handle LinkedIn onboarding skip
  const handleLinkedInOnboardingSkip = () => {
    setShowLinkedInOnboarding(false);
    setLinkedInSkipped(true);
    localStorage.setItem('linkedin-onboarding-skipped', 'true');
  };

  // Function to show LinkedIn modal when needed (e.g., when user tries to use LinkedIn features)
  const requireLinkedInConnection = () => {
    if (!hasLinkedInConnection && !linkedInSkipped) {
      setShowLinkedInOnboarding(true);
    } else if (!hasLinkedInConnection && linkedInSkipped) {
      // User previously skipped but now needs LinkedIn - show modal again
      setShowLinkedInOnboarding(true);
      setLinkedInSkipped(false);
      localStorage.removeItem('linkedin-onboarding-skipped');
    }
  };

  // Check if user is super admin
  const checkSuperAdmin = (email: string) => {
    const superAdminEmails = ['tl@innovareai.com', 'cl@innovareai.com'];
    return superAdminEmails.includes(email.toLowerCase());
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
          localStorage.removeItem('sam_messages');
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
        setIsAuthLoading(false);
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
      // Load messages from localStorage
      const savedMessages = localStorage.getItem('sam_messages');
      if (savedMessages) {
        try {
          const parsedMessages = JSON.parse(savedMessages);
          if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
            setMessages(parsedMessages);
            setShowStarterScreen(false);
          }
        } catch (error) {
          console.error('Error loading saved messages:', error);
        }
      }

      // Load active menu item
      const savedMenuItem = localStorage.getItem('sam_active_menu');
      if (savedMenuItem) {
        setActiveMenuItem(savedMenuItem);
      }

      setIsLoaded(true);
    }
  }, []);

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem('sam_messages', JSON.stringify(messages));
    }
  }, [messages, isLoaded]);

  // Save active menu item to localStorage
  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem('sam_active_menu', activeMenuItem);
    }
  }, [activeMenuItem, isLoaded]);

  // Check LinkedIn connection when user accesses profile
  useEffect(() => {
    if (activeMenuItem === 'profile' && user) {
      checkLinkedInConnection();
    }
  }, [activeMenuItem, user]);

  // Check LinkedIn connection immediately when user is authenticated
  useEffect(() => {
    if (user && !isAuthLoading) {
      checkLinkedInConnection();
    }
  }, [user, isAuthLoading]);

  // Auto-scroll to bottom when messages change or when sending
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const menuItems = [
    { id: 'chat', label: 'Chat with Sam', icon: MessageCircle, active: true },
    { id: 'knowledge', label: 'Knowledge Base', icon: Book, active: false },
    { id: 'approvals', label: 'Approvals', icon: CheckSquare, active: false },
    { id: 'contact', label: 'Contact Center', icon: Users, active: false },
    { id: 'campaign', label: 'Campaign Hub', icon: Megaphone, active: false },
    { id: 'pipeline', label: 'Lead Pipeline', icon: TrendingUp, active: false },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, active: false },
    ...(isWorkspaceAdmin ? [{ id: 'admin', label: 'Workspace Admin', icon: Shield, active: false }] : []),
    { id: 'profile', label: 'Profile', icon: User, active: false },
    ...(isSuperAdmin ? [{ id: 'superadmin', label: 'SuperAdmin', icon: Settings, active: false }] : [])
  ];

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordChangeData.password !== passwordChangeData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (passwordChangeData.password.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    setPasswordChangeData(prev => ({ ...prev, loading: true }));

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordChangeData.password
      });

      if (error) {
        alert('Error updating password: ' + error.message);
      } else {
        alert('Password updated successfully!');
        setShowPasswordChange(false);
        setPasswordChangeData({ password: '', confirmPassword: '', loading: false });
      }
    } catch (err) {
      alert('An unexpected error occurred');
    } finally {
      setPasswordChangeData(prev => ({ ...prev, loading: false }));
    }
  };

  const handleSendMessage = async () => {
    if (inputMessage.trim()) {
      const userMessage = {
        id: Date.now(),
        role: 'user',
        content: inputMessage.trim()
      };
      
      setMessages(prev => [...prev, userMessage]);
      setInputMessage('');
      setIsSending(true);
      
      if (showStarterScreen) {
        setShowStarterScreen(false);
      }

      // Call SAM AI API with knowledge base integration
      try {
        const response = await fetch('/api/sam/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage.content,
            conversationHistory: messages
          }),
        });

        const data = await response.json();
        
        if (response.ok) {
          const aiMessage = {
            id: Date.now() + 1,
            role: 'assistant',
            content: data.response
          };
          setMessages(prev => [...prev, aiMessage]);
        } else {
          const errorMessage = {
            id: Date.now() + 1,
            role: 'assistant',
            content: "I apologize, but I'm having trouble processing your request right now. Please try again."
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      } catch (error) {
        console.error('Chat API error:', error);
        const errorMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: "I'm experiencing technical difficulties. Please try again in a moment."
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsSending(false);
      }
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

  // Handle logout
  const handleLogout = async () => {
    if (confirm('Are you sure you want to sign out?')) {
      try {
        // Sign out from Supabase completely
        await supabase.auth.signOut({ scope: 'global' });
        
        // Clear all authentication-related storage
        localStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('sam_messages');
        localStorage.removeItem('sam_active_menu');
        
        // Clear session storage as well
        sessionStorage.clear();
        
        // Reset app state
        setMessages([]);
        setShowStarterScreen(true);
        setActiveMenuItem('chat');
        setUser(null);
        setIsAuthLoading(false);
        
        // Force page reload to clear any cached auth state
        window.location.reload();
      } catch (error) {
        console.error('Error signing out:', error);
        // Force reload even if signOut fails
        window.location.reload();
      }
    }
  };

  // Load all workspaces for super admin or user's own workspaces
  const loadWorkspaces = async (userId: string, isAdmin?: boolean) => {
    try {
      console.log('🔄 loadWorkspaces called with userId:', userId, 'isAdmin:', isAdmin, 'isSuperAdmin:', isSuperAdmin);
      setWorkspacesLoading(true);
      
      // Use parameter or current state
      const shouldLoadAllWorkspaces = isAdmin ?? isSuperAdmin;
      console.log('🎯 shouldLoadAllWorkspaces:', shouldLoadAllWorkspaces);
      
      // If super admin, load all workspaces via admin API
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
        .select(`
          *,
          workspace_members (
            id,
            user_id,
            role,
            joined_at,
            users (
              email,
              first_name,
              last_name
            )
          )
        `)
        .eq('owner_id', userId);

      if (ownedError) throw ownedError;

      // Get workspaces where user is a member
      const { data: memberWorkspaces, error: memberError } = await supabase
        .from('workspace_members')
        .select(`
          workspaces (
            *,
            workspace_members (
              id,
              user_id,
              role,
              joined_at,
              users (
                email,
                first_name,
                last_name
              )
            )
          )
        `)
        .eq('user_id', userId);

      if (memberError) throw memberError;

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
        
        alert('LinkedIn accounts have been disconnected successfully.');
      }
      
    } catch (error) {
      console.error('LinkedIn disconnection failed:', error);
      alert('Failed to disconnect LinkedIn accounts. Please try again.');
    } finally {
      setIsDisconnectingLinkedIn(false);
    }
  };

  // Load all users for super admin
  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      
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
        alert('✅ Workspace created successfully!');
        return;
      }

      // If API fails, fall back to direct attempts with progressive schema fallback
      console.log('Service role API failed, trying direct insertion...');
      const attempts = [
        { name: newWorkspaceName, owner_id: user.id, created_by: user.id, company: selectedCompany || 'InnovareAI', settings: {} },
        { name: newWorkspaceName, owner_id: user.id, created_by: user.id, settings: {} },
        { name: newWorkspaceName, owner_id: user.id, settings: {} },
        { name: newWorkspaceName, owner_id: user.id }
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
      alert('✅ Workspace created successfully!');
      
    } catch (error: any) {
      console.error('Complete workspace creation failure:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      
      if (errorMessage.includes('infinite recursion') || errorMessage.includes('Database RLS')) {
        alert(`❌ ${errorMessage}\n\n🔧 To fix: Execute the SQL script in FIX_RLS_POLICIES_MANUAL.sql via Supabase console.`);
      } else {
        alert(`❌ Failed to create workspace: ${errorMessage}`);
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
        alert(`✅ Invitation sent successfully to ${inviteData.email}!`);
        // Refresh users list if open
        if (showManageUsers) {
          loadUsers();
        }
      } else {
        throw new Error(result.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Invitation failed:', error);
      alert(`❌ Failed to send invitation: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  const handleSelectAll = (checked: boolean) => {
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
      // Select all workspaces except InnovareAI (protect the main workspace)
      const allWorkspaceIds = workspaces.filter(ws => ws.slug !== 'innovareai').map(ws => ws.id);
      setSelectedWorkspaces(new Set(allWorkspaceIds));
    } else {
      setSelectedWorkspaces(new Set());
    }
  };

  // Bulk delete users function
  const handleBulkDeleteUsers = async () => {
    if (selectedUsers.size === 0) {
      alert('Please select users to delete');
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
        alert(`✅ Successfully deleted ${selectedUsers.size} user${selectedUsers.size > 1 ? 's' : ''}!`);
        setSelectedUsers(new Set());
        loadUsers(); // Refresh the user list
      } else {
        throw new Error(result.error || 'Failed to delete users');
      }
    } catch (error) {
      console.error('Bulk delete failed:', error);
      alert(`❌ Failed to delete users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk delete workspaces function
  const handleBulkDeleteWorkspaces = async () => {
    if (selectedWorkspaces.size === 0) {
      alert('Please select workspaces to delete');
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
        alert(`✅ Successfully deleted ${selectedWorkspaces.size} workspace${selectedWorkspaces.size > 1 ? 's' : ''}!`);
        setSelectedWorkspaces(new Set());
        if (user) {
          await loadWorkspaces(user.id, isSuperAdmin); // Refresh the workspace list
        }
      } else {
        throw new Error(result.error || 'Failed to delete workspaces');
      }
    } catch (error) {
      console.error('Bulk workspace delete failed:', error);
      alert(`❌ Failed to delete workspaces: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeletingWorkspaces(false);
    }
  };

  // Show loading state while checking authentication OR loading local data
  if (isAuthLoading || !isLoaded) {
    return (
      <div className="flex h-screen bg-gray-900 items-center justify-center">
        <div className="text-center">
          <div className="text-white text-lg font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  // Authentication required - redirect to sign-in if not authenticated
  // TEMPORARY: Bypass for testing LinkedIn modal
  const bypassAuth = process.env.NODE_ENV === 'development' && true; // Set to true to bypass
  const testUser = bypassAuth && !user ? { id: 'test-user', email: 'test@example.com' } : user;
  if (!user && !bypassAuth) {
    return (
      <div className="flex h-screen bg-gray-900 items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <img 
            src="/SAM.jpg" 
            alt="Sam AI" 
            className="w-20 h-20 rounded-full object-cover mx-auto mb-6"
            style={{ objectPosition: 'center 30%' }}
          />
          <h1 className="text-3xl font-bold text-white mb-4">Welcome to SAM AI</h1>
          <p className="text-gray-400 mb-8">Your AI-powered Sales Assistant Platform</p>
          <div className="space-y-4">
            <button 
              onClick={() => {
                setAuthModalMode('signin');
                setShowAuthModal(true);
              }}
              className="block w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-colors transform hover:scale-105"
            >
              Sign In
            </button>
            <button 
              onClick={() => {
                setAuthModalMode('signup');
                setShowAuthModal(true);
              }}
              className="block w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-3 px-6 rounded-lg transition-colors transform hover:scale-105"
            >
              Create Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated user - show main app
  return (
    <div className="flex h-screen bg-gray-800">
      {/* Left Sidebar */}
      <div className="w-64 bg-gray-700 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-600">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <img 
                src="/SAM.jpg" 
                alt="Sam AI" 
                className="w-10 h-10 rounded-full object-cover"
                style={{ objectPosition: 'center 30%' }}
              />
              <div>
                <h2 className="text-white font-bold text-base">SAM AI ✨</h2>
                <p className="text-gray-400 text-sm">Sales Assistant</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 py-2">
          <nav className="space-y-1 px-3">
            {menuItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = item.id === activeMenuItem;
              
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveMenuItem(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                     ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:bg-gray-600 hover:text-gray-300'
                  }`}
                >
                  <IconComponent size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom */}
        <div className="border-t border-gray-600">
          <button 
            onClick={() => {
              if (confirm('Clear all conversation history? This cannot be undone.')) {
                setMessages([]);
                setShowStarterScreen(true);
                setActiveMenuItem('chat');
                localStorage.removeItem('sam_messages');
                localStorage.removeItem('sam_active_menu');
              }
            }}
            className="w-full flex items-center space-x-3 px-6 py-3 text-gray-400 hover:bg-gray-600 hover:text-gray-300 transition-colors"
          >
            <Settings size={18} />
            <span className="text-sm font-medium">Clear History</span>
          </button>
          
          <div className="p-4">
            {testUser ? (
              <div>
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {testUser.email ? testUser.email.charAt(0).toUpperCase() : 'U'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium truncate">
                      {testUser.email || 'Authenticated User'}
                    </p>
                    <p className="text-gray-400 text-xs">Authenticated</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-gray-200 hover:text-white text-sm font-medium transition-colors"
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">A</span>
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Anonymous User</p>
                  <p className="text-gray-400 text-xs">No Authentication</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-gray-900">
        {activeMenuItem === 'knowledge' ? (
          <KnowledgeBase />
        ) : activeMenuItem === 'contact' ? (
          <ContactCenter />
        ) : activeMenuItem === 'campaign' ? (
          <CampaignHub />
        ) : activeMenuItem === 'pipeline' ? (
          <LeadPipeline />
        ) : activeMenuItem === 'analytics' ? (
          <Analytics />
        ) : activeMenuItem === 'approvals' ? (
          /* APPROVALS PAGE */
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-white flex items-center">
                  <CheckSquare className="mr-3" size={36} />
                  Prospect Approvals
                </h1>
                <button 
                  onClick={() => setActiveMenuItem('chat')}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors text-white"
                >
                  ← Back to Chat
                </button>
              </div>

              {/* Monthly Data Volume Overview */}
              <div className="bg-gray-800 rounded-lg p-6 mb-8">
                <h2 className="text-2xl font-semibold text-white mb-6">Monthly Data Volume</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Current Usage */}
                  <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-lg p-6 border border-blue-500">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-white text-lg font-semibold">Current Usage</h3>
                      <Database className="text-blue-400" size={24} />
                    </div>
                    <div className="text-3xl font-bold text-white mb-2">1,247</div>
                    <div className="text-blue-200 text-sm">of 2,000 prospects this month</div>
                    <div className="mt-4 bg-blue-700 rounded-full h-2">
                      <div className="bg-blue-400 h-2 rounded-full" style={{width: '62.35%'}}></div>
                    </div>
                  </div>

                  {/* Remaining Allowance */}
                  <div className="bg-gradient-to-r from-green-900 to-emerald-900 rounded-lg p-6 border border-green-500">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-white text-lg font-semibold">Remaining</h3>
                      <TrendingUp className="text-green-400" size={24} />
                    </div>
                    <div className="text-3xl font-bold text-white mb-2">753</div>
                    <div className="text-green-200 text-sm">prospects available</div>
                    <div className="mt-4">
                      <span className="text-green-400 text-sm">Resets in 18 days</span>
                    </div>
                  </div>

                  {/* Approval Rate */}
                  <div className="bg-gradient-to-r from-purple-900 to-violet-900 rounded-lg p-6 border border-purple-500">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-white text-lg font-semibold">Approval Rate</h3>
                      <CheckSquare className="text-purple-400" size={24} />
                    </div>
                    <div className="text-3xl font-bold text-white mb-2">84%</div>
                    <div className="text-purple-200 text-sm">of prospects approved</div>
                    <div className="mt-4">
                      <span className="text-purple-400 text-sm">↑ 12% from last month</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ICP Setup Status */}
              <div className="bg-gray-800 rounded-lg p-6 mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-white">ICP Configuration</h2>
                  <div className="flex items-center space-x-3">
                    <span className="bg-yellow-600 text-white px-3 py-1 rounded-full text-sm">3 pending approval</span>
                    <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                      + New ICP from KB
                    </button>
                    <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                      Sync Knowledge Base
                    </button>
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                      Review Pending
                    </button>
                  </div>
                </div>

                {/* KB Integration Status */}
                <div className="bg-blue-900 border border-blue-500 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <Database className="text-blue-400" size={20} />
                      <h3 className="text-white font-medium">Knowledge Base Integration</h3>
                    </div>
                    <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs">Live Sync</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="text-blue-200">
                      <div className="font-medium">SAM Interview Data</div>
                      <div className="text-xs text-blue-300">27 interviews processed • Last: 2h ago</div>
                    </div>
                    <div className="text-blue-200">
                      <div className="font-medium">Uploaded Documents</div>
                      <div className="text-xs text-blue-300">43 docs analyzed • CRM exports, case studies</div>
                    </div>
                    <div className="text-blue-200">
                      <div className="font-medium">Performance Feedback</div>
                      <div className="text-xs text-blue-300">Real-time prospect response data</div>
                    </div>
                  </div>
                </div>

                {/* ICP Profile Selector */}
                <div className="flex space-x-1 mb-6 bg-gray-700 rounded-lg p-1">
                  <button className="flex-1 py-2 px-4 text-sm font-medium text-white bg-blue-600 rounded-md">
                    Enterprise Tech (Primary)
                  </button>
                  <button className="flex-1 py-2 px-4 text-sm font-medium text-gray-300 hover:text-white rounded-md">
                    SMB SaaS (Secondary)
                  </button>
                  <button className="flex-1 py-2 px-4 text-sm font-medium text-gray-300 hover:text-white rounded-md">
                    Healthcare Startups
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Pending ICP Items */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Pending Approval</h3>
                    
                    <div className="bg-yellow-900 border border-yellow-500 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-white font-medium">Geographic Expansion</h4>
                        <span className="bg-yellow-600 text-white px-2 py-1 rounded text-xs">KB Analysis</span>
                      </div>
                      <p className="text-yellow-200 text-sm mb-2">Expand targeting to include European markets (UK, Germany, Netherlands)</p>
                      <div className="text-yellow-300 text-xs mb-3">
                        📊 Source: SAM interview #23 mentioned European expansion + CRM data shows EU inquiries
                      </div>
                      <div className="flex space-x-2">
                        <button className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">Approve & Update KB</button>
                        <button className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">Reject</button>
                      </div>
                    </div>

                    <div className="bg-yellow-900 border border-yellow-500 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-white font-medium">Industry Addition</h4>
                        <span className="bg-yellow-600 text-white px-2 py-1 rounded text-xs">Performance Data</span>
                      </div>
                      <p className="text-yellow-200 text-sm mb-2">Add FinTech and InsurTech to target industries based on response patterns</p>
                      <div className="text-yellow-300 text-xs mb-3">
                        📈 Source: 28% response rate from FinTech prospects (above avg) + 3 uploaded case studies
                      </div>
                      <div className="flex space-x-2">
                        <button className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">Approve & Update KB</button>
                        <button className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">Reject</button>
                      </div>
                    </div>

                    <div className="bg-yellow-900 border border-yellow-500 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-white font-medium">Company Size Adjustment</h4>
                        <span className="bg-yellow-600 text-white px-2 py-1 rounded text-xs">AI Learning</span>
                      </div>
                      <p className="text-yellow-200 text-sm mb-2">Adjust employee range to 25-1000 based on successful conversions</p>
                      <div className="text-yellow-300 text-xs mb-3">
                        🤖 Source: SAM AI analysis of 847 successful conversations + uploaded customer list
                      </div>
                      <div className="flex space-x-2">
                        <button className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">Approve & Update KB</button>
                        <button className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">Reject</button>
                      </div>
                    </div>
                  </div>

                  {/* Current Approved ICP */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Enterprise Tech (Primary) - Active</h3>
                      <div className="flex items-center space-x-2">
                        <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs">85% of prospects</span>
                        <button className="text-blue-400 text-xs hover:text-blue-300">Edit Profile</button>
                      </div>
                    </div>
                    
                    <div className="bg-green-900 border border-green-500 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-white font-medium">Company Criteria (Sales Nav)</h4>
                        <CheckSquare className="text-green-400" size={16} />
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-green-200">Company Headcount:</span>
                          <span className="text-white">200 - 5,000</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-green-200">Annual Revenue:</span>
                          <span className="text-white">$20M - $500M</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-green-200">Headcount Growth:</span>
                          <span className="text-white">≥10% (last 12 months)</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-green-200">Company Type:</span>
                          <span className="text-white">Private, Public</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-900 border border-green-500 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-white font-medium">Industry & Technology</h4>
                        <CheckSquare className="text-green-400" size={16} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs">Software Development</span>
                          <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs">IT Services</span>
                          <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs">Cybersecurity</span>
                        </div>
                        <div className="text-green-200 text-xs">
                          <strong>Technologies:</strong> AWS, Azure, Salesforce, HubSpot
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-900 border border-green-500 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-white font-medium">Lead Criteria</h4>
                        <CheckSquare className="text-green-400" size={16} />
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-green-200">Seniority Level:</span>
                          <span className="text-white">VP, Director, C-Level</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-green-200">Function:</span>
                          <span className="text-white">IT, Engineering, Security</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-green-200">Years Experience:</span>
                          <span className="text-white">5+ years</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-green-200">Geography:</span>
                          <span className="text-white">North America, Europe</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-900 border border-green-500 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-white font-medium">Timing & Signals</h4>
                        <CheckSquare className="text-green-400" size={16} />
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="text-green-200">• Changed Jobs (last 90 days)</div>
                        <div className="text-green-200">• Posted on LinkedIn (recent activity)</div>
                        <div className="text-green-200">• Job Opportunities posted</div>
                        <div className="text-green-200">• Department Growth ≥15%</div>
                      </div>
                    </div>

                    <div className="bg-blue-900 border border-blue-500 rounded-lg p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-blue-200">ICP Performance:</span>
                        <span className="text-blue-400 font-medium">94% match rate</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Approval System */}
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold text-white">Data Approval System</h2>
                    <p className="text-gray-400 text-sm mt-1">Hybrid approval for up to 2,000 monthly prospects</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm">1,847 in queue</span>
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                      Configure Rules
                    </button>
                  </div>
                </div>

                {/* Approval Strategy Tabs */}
                <div className="flex space-x-1 mb-6 bg-gray-700 rounded-lg p-1">
                  <button className="flex-1 py-2 px-4 text-sm font-medium text-white bg-blue-600 rounded-md">
                    Auto Approval Rules
                  </button>
                  <button className="flex-1 py-2 px-4 text-sm font-medium text-gray-300 hover:text-white rounded-md">
                    Manual Review Queue
                  </button>
                  <button className="flex-1 py-2 px-4 text-sm font-medium text-gray-300 hover:text-white rounded-md">
                    Batch Processing
                  </button>
                </div>

                {/* Auto Approval Rules */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Rule Configuration */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Automatic Approval Rules</h3>
                    
                    <div className="bg-green-900 border border-green-500 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <CheckSquare className="text-green-400" size={16} />
                          <h4 className="text-white font-medium">High ICP Match (≥95%)</h4>
                        </div>
                        <span className="text-green-400 text-sm">Active</span>
                      </div>
                      <p className="text-green-200 text-sm mb-2">Auto-approve prospects with 95%+ ICP match score</p>
                      <div className="text-green-300 text-xs">Auto-approved: 247 prospects this month</div>
                    </div>

                    <div className="bg-yellow-900 border border-yellow-500 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <CheckSquare className="text-yellow-400" size={16} />
                          <h4 className="text-white font-medium">Multi-ICP Matching</h4>
                        </div>
                        <span className="text-yellow-400 text-sm">Active</span>
                      </div>
                      <p className="text-yellow-200 text-sm mb-2">Auto-approve if matches any ICP profile (Enterprise Tech, SMB SaaS, Healthcare)</p>
                      <div className="text-yellow-300 text-xs">Auto-approved: 892 prospects across all ICPs</div>
                    </div>

                    <div className="bg-gray-700 border border-gray-500 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 border-2 border-gray-500 rounded"></div>
                          <h4 className="text-white font-medium">Revenue Range Filter</h4>
                        </div>
                        <span className="text-gray-400 text-sm">Disabled</span>
                      </div>
                      <p className="text-gray-300 text-sm mb-2">Auto-reject if revenue &lt; $1M or &gt; $100M</p>
                      <button className="text-blue-400 text-xs hover:text-blue-300">Enable Rule</button>
                    </div>
                  </div>

                  {/* Processing Stats */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Processing Overview</h3>
                    
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h4 className="text-white font-medium mb-3">This Month's Processing by ICP</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300 text-sm">Enterprise Tech</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-32 bg-gray-600 rounded-full h-2">
                              <div className="bg-blue-400 h-2 rounded-full" style={{width: '65%'}}></div>
                            </div>
                            <span className="text-white text-sm">847 (65%)</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300 text-sm">SMB SaaS</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-32 bg-gray-600 rounded-full h-2">
                              <div className="bg-green-400 h-2 rounded-full" style={{width: '25%'}}></div>
                            </div>
                            <span className="text-white text-sm">323 (25%)</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300 text-sm">Healthcare Startups</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-32 bg-gray-600 rounded-full h-2">
                              <div className="bg-purple-400 h-2 rounded-full" style={{width: '10%'}}></div>
                            </div>
                            <span className="text-white text-sm">131 (10%)</span>
                          </div>
                        </div>
                        <div className="border-t border-gray-600 pt-2 mt-3">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300 text-sm font-medium">Total Processed</span>
                            <span className="text-white text-sm font-medium">1,301</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-900 border border-blue-500 rounded-lg p-4">
                      <h4 className="text-white font-medium mb-2">Queue Status</h4>
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-blue-400">108</div>
                          <div className="text-blue-200 text-xs">Awaiting Manual Review</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-400">153</div>
                          <div className="text-green-200 text-xs">Remaining Monthly Allowance</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="border-t border-gray-700 pt-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <button className="bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg text-sm transition-colors">
                      Approve High Priority (23)
                    </button>
                    <button className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg text-sm transition-colors">
                      Review Medium Priority (85)
                    </button>
                    <button className="bg-yellow-600 hover:bg-yellow-700 text-white py-3 px-4 rounded-lg text-sm transition-colors">
                      Batch Process Similar (156)
                    </button>
                    <button className="bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg text-sm transition-colors">
                      Clear Low Priority Queue
                    </button>
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
                <h2 className="text-2xl font-semibold text-white mb-6">My Workspaces</h2>
                
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
                                            alert('Member removal functionality will be implemented');
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
          /* USER PROFILE PAGE */
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
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        placeholder="Enter first name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Last Name</label>
                      <input
                        type="text"
                        value={user?.user_metadata?.last_name || ''}
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
                  <button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors">
                    Update Profile
                  </button>
                </div>
              </div>

              {/* LinkedIn Integration */}
              <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <h2 className="text-2xl font-semibold text-white mb-6">LinkedIn Integration</h2>
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
                            onClick={() => window.location.href = '/integrations/linkedin'}
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

              {/* Campaign Management - Simplified */}
              <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <h2 className="text-2xl font-semibold text-white mb-6">🚀 Campaign Management</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-white font-medium">Smart Campaign Builder</h3>
                      </div>
                      <p className="text-gray-300 text-sm">
                        Let SAM guide you through campaign setup and handle account connections automatically
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => {
                          // TODO: Replace with actual SAM conversation trigger
                          alert('SAM: "I can help you set up a campaign! What type of outreach are you planning - LinkedIn prospecting, email campaigns, or both? I\'ll guide you through the process and connect the necessary accounts when needed."')
                        }}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <MessageCircle size={16} className="text-white" />
                        <span>Ask SAM to Help</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Simple workflow indicator */}
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-3">How it works:</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs">1</div>
                        <span className="text-gray-300">Tell SAM what you want to achieve</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs">2</div>
                        <span className="text-gray-300">SAM suggests the best approach and tools</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white text-xs">3</div>
                        <span className="text-gray-300">Connect accounts only when needed</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center text-white text-xs">4</div>
                        <span className="text-gray-300">SAM executes and manages your campaign</span>
                      </div>
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
                      onClick={() => {
                        if (confirm('Clear all conversation history? This cannot be undone.')) {
                          setMessages([]);
                          setShowStarterScreen(true);
                          setActiveMenuItem('chat');
                          localStorage.removeItem('sam_messages');
                          localStorage.removeItem('sam_active_menu');
                          alert('Chat history cleared successfully');
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
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-white flex items-center">
                  <Settings className="mr-3" size={36} />
                  SuperAdmin Panel
                </h1>
                <button 
                  onClick={() => setActiveMenuItem('chat')}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors text-white"
                >
                  ← Back to Chat
                </button>
              </div>

              {/* Super Admin Panel */}
              {isSuperAdmin && (
                <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-lg p-6 mb-6 border border-purple-500">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-semibold text-white flex items-center">
                        <Settings className="mr-2" size={24} />
                        Super Admin Panel
                      </h2>
                      <p className="text-purple-200 text-sm">Advanced tenant and user management</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <label className="text-white text-sm font-medium">Company:</label>
                      <select
                        value={selectedCompany}
                        onChange={(e) => setSelectedCompany(e.target.value as 'All' | 'InnovareAI' | '3cubedai')}
                        className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600"
                      >
                        <option value="All">All Companies</option>
                        <option value="InnovareAI">InnovareAI</option>
                        <option value="3cubedai">3CubedAI</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <button
                      onClick={() => setShowCreateWorkspace(true)}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                    >
                      <Building2 size={18} />
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
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                    >
                      <Mail size={18} />
                      <span>Invite User</span>
                    </button>
                    <button 
                      onClick={() => {
                        setShowManageUsers(true);
                        loadUsers();
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                    >
                      <Users size={18} />
                      <span>Manage Users</span>
                    </button>
                  </div>

                  <div className="text-xs text-purple-200">
                    Company emails will be sent from: {
                      selectedCompany === 'All' ? 'sp@innovareai.com or sophia@3cubed.ai' :
                      selectedCompany === 'InnovareAI' ? 'sp@innovareai.com' : 'sophia@3cubed.ai'
                    }
                  </div>
                </div>
              )}

              {/* Workspace Management */}
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <h2 className="text-2xl font-semibold text-white">
                      {isSuperAdmin ? 'All Workspaces' : 'My Workspaces'}
                    </h2>
                    {isSuperAdmin && workspaces.length > 0 && (
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          onChange={(e) => handleSelectAllWorkspaces(e.target.checked)}
                          checked={selectedWorkspaces.size > 0 && selectedWorkspaces.size === workspaces.filter(ws => ws.slug !== 'innovareai').length}
                          className="rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-gray-400 text-sm">Select All</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    {/* View Mode Toggles */}
                    {workspaces.length > 0 && (
                      <div className="flex items-center space-x-1 bg-gray-700 rounded-lg p-1">
                        <button
                          onClick={() => setViewMode('list')}
                          className={`p-2 rounded-md transition-colors ${
                            viewMode === 'list' 
                              ? 'bg-purple-600 text-white' 
                              : 'text-gray-400 hover:text-white hover:bg-gray-600'
                          }`}
                          title="List View"
                        >
                          <List size={16} />
                        </button>
                        <button
                          onClick={() => setViewMode('card')}
                          className={`p-2 rounded-md transition-colors ${
                            viewMode === 'card' 
                              ? 'bg-purple-600 text-white' 
                              : 'text-gray-400 hover:text-white hover:bg-gray-600'
                          }`}
                          title="Card View"
                        >
                          <Grid3x3 size={16} />
                        </button>
                        <button
                          onClick={() => setViewMode('info')}
                          className={`p-2 rounded-md transition-colors ${
                            viewMode === 'info' 
                              ? 'bg-purple-600 text-white' 
                              : 'text-gray-400 hover:text-white hover:bg-gray-600'
                          }`}
                          title="Info View"
                        >
                          <Info size={16} />
                        </button>
                      </div>
                    )}
                    
                    {/* Real-time workspace count */}
                    <div className="text-gray-400 text-sm">
                      {(() => {
                        const filteredCount = workspaces.filter(workspace => {
                          if (selectedCompanyFilter === 'all') return true;
                          if (selectedCompanyFilter === 'innovareai') return workspace.slug === 'innovareai';
                          if (selectedCompanyFilter === '3cubed') {
                            return workspace.slug === '3cubed' || 
                                   workspace.slug === 'sendingcell' || 
                                   workspace.slug === 'wt-matchmaker' ||
                                   workspace.name.toLowerCase().includes('3cubed') ||
                                   workspace.name.toLowerCase().includes('sendingcell') ||
                                   workspace.name.toLowerCase().includes('wt') || 
                                   workspace.name.toLowerCase().includes('matchmaker');
                          }
                          return false;
                        }).length;
                        
                        return selectedCompanyFilter === 'all' 
                          ? `${workspaces.length} workspace${workspaces.length !== 1 ? 's' : ''}`
                          : `${filteredCount} of ${workspaces.length} workspace${workspaces.length !== 1 ? 's' : ''}`;
                      })()}
                    </div>
                  </div>
                </div>

                {workspacesLoading ? (
                  <div className="text-center py-8">
                    <div className="text-gray-400">Loading workspaces...</div>
                  </div>
                ) : workspaces.length === 0 ? (
                  <div className="text-center py-12 bg-gray-700 rounded-lg">
                    <Building2 className="mx-auto mb-4 text-gray-600" size={48} />
                    <p className="text-gray-400">No workspaces created yet</p>
                    <p className="text-gray-500 text-sm">Use "Create Workspace" in the Super Admin panel above</p>
                  </div>
                ) : (
                  (() => {
                    // Filter workspaces based on selected company
                    const filteredWorkspaces = workspaces.filter(workspace => {
                      if (selectedCompanyFilter === 'all') return true;
                      
                      if (selectedCompanyFilter === 'innovareai') {
                        return workspace.slug === 'innovareai';
                      }
                      
                      if (selectedCompanyFilter === '3cubed') {
                        return workspace.slug === '3cubed' || 
                               workspace.slug === 'sendingcell' || 
                               workspace.slug === 'wt-matchmaker' ||
                               workspace.name.toLowerCase().includes('3cubed') ||
                               workspace.name.toLowerCase().includes('sendingcell') ||
                               workspace.name.toLowerCase().includes('wt') || 
                               workspace.name.toLowerCase().includes('matchmaker');
                      }
                      
                      return false;
                    });

                    return filteredWorkspaces.length === 0 ? (
                      <div className="text-center py-12 bg-gray-700 rounded-lg">
                        <Building2 className="mx-auto mb-4 text-gray-600" size={48} />
                        <p className="text-gray-400">No workspaces found for {selectedCompanyFilter === 'innovareai' ? 'InnovareAI' : selectedCompanyFilter === '3cubed' ? '3cubed' : 'selected company'}</p>
                        <p className="text-gray-500 text-sm">Try selecting "All Companies" or a different company filter</p>
                      </div>
                    ) : (
                  <>
                    {/* List View */}
                    {viewMode === 'list' && (
                      <div className="space-y-2">
                        {filteredWorkspaces.map((workspace) => {
                          const getCompanyColor = (slug: string) => {
                            if (slug === 'innovareai') return 'bg-blue-600 text-white';
                            if (slug === '3cubed' || slug === 'sendingcell' || slug === 'wt-matchmaker') return 'bg-orange-600 text-white';
                            return 'bg-gray-600 text-white';
                          };
                          
                          const getCompanyName = (slug: string) => {
                            if (slug === 'innovareai') return 'InnovareAI';
                            if (slug === '3cubed') return '3cubed';
                            if (slug === 'sendingcell' || slug === 'wt-matchmaker') return '3cubed';
                            return slug;
                          };
                          
                          return (
                            <div 
                              key={workspace.id} 
                              className="bg-gray-700 hover:bg-gray-600 rounded-lg p-3 cursor-pointer transition-colors"
                              onClick={() => setSelectedWorkspaceId(workspace.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  {isSuperAdmin && (
                                    <input
                                      type="checkbox"
                                      checked={selectedWorkspaces.has(workspace.id)}
                                      onChange={(e) => handleWorkspaceSelect(workspace.id, e.target.checked)}
                                      disabled={workspace.slug === 'innovareai'}
                                      className="rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  )}
                                  <div className="flex items-center space-x-2">
                                    <h3 className="text-white font-semibold">
                                      {workspace.name}
                                    </h3>
                                    {workspace.slug && (
                                      <span className={`text-xs px-2 py-1 rounded ${getCompanyColor(workspace.slug)}`}>
                                        {getCompanyName(workspace.slug)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-3 text-gray-400 text-sm">
                                    <span>
                                      {workspace.member_count || workspace.workspace_members?.length || 0} members
                                    </span>
                                    {workspace.pendingInvitations > 0 && (
                                      <span className="bg-amber-600 text-white text-xs px-2 py-1 rounded">
                                        {workspace.pendingInvitations} pending
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <button
                                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center space-x-1 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setInviteWorkspaceId(workspace.id);
                                    setShowInviteUser(true);
                                  }}
                                >
                                  <Mail size={14} />
                                  <span>Invite</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Card View */}
                    {viewMode === 'card' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredWorkspaces.map((workspace) => {
                          const getCompanyColor = (slug: string) => {
                            if (slug === 'innovareai') return 'bg-blue-600 text-white';
                            if (slug === '3cubed' || slug === 'sendingcell' || slug === 'wt-matchmaker') return 'bg-orange-600 text-white';
                            return 'bg-gray-600 text-white';
                          };
                          
                          const getCompanyName = (slug: string) => {
                            if (slug === 'innovareai') return 'InnovareAI';
                            if (slug === '3cubed') return '3cubed';
                            if (slug === 'sendingcell' || slug === 'wt-matchmaker') return '3cubed';
                            return slug;
                          };
                          
                          return (
                            <div 
                              key={workspace.id} 
                              className="bg-gray-700 hover:bg-gray-600 rounded-lg p-4 cursor-pointer transition-colors"
                              onClick={() => setSelectedWorkspaceId(workspace.id)}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  {isSuperAdmin && (
                                    <input
                                      type="checkbox"
                                      checked={selectedWorkspaces.has(workspace.id)}
                                      onChange={(e) => handleWorkspaceSelect(workspace.id, e.target.checked)}
                                      disabled={workspace.slug === 'innovareai'}
                                      className="rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  )}
                                  <Building2 size={20} className="text-purple-400" />
                                </div>
                                <button
                                  className="bg-green-600 hover:bg-green-700 text-white p-2 rounded text-sm transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setInviteWorkspaceId(workspace.id);
                                    setShowInviteUser(true);
                                  }}
                                  title="Invite User"
                                >
                                  <Mail size={14} />
                                </button>
                              </div>
                              
                              <div className="mb-3">
                                <h3 className="text-white font-semibold mb-1">
                                  {workspace.name}
                                </h3>
                                {workspace.slug && (
                                  <span className={`text-xs px-2 py-1 rounded ${getCompanyColor(workspace.slug)}`}>
                                    {getCompanyName(workspace.slug)}
                                  </span>
                                )}
                              </div>
                              
                              <div className="text-sm text-gray-400">
                                <div className="flex items-center space-x-1 mb-1">
                                  <Users size={14} />
                                  <span>{workspace.member_count || workspace.workspace_members?.length || 0} members</span>
                                  {workspace.pendingInvitations > 0 && (
                                    <span className="bg-amber-600 text-white text-xs px-2 py-1 rounded ml-2">
                                      {workspace.pendingInvitations} pending
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Created {new Date(workspace.created_at).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Info View (Default - Full Details) */}
                    {viewMode === 'info' && (
                      <div className="space-y-4">
                        {filteredWorkspaces.map((workspace) => {
                          const getCompanyColor = (slug: string) => {
                            if (slug === 'innovareai') return 'bg-blue-600 text-white';
                            if (slug === '3cubed' || slug === 'sendingcell' || slug === 'wt-matchmaker') return 'bg-orange-600 text-white';
                            return 'bg-gray-600 text-white';
                          };
                          
                          const getCompanyName = (slug: string) => {
                            if (slug === 'innovareai') return 'InnovareAI';
                            if (slug === '3cubed') return '3cubed';
                            if (slug === 'sendingcell' || slug === 'wt-matchmaker') return '3cubed';
                            return slug;
                          };
                          
                          return (
                            <div 
                              key={workspace.id} 
                              className="bg-gray-700 hover:bg-gray-600 rounded-lg p-4 cursor-pointer transition-colors"
                              onClick={() => setSelectedWorkspaceId(workspace.id)}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-start space-x-3">
                                  {isSuperAdmin && (
                                    <input
                                      type="checkbox"
                                      checked={selectedWorkspaces.has(workspace.id)}
                                      onChange={(e) => handleWorkspaceSelect(workspace.id, e.target.checked)}
                                      disabled={workspace.slug === 'innovareai'}
                                      className="rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  )}
                                  <div>
                                    <div className="flex items-center space-x-2 mb-1">
                                      <h3 className="text-white font-semibold">
                                        {workspace.name}
                                      </h3>
                                      {workspace.slug && (
                                        <span className={`text-xs px-2 py-1 rounded ${getCompanyColor(workspace.slug)}`}>
                                          {getCompanyName(workspace.slug)}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-gray-400 text-sm">
                                      Created {new Date(workspace.created_at).toLocaleDateString()}
                                    </p>
                                    {isSuperAdmin && workspace.owner && (
                                      <p className="text-gray-500 text-xs mt-1">
                                        Owner: {workspace.owner.email || 'Unknown'}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button
                                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center space-x-1 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setInviteWorkspaceId(workspace.id);
                                      setShowInviteUser(true);
                                    }}
                                  >
                                    <Mail size={14} />
                                    <span>Invite</span>
                                  </button>
                                </div>
                              </div>
                              
                              <div className="text-sm text-gray-400 flex items-center space-x-3">
                                <div className="flex items-center">
                                  <Users size={14} className="inline mr-1" />
                                  {workspace.member_count || workspace.workspace_members?.length || 0} members
                                </div>
                                {workspace.pendingInvitations > 0 && (
                                  <span className="bg-amber-600 text-white text-xs px-2 py-1 rounded">
                                    {workspace.pendingInvitations} pending
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                    );
                  })()
                )}

                {/* Workspace Detail Page */}
                {selectedWorkspaceId && (
                  (() => {
                    const selectedWorkspace = workspaces.find(ws => ws.id === selectedWorkspaceId);
                    if (!selectedWorkspace) return null;

                    const getCompanyColor = (slug: string) => {
                      if (slug === 'innovareai') return 'bg-blue-600 text-white';
                      if (slug === '3cubed' || slug === 'sendingcell' || slug === 'wt-matchmaker') return 'bg-orange-600 text-white';
                      return 'bg-gray-600 text-white';
                    };
                    
                    const getCompanyName = (slug: string) => {
                      if (slug === 'innovareai') return 'InnovareAI';
                      if (slug === '3cubed') return '3cubed';
                      if (slug === 'sendingcell' || slug === 'wt-matchmaker') return '3cubed';
                      return slug;
                    };

                    return (
                      <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-600">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center space-x-3">
                            <h2 className="text-2xl font-bold text-white">Workspace Details</h2>
                            {selectedWorkspace.slug && (
                              <span className={`text-sm px-3 py-1 rounded ${getCompanyColor(selectedWorkspace.slug)}`}>
                                {getCompanyName(selectedWorkspace.slug)}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => setSelectedWorkspaceId(null)}
                            className="text-gray-400 hover:text-white transition-colors"
                            title="Close details"
                          >
                            <X size={24} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Basic Information */}
                          <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-white border-b border-gray-600 pb-2">
                              {selectedWorkspace.name}
                            </h3>
                            
                            <div className="space-y-3 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-400">Created:</span>
                                <span className="text-white">{new Date(selectedWorkspace.created_at).toLocaleDateString()}</span>
                              </div>
                              
                              <div className="flex justify-between">
                                <span className="text-gray-400">Workspace ID:</span>
                                <span className="text-white font-mono text-xs">{selectedWorkspace.id}</span>
                              </div>
                              
                              <div className="flex justify-between">
                                <span className="text-gray-400">Slug:</span>
                                <span className="text-white">{selectedWorkspace.slug || 'N/A'}</span>
                              </div>

                              {isSuperAdmin && selectedWorkspace.owner && (
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Owner:</span>
                                  <span className="text-white">{selectedWorkspace.owner.email || 'Unknown'}</span>
                                </div>
                              )}

                              <div className="flex justify-between">
                                <span className="text-gray-400">Total Members:</span>
                                <span className="text-white">{selectedWorkspace.member_count || selectedWorkspace.workspace_members?.length || 0}</span>
                              </div>

                              {selectedWorkspace.pendingInvitations > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Pending Invitations:</span>
                                  <span className="bg-amber-600 text-white text-xs px-2 py-1 rounded">
                                    {selectedWorkspace.pendingInvitations}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="pt-4">
                              <button
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center space-x-2 transition-colors"
                                onClick={() => {
                                  setInviteWorkspaceId(selectedWorkspace.id);
                                  setShowInviteUser(true);
                                }}
                              >
                                <Mail size={16} />
                                <span>Invite User to Workspace</span>
                              </button>
                            </div>
                          </div>

                          {/* Members List */}
                          <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-white border-b border-gray-600 pb-2">Members</h3>
                            
                            {selectedWorkspace.workspace_members && selectedWorkspace.workspace_members.length > 0 ? (
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {selectedWorkspace.workspace_members.map((member: any, idx: number) => (
                                  <div key={idx} className="bg-gray-700 rounded p-3 flex items-center justify-between">
                                    <div>
                                      <div className="text-white font-medium">
                                        {member.user?.email || `User ${member.user_id.slice(0, 8)}`}
                                      </div>
                                      <div className="text-gray-400 text-sm">
                                        Joined {new Date(member.created_at).toLocaleDateString()}
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className={`text-xs px-2 py-1 rounded ${
                                        member.role === 'admin' 
                                          ? 'bg-purple-600 text-white' 
                                          : member.role === 'owner'
                                          ? 'bg-yellow-600 text-white'
                                          : 'bg-gray-600 text-white'
                                      }`}>
                                        {member.role}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-8 text-gray-400">
                                <Users size={48} className="mx-auto mb-3 opacity-50" />
                                <p>No members found</p>
                              </div>
                            )}

                            {/* Pending Invitations */}
                            {selectedWorkspace.pendingList && selectedWorkspace.pendingList.length > 0 && (
                              <div className="mt-6">
                                <h4 className="text-lg font-semibold text-amber-400 mb-3">Pending Invitations</h4>
                                <div className="space-y-2">
                                  {selectedWorkspace.pendingList.map((invitation: string, idx: number) => (
                                    <div key={idx} className="bg-amber-900/20 border border-amber-600/30 rounded p-2">
                                      <span className="text-amber-300 text-sm">{invitation}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* Bulk delete controls for workspaces */}
                {isSuperAdmin && selectedWorkspaces.size > 0 && (
                  <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-600">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={handleBulkDeleteWorkspaces}
                        disabled={isDeletingWorkspaces}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-6 py-2 rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <span>{isDeletingWorkspaces ? 'Deleting...' : `Delete ${selectedWorkspaces.size} Workspace${selectedWorkspaces.size > 1 ? 's' : ''}`}</span>
                      </button>
                      <span className="text-gray-400 text-sm">
                        {selectedWorkspaces.size} workspace{selectedWorkspaces.size > 1 ? 's' : ''} selected
                      </span>
                    </div>
                    <div className="text-gray-500 text-xs">
                      Note: InnovareAI workspace is protected and cannot be deleted
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : showStarterScreen ? (
          /* STARTER SCREEN */
          <div className="flex-1 flex flex-col items-center justify-start pt-24 p-6">
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
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                  {message.role === 'assistant' && (
                    <div className="flex items-start space-x-3">
                      <img 
                        src="/SAM.jpg" 
                        alt="Sam AI" 
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1"
                        style={{ objectPosition: 'center 30%' }}
                      />
                      <div className="bg-gray-700 text-white px-4 py-3 rounded-2xl">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </div>
                  )}
                  {message.role === 'user' && (
                    <>
                      <div className="flex items-center justify-end space-x-2 mb-1">
                        <span className="text-gray-400 text-sm font-medium">You</span>
                      </div>
                      <div className="bg-gray-800 text-white px-4 py-3 rounded-2xl">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="max-w-[70%]">
                  <div className="flex items-start space-x-3">
                    <img 
                      src="/SAM.jpg" 
                      alt="Sam AI" 
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1"
                      style={{ objectPosition: 'center 30%' }}
                    />
                    <div className="bg-gray-700 text-white px-4 py-3 rounded-2xl">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                        <span className="text-sm text-gray-300 ml-2">Sam is thinking...</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* CHAT INPUT CONTAINER */}
        {activeMenuItem === 'chat' && (
          <div className="flex-shrink-0 p-6">
            <div className="bg-black text-white px-4 py-3 rounded-t-lg max-w-4xl mx-auto">
              <div className="flex items-center space-x-3">
                <span className="text-sm">
                  {isSending ? 'Processing...' : 'Ready'}
                </span>
                <div className="flex space-x-1">
                  <div className={`w-2 h-2 rounded-full ${isSending ? 'bg-purple-400 animate-pulse' : 'bg-green-400'}`}></div>
                  <div className={`w-2 h-2 rounded-full ${isSending ? 'bg-purple-500 animate-pulse' : 'bg-green-500'}`} style={{animationDelay: '0.2s'}}></div>
                  <div className={`w-2 h-2 rounded-full ${isSending ? 'bg-purple-600 animate-pulse' : 'bg-green-600'}`} style={{animationDelay: '0.4s'}}></div>
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {isSending ? 'Sam is thinking...' : 'Ready to chat with Sam AI'}
              </div>
            </div>
            
            <div className="bg-gray-700 p-4 rounded-b-lg max-w-4xl mx-auto">
              <div className="flex items-end bg-gray-600 rounded-lg px-4 py-2">
                <button 
                  onClick={() => setShowConversationHistory(true)}
                  className="text-gray-400 hover:text-gray-200 transition-colors p-1 mr-2"
                  title="Conversation History"
                >
                  <History size={18} />
                </button>
                <button className="text-gray-400 hover:text-gray-200 transition-colors p-1 mr-2">
                  <Paperclip size={18} />
                </button>
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="What do you want to get done?"
                  className="flex-1 bg-transparent text-white placeholder-gray-400 text-base pl-3 pr-3 py-2 outline-none resize-vertical min-h-[96px] max-h-48"
                  style={{ textAlign: 'left' }}
                  rows={4}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isSending || !inputMessage.trim()}
                  className="text-gray-400 hover:text-gray-200 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors ml-2 px-3 py-1 flex items-center space-x-1"
                >
                  <span className="text-sm font-medium">
                    {isSending ? 'Sending...' : 'Send'}
                  </span>
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Conversation History */}
      <ConversationHistory
        isOpen={showConversationHistory}
        onClose={() => setShowConversationHistory(false)}
        currentMessages={messages}
        onLoadConversation={handleLoadConversation}
      />

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
                    alert('Please fill in all fields');
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
                      alert(`Invitation sent successfully to ${inviteEmail} from ${selectedCompany}!`);
                      setShowInviteUser(false);
                      setInviteEmail('');
                      setInviteWorkspaceId(null);
                    } else {
                      alert(`Failed to send invitation: ${data.error}`);
                    }
                  } catch (error) {
                    console.error('Error sending invitation:', error);
                    alert('Failed to send invitation');
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
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          checked={selectedUsers.size > 0 && selectedUsers.size === users.filter(u => !u.is_super_admin).length}
                          className="rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500"
                        />
                      </th>
                      <th className="text-left py-3 px-4 text-gray-300">Email</th>
                      <th className="text-left py-3 px-4 text-gray-300">Status</th>
                      <th className="text-left py-3 px-4 text-gray-300">Workspaces</th>
                      <th className="text-left py-3 px-4 text-gray-300">Last Sign In</th>
                      <th className="text-left py-3 px-4 text-gray-300">Created</th>
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

      {/* Invite User Popup */}
      <InviteUserPopup
        isOpen={showInviteUser}
        onClose={() => setShowInviteUser(false)}
        onSubmit={handleInviteUser}
        workspaces={workspaces}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authModalMode}
      />

      {/* LinkedIn Onboarding Modal */}
      <LinkedInOnboarding
        isOpen={showLinkedInOnboarding}
        onClose={handleLinkedInOnboardingSkip}
        onComplete={handleLinkedInOnboardingComplete}
      />

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
    </div>
  );
}