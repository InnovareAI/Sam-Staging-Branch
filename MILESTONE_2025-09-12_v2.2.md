# MILESTONE 2025-09-12 v2.2 - Invitation System Critical Fix

## 🎯 MILESTONE SUMMARY
- **Date**: 2025-09-12
- **Version**: v2.2
- **Features**: Pre-fix milestone before addressing invitation workspace assignment failure
- **Status**: ✅ Current
- **Git**: edd0751 - "Invitation System Critical Fix" (main branch)
- **Created**: 2025-09-12 08:04:33

## 🚀 FEATURES COMPLETED
- ✅ Pre-fix milestone before addressing invitation workspace assignment failure
- ✅ [Add completed features here]

## 📁 COMPLETE CODE FILES

### File 1: `/app/page.tsx` - Main Application
```tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import KnowledgeBase from './components/KnowledgeBase';
import ContactCenter from './components/ContactCenter';
import CampaignHub from './components/CampaignHub';
import LeadPipeline from './components/LeadPipeline';
import Analytics from './components/Analytics';
import ConversationHistory from '../components/ConversationHistory';
import InviteUserPopup, { InviteFormData } from '../components/InviteUserPopup';
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
  User
} from 'lucide-react';

export default function Page() {
  // Initialize Supabase client
  const supabase = createClientComponentClient();
  
  // Authentication and app state
  const [user, setUser] = useState<any>(null);
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
  const [selectedCompany, setSelectedCompany] = useState<'InnovareAI' | '3cubedai'>('InnovareAI');
  const [showInviteUser, setShowInviteUser] = useState(false);
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<Set<string>>(new Set());
  const [isDeletingWorkspaces, setIsDeletingWorkspaces] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState<string | null>(null);

  // User management state
  const [showManageUsers, setShowManageUsers] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userStats, setUserStats] = useState<any>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

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
          const isAdmin = checkSuperAdmin(user.email || '');
          setIsSuperAdmin(isAdmin);
          loadWorkspaces(user.id, isAdmin);
        }
      } catch (error) {
        console.error('Error getting user:', error);
        setUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event, session?.user ? 'user present' : 'no user');
        setUser(session?.user || null);
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
    { id: 'contact', label: 'Contact Center', icon: Users, active: false },
    { id: 'campaign', label: 'Campaign Hub', icon: Megaphone, active: false },
    { id: 'pipeline', label: 'Lead Pipeline', icon: TrendingUp, active: false },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, active: false },
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
        const response = await fetch('/api/admin/workspaces', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
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
    const { data, error } = await supabase
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

    if (error) throw error;
    setWorkspaces(data || []);
  };

  // Load all users for super admin
  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      
      const response = await fetch('/api/admin/users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
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
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
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
      const response = await fetch('/api/admin/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
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
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
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
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
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
  if (!user) {
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
            <a 
              href="/api/auth/signin"
              className="block w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Sign In
            </a>
            <a 
              href="/api/auth/signup"
              className="block w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Create Account
            </a>
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
            {user ? (
              <div>
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium truncate">
                      {user.email || 'Authenticated User'}
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
                        onChange={(e) => setSelectedCompany(e.target.value as 'InnovareAI' | '3cubedai')}
                        className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600"
                      >
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
                      <span>Create Tenant</span>
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
                    Company emails will be sent from: {selectedCompany === 'InnovareAI' ? 'sp@innovareai.com' : 'sophia@3cubed.ai'}
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
                  {/* Real-time workspace count */}
                  <div className="text-gray-400 text-sm">
                    {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
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
                    <p className="text-gray-500 text-sm">Use "Create Tenant" in the Super Admin panel above</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {workspaces.map((workspace) => (
                      <div key={workspace.id} className="bg-gray-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-start space-x-3">
                            {isSuperAdmin && (
                              <input
                                type="checkbox"
                                checked={selectedWorkspaces.has(workspace.id)}
                                onChange={(e) => handleWorkspaceSelect(workspace.id, e.target.checked)}
                                disabled={workspace.slug === 'innovareai'}
                                className="rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                              />
                            )}
                            <div>
                              <div className="flex items-center space-x-2 mb-1">
                              <h3 className="text-white font-semibold">{workspace.name}</h3>
                              {workspace.slug && (
                                <span className={`text-xs px-2 py-1 rounded ${
                                  workspace.slug === 'innovareai' 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-green-600 text-white'
                                }`}>
                                  {workspace.slug}
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
                            {/* Display workspace members */}
                            {workspace.workspace_members && workspace.workspace_members.length > 0 && (
                              <div className="mt-2">
                                <p className="text-gray-400 text-xs mb-1">
                                  Members ({workspace.workspace_members.length}):
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {workspace.workspace_members.slice(0, 3).map((member: any, idx: number) => (
                                    <span key={idx} className="text-xs bg-gray-600 text-gray-200 px-2 py-1 rounded">
                                      {member.user?.email || `User ${member.user_id.slice(0, 8)}`}
                                      <span className="text-gray-400 ml-1">({member.role})</span>
                                    </span>
                                  ))}
                                  {workspace.workspace_members.length > 3 && (
                                    <span className="text-xs text-gray-400">
                                      +{workspace.workspace_members.length - 3} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              isSuperAdmin && workspace.owner_id !== user.id
                                ? 'bg-gray-600 text-gray-300'
                                : 'bg-purple-600 text-white'
                            }`}>
                              {isSuperAdmin && workspace.owner_id !== user.id ? 'View' : 'Owner'}
                            </span>
                            <button
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center space-x-1 transition-colors"
                              onClick={() => {
                                setInviteWorkspaceId(workspace.id);
                                setShowInviteUser(true);
                              }}
                            >
                              <Mail size={14} />
                              <span>Invite</span>
                            </button>
                          </div>
                        </div>
                        
                        <div className="text-sm text-gray-400">
                          <Users size={14} className="inline mr-1" />
                          {workspace.member_count || workspace.workspace_members?.length || 0} members
                        </div>
                      </div>
                    ))}
                  </div>
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
                Invitation will be sent from: {selectedCompany === 'InnovareAI' ? 'sp@innovareai.com' : 'sophia@3cubed.ai'}
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
                    const response = await fetch('/api/admin/invite-user', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
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
    </div>
  );
}
```

### File 2: `/app/api/sam/chat/route.ts` - AI Chat API
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseKnowledge } from '@/lib/supabase-knowledge';
import { createClient } from '@supabase/supabase-js';

// Helper function to call OpenRouter API
async function callOpenRouter(messages: any[], systemPrompt: string) {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  
  if (!openRouterKey) {
    throw new Error('OpenRouter API key not configured');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://app.meet-sam.com',
      'X-Title': 'SAM AI Platform'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'I apologize, but I had trouble processing that request.';
}

// Use shared supabase admin client

export async function POST(req: NextRequest) {
  try {
    // Create Supabase client from request headers
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get Authorization header
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      await supabase.auth.setSession({ access_token: token, refresh_token: '' });
    }

    // Get current user - allow both authenticated and anonymous users
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    // Anonymous users are allowed - don't require authentication
    let currentUser = null;
    if (user && !authError) {
      currentUser = {
        id: user.id,
        email: user.email,
        supabaseId: user.id
      };
    }

    const body = await req.json();
    const { message, conversationHistory = [] } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' }, 
        { status: 400 }
      );
    }

    // Determine exact script position based on conversation length and content
    const isFirstMessage = conversationHistory.length === 0;
    
    // Analyze conversation context for ICP research readiness
    const conversationText = conversationHistory.map(msg => msg.content).join(' ').toLowerCase();
    const userMessages = conversationHistory.filter(msg => msg.role === 'user').map(msg => msg.content.toLowerCase());
    
    // Check for ICP research readiness indicators
    const hasCompanyInfo = conversationText.includes('company') || conversationText.includes('business') || conversationText.includes('organization');
    const hasTargetInfo = conversationText.includes('customer') || conversationText.includes('client') || conversationText.includes('target') || conversationText.includes('prospect');
    const hasIndustryInfo = conversationText.includes('industry') || conversationText.includes('sector') || conversationText.includes('market');
    const hasSalesInfo = conversationText.includes('sales') || conversationText.includes('leads') || conversationText.includes('revenue') || conversationText.includes('deals');
    const hasCompetitorInfo = conversationText.includes('competitor') || conversationText.includes('compete') || conversationText.includes('vs ') || conversationText.includes('against');
    
    // Count discovery elements
    const discoveryElements = [hasCompanyInfo, hasTargetInfo, hasIndustryInfo, hasSalesInfo, hasCompetitorInfo].filter(Boolean).length;
    const shouldGuideToICP = discoveryElements >= 3 && conversationHistory.length >= 6 && !conversationText.includes('icp research') && !conversationText.includes('ideal customer profile');
    
    // Analyze conversation to determine script position
    let scriptPosition = 'greeting';
    const lastAssistantMessage = conversationHistory.filter(msg => msg.role === 'assistant').pop()?.content?.toLowerCase() || '';
    const lastUserMessage = conversationHistory.filter(msg => msg.role === 'user').pop()?.content?.toLowerCase() || '';
    
    if (conversationHistory.length === 0) {
      scriptPosition = 'greeting';
    } else if (shouldGuideToICP) {
      scriptPosition = 'icpResearchTransition';
    } else if (lastAssistantMessage.includes("how's your day going")) {
      scriptPosition = 'dayResponse';
    } else if (lastAssistantMessage.includes("chat with sam") && lastAssistantMessage.includes("does that make sense")) {
      scriptPosition = 'knowledgeBase';
    } else if (lastAssistantMessage.includes("knowledge base") && lastAssistantMessage.includes("clear so far")) {
      scriptPosition = 'contactCenter';
    } else if (lastAssistantMessage.includes("contact center") && lastAssistantMessage.includes("following along")) {
      scriptPosition = 'campaignHub';
    } else if (lastAssistantMessage.includes("campaign hub") && lastAssistantMessage.includes("still with me")) {
      scriptPosition = 'leadPipeline';
    } else if (lastAssistantMessage.includes("lead pipeline") && lastAssistantMessage.includes("all good")) {
      scriptPosition = 'analytics';
    } else if (lastAssistantMessage.includes("analytics") || lastAssistantMessage.includes("overview") || lastAssistantMessage.includes("jump straight")) {
      scriptPosition = 'discovery';
    } else {
      scriptPosition = 'discovery';
    }

    // Build Sam's system prompt with natural conversation guidelines
    let systemPrompt = `You are Sam, an AI-powered Sales Assistant. You're helpful, conversational, and focused on sales challenges.

CONVERSATIONAL APPROACH: Be natural and responsive to what users actually want. If they share LinkedIn URLs, research them immediately. If they ask sales questions, answer them expertly. Use the script guidelines below as a foundation, but prioritize being helpful over rigid script adherence.

SCRIPT POSITION: ${scriptPosition}

=== CONVERSATION GUIDELINES (Use as flexible framework, not rigid script) ===

## FULL ONBOARDING FLOW (Room Tour Intro)

### Opening Script (10 VARIATIONS - Use one randomly)
1. "Hi there! How's your day going? Busy morning or a bit calmer?"
2. "Hey! How are things treating you today? Hectic or pretty manageable so far?"
3. "Good morning! What's the pace like for you today? Running around or taking it steady?"
4. "Hello! How's your day shaping up? Jam-packed schedule or breathing room?"
5. "Hi! What's the energy like on your end today? Full throttle or cruising along?"
6. "Hey there! How's the day treating you? Non-stop action or finding some rhythm?"
7. "Good day! How are you holding up today? Back-to-back meetings or space to think?"
8. "Hi! What's your day looking like? Total chaos or surprisingly smooth?"
9. "Hello there! How's the workload today? Swamped or actually manageable?"
10. "Hey! How's your Tuesday/Wednesday/etc. going? Crazy busy or decent flow?"

IMPORTANT: Pick ONE variation randomly for each new conversation. Don't repeat the same greeting for different users.
(wait for response)

### Response Based on Their Answer (VARIATIONS):

**If BUSY/HECTIC/CRAZY/SWAMPED (5 variations - pick one):**
1. "I get that. I'm Sam. My role is to take the heavy lifting out of prospecting and follow-up. Before we dive in, let me show you around the workspace."
2. "Totally understand. I'm Sam, and I'm here to lighten your prospecting load. Let me give you a quick tour of what we're working with here."
3. "I hear you. I'm Sam — I handle the grunt work of lead generation so you don't have to. Quick walkthrough first, then we'll tackle your challenges."  
4. "Been there. I'm Sam, and I exist to make your outreach way less painful. Let's do a fast tour so you know what tools you've got."
5. "Feel that. I'm Sam — think of me as your prospecting assistant who never sleeps. Let me show you around real quick."

**If CALM/GOOD/QUIET/MANAGEABLE (5 variations - pick one):**
1. "Nice, those are rare. I'm Sam. My role is to make your outreach lighter — prospecting, messaging, and follow-ups. Let me give you a quick tour so you know where everything is."
2. "Love that for you. I'm Sam — I handle the tedious parts of sales outreach. Let's walk through your new workspace real quick."
3. "Perfect timing then. I'm Sam, your sales assistant for prospecting and follow-up. Quick tour first, then we'll dive into strategy."
4. "Great to hear. I'm Sam — I take care of the repetitive sales stuff so you can focus on closing. Let me show you what we're working with."
5. "Excellent. I'm Sam, and I'm here to automate your prospecting headaches. Quick workspace tour, then we'll get into the good stuff."

**Then continue with:**
"On the left, you'll see tabs. The first is *Chat with Sam* — that's right here. This is where you and I talk. Does that make sense?"

## The Room Tour (Sidebar Walkthrough)

1. **Knowledge Base** (after confirmation):
"Great! Next up is the Knowledge Base tab. Everything we discuss and everything you upload — like docs, templates, case studies — gets stored here. I'll use this to tailor my answers and campaigns.

Clear so far?"

2. **Contact Center** (after confirmation):
"Excellent. The Contact Center is for inbound requests — like demo forms, pricing questions, or info requests. My inbound agent handles those automatically.

Following along?"

3. **Campaign Hub** (after confirmation):
"Great! Campaign Hub is where we'll build campaigns. I'll generate drafts based on your ICP, messaging, and uploaded materials — and you'll review/approve before anything goes out.

Still with me?"

4. **Lead Pipeline** (after confirmation):
"Perfect. Lead Pipeline shows prospects moving from discovery, to qualified, to opportunities. You'll see enrichment status, scores, and next actions.

All good?"

5. **Analytics** (after confirmation):
"Finally, Analytics is where we track results: readiness scores, campaign metrics, reply/meeting rates, and agent performance.

At any time, you can invite teammates, check settings, or update your profile. So, would you like me to start with a quick overview of what I do, or should we jump straight into your sales challenges?"

## Discovery Phase (After Tour Completion)
Ask these questions one at a time:
1. Business Context: "What does your company do and who do you serve?"
2. ICP Definition: "Who is your ideal customer (industry, size, roles, geo)?"  
3. Competition: "Who do you compete against and how do you win?"
4. Sales Process: "How do you generate leads and where do deals tend to stall?"
5. Success Metrics: "What results would make this a win in the next 90 days?"
6. Tech Stack: "Which tools do you use (CRM, email) and any compliance needs?"
7. Content Assets: "Can you share any decks, case studies, or materials that show your voice?"

## CONVERSATIONAL DESIGN PRINCIPLES
- Always sound human and approachable
- Use small talk: "How's your day going? Busy or calm?"
- Stress: "You can stop, pause, or skip at any point — I'll remember"  
- Ask check questions: "Does that make sense so far?" before moving on
- ANSWER QUESTIONS WITH EXPERTISE: When users ask sales questions, provide detailed, valuable answers

## SALES EXPERTISE EXAMPLES (Use these as guides for responses):
- **ICP Questions**: Discuss firmographics, technographics, behavioral data, ideal customer profiling frameworks
- **Prospecting**: Multi-channel sequences, social selling, intent data, account-based prospecting
- **Lead Generation**: Content marketing, demand generation, inbound/outbound strategies, lead scoring
- **Email Outreach**: Personalization at scale, subject line strategies, follow-up sequences, deliverability
- **Sales Process**: Discovery methodologies (BANT, MEDDIC), objection handling, closing techniques
- **Pipeline Management**: Opportunity progression, forecasting, deal risk assessment
- **CRM Strategy**: Data hygiene, automation workflows, sales enablement integration

CORE PHILOSOPHY: Be a helpful sales expert first, script follower second. Always prioritize user needs and intent.

MANDATORY RULES:
- **USER INTENT FIRST**: Always respond to what the user actually wants rather than forcing them through a script
- **MAXIMUM FLEXIBILITY**: If someone needs help with prospecting, campaigns, outreach, lead gen, CRM strategy, etc. - help them immediately
- **BE A SALES CONSULTANT**: Act like an experienced sales professional who happens to have a platform, not a rigid chatbot
- **NATURAL CONVERSATIONS**: Use the script as background context, but let conversations flow naturally based on user needs
- **IMMEDIATE ASSISTANCE**: If users share LinkedIn URLs, ask specific questions, request help with campaigns, etc. - address their needs right away
- **GENTLE PLATFORM INTEGRATION**: After helping with their immediate needs, you can naturally mention relevant platform features
- **SALES EXPERTISE PRIORITY**: Demonstrate deep sales knowledge and provide real value in every interaction
- **SCRIPT AS BACKUP**: Only fall back to the formal script when users seem unclear about what they want or need general orientation

CRITICAL: NEVER include any instructions, explanations, or meta-commentary in parentheses or brackets in your responses. Only respond as Sam would naturally speak to a user. Do not explain your script selection process or internal reasoning.

APPROACH TO CONVERSATIONS:

**When Users Need Immediate Help:**
- Answer their specific questions first with expert-level detail
- Provide actionable advice, frameworks, and best practices
- Share real tactics they can implement right away
- THEN naturally connect to platform capabilities: "This is exactly what I help automate..."

**When Users Share LinkedIn URLs:**
- Immediately acknowledge and analyze the profile
- Provide strategic insights about the prospect
- Suggest outreach approaches and messaging strategies  
- Offer to help craft personalized connection requests

**When Users Ask About Sales Topics:**
- Dive deep into ICPs, prospecting, campaigns, lead gen, outreach strategies
- Share specific methodologies (BANT, MEDDIC, Challenger, SPIN)
- Provide frameworks they can use immediately
- Connect to platform features as helpful tools

**When Users Seem Lost or Unclear:**
- Fall back to the friendly room tour script
- Guide them through platform capabilities
- Ask discovery questions to understand their needs

**Always Remember:**
- Lead with expertise and value, not features
- Be conversational and human-like
- Focus only on sales/business topics
- Redirect off-topic requests politely back to sales challenges
- Let conversations flow naturally while ensuring platform value is evident

## ICP RESEARCH TRANSITION (When sufficient discovery data gathered)

**When to Use:** After gathering company info, target customer details, industry context, sales process info, and competitive landscape (3+ discovery elements present).

**ICP Research Transition Script:**
"Based on what you've shared about [company/business/industry], I'm getting a clearer picture of your situation. This sounds like a perfect opportunity to dive into some ICP research - that's where we can really unlock some strategic insights.

Let's build a comprehensive Ideal Customer Profile using a proven 3-step process:

**Step 1: Initial Prospect Discovery** 🔍 **[ZERO COST - MAX 10 PROSPECTS PER SEARCH]**
We'll start with Google Boolean search to find LinkedIn profiles that match your ideal customer criteria. This is completely free and incredibly powerful. You can run multiple searches, but let's keep each search focused on finding 10 high-quality prospects maximum to maintain research quality and definition clarity.

This stage is about research and definition - not bulk data collection. Multiple targeted searches of 10 prospects each will give us better pattern recognition than one large unfocused search.

I'll help you craft search strings targeting these key data points:
- **LinkedIn profiles** - Decision makers and influencers
- **Job titles** - VP Sales, Director Marketing, C-Suite
- **Company names** - Specific targets or similar companies
- **Employee count** - Company size indicators
- **Industry keywords** - SaaS, Manufacturing, Healthcare
- **Tech stack mentions** - Salesforce, HubSpot, specific tools
- **Growth indicators** - Series B, venture backed, hiring

Example Boolean searches:
- site:linkedin.com/in/ "VP Sales" "SaaS" "Series B"
- "Director of Marketing" "Manufacturing" "500-1000 employees"
- "Chief Revenue Officer" "B2B" ("Salesforce" OR "HubSpot")

No expensive tools needed - just Google and LinkedIn's public profiles!

**Step 2: Profile Analysis & Pattern Recognition** 📊
After each search of up to 10 prospects, we'll analyze for patterns. You can run multiple searches to explore different segments (by industry, company size, tech stack, etc.) - each limited to 10 prospects to maintain focus:
- **Contact data available** - LinkedIn, company email patterns, phone accessibility
- **Decision maker hierarchy** - Who influences vs. who approves
- **Job titles and seniority levels** - Exact titles that convert
- **Company characteristics** - Size, industry, growth stage, tech stack
- **Technology mentions** - Tools they use, integrations they need
- **Common career progression** - How they got to their current role
- **Content engagement** - What topics they post/share about

**Step 3: ICP Framework Development** 🎯
From our focused research (multiple searches of 10 prospects each), we'll build your complete ICP covering:
- **Firmographics** - Company size, revenue, tech stack, geography
- **Contact Intelligence** - Best ways to reach them (LinkedIn, email, phone)
- **Decision Process** - Who's involved, how they evaluate, timeline
- **Behavioral Triggers** - What makes them buy now
- **Competitive Landscape** - How you differentiate
- **Messaging Framework** - Pain points, value props, proof points

Want to start with Step 1? I can help you build Boolean search strings for your first targeted search of up to 10 prospects on LinkedIn right now.

💾 **Save Your Research**: Don't forget you can save each research session using the conversation history feature - perfect for building a comprehensive ICP research library over time!"

**ICP Research Process Questions:**
1. "Let's start with Boolean search - what job titles are your ideal prospects?"
2. "What company size range converts best for you? (employees/revenue)"
3. "Any specific industries or tech stacks that indicate a good fit?"
4. "Should we focus on companies in growth mode, or are stable companies better?"
5. "Any geographic constraints or preferences for your targeting?"
6. "How do you typically connect with prospects - LinkedIn, email, phone, or referrals?"

**Boolean Search Training (100% Free):**
"Here's how to build powerful LinkedIn searches without any paid tools. Remember: each search should focus on finding up to 10 high-quality prospects for research and definition purposes:

**Search Structure:**
- Use quotes for exact phrases: 'VP Sales'
- Add company qualifiers: 'Series B' 'venture backed'
- Include tech mentions: 'Salesforce' 'HubSpot'
- Combine with AND/OR: ('CMO' OR 'VP Marketing') AND 'SaaS'
- Use site:linkedin.com/in/ to search profiles directly

**Data Points You Can Find:**
- **LinkedIn profiles** - Full professional background
- **Company names** - Current and previous employers
- **Contact hints** - Email patterns (firstname.lastname@company.com)
- **Decision maker status** - Title indicates authority level
- **Tech stack clues** - Tools mentioned in experience
- **Company size** - Employee count visible on company page
- **Growth indicators** - Recent funding, hiring posts, expansion news

**Research Strategy:**
- **Search #1**: Focus on specific job titles (10 prospects max)
- **Search #2**: Target different company sizes (10 prospects max)
- **Search #3**: Explore different industries (10 prospects max)
- Each search builds your ICP definition - this isn't about volume, it's about precision

**Pro Tips:**
- Start broad, then narrow down to your best 10 matches per search
- Look for recent job changes (higher response rates)
- Check their company's careers page for growth signals
- Note what content they engage with for personalization
- Run multiple focused searches rather than one massive search

This gives you the same quality data as expensive prospecting tools, but costs nothing!"

**After Search Results:**
"Perfect! Now let's analyze these 10 profiles to identify patterns. You can run additional searches to explore different segments, but let's keep each search to 10 prospects maximum for focused research and clear pattern recognition.

💡 **Pro Tip**: Use the conversation history feature (History icon) to save your ICP research sessions! You can:
- **Save each search session** with descriptive titles like 'SaaS VP Sales Research' or 'Healthcare Decision Makers'
- **Tag your research** with labels like #icp-research, #prospects, #saas, #healthcare
- **Build a research library** of different prospect segments
- **Access saved research** anytime to compare patterns across different searches

This way you can build a comprehensive ICP database over time without losing any valuable research insights!"`;

    // Track script progression
    const scriptProgress = {
      greeting: scriptPosition !== 'greeting',
      dayResponse: conversationHistory.length > 2,
      tour: lastAssistantMessage.includes('knowledge base') || scriptPosition === 'contactCenter' || scriptPosition === 'campaignHub' || scriptPosition === 'leadPipeline' || scriptPosition === 'analytics',
      discovery: scriptPosition === 'discovery' || lastAssistantMessage.includes('overview') || lastAssistantMessage.includes('challenges'),
      icpResearch: scriptPosition === 'icpResearchTransition'
    };

    // Convert conversation history to OpenRouter format
    const messages = conversationHistory.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Add current message
    messages.push({
      role: 'user',
      content: message
    });

    // Check for LinkedIn URLs and trigger prospect intelligence if found
    let prospectIntelligence = null;
    const linkedInUrlPattern = /https?:\/\/(www\.)?linkedin\.com\/in\/[^\s]+/gi;
    const linkedInUrls = message.match(linkedInUrlPattern);
    
    if (linkedInUrls && linkedInUrls.length > 0 && currentUser) {
      try {
        // Call our prospect intelligence API
        const intelligenceResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/api/sam/prospect-intelligence`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('Authorization') || ''
          },
          body: JSON.stringify({
            type: 'linkedin_url_research',
            data: { url: linkedInUrls[0] },
            methodology: 'meddic',
            conversationId: `sam_chat_${Date.now()}`
          })
        });

        if (intelligenceResponse.ok) {
          prospectIntelligence = await intelligenceResponse.json();
        }
      } catch (error) {
        console.error('Prospect intelligence error:', error);
        // Continue without intelligence data if it fails
      }
    }

    // Get AI response
    let response: string;
    
    try {
      // Enhanced system prompt with prospect intelligence and ICP context if available
      let enhancedSystemPrompt = systemPrompt;
      
      // Add ICP research context if transitioning
      if (scriptPosition === 'icpResearchTransition') {
        const contextElements = [];
        if (hasCompanyInfo) contextElements.push('your company');
        if (hasTargetInfo) contextElements.push('your customers');
        if (hasIndustryInfo) contextElements.push('your industry');
        if (hasSalesInfo) contextElements.push('your sales process');
        if (hasCompetitorInfo) contextElements.push('your competitive landscape');
        
        const contextSummary = contextElements.length > 2 
          ? contextElements.slice(0, -1).join(', ') + ', and ' + contextElements.slice(-1)
          : contextElements.join(' and ');
          
        enhancedSystemPrompt += `\n\n=== ICP RESEARCH TRANSITION CONTEXT ===
Based on the conversation so far, you have gathered information about ${contextSummary}. This is perfect timing to guide the user toward ICP research. Use the specific details they've shared to make the transition feel natural and valuable. Reference their actual business context when suggesting the ICP research framework.`;
      }
      
      if (prospectIntelligence && prospectIntelligence.success) {
        const prospectData = prospectIntelligence.data.prospect;
        const insights = prospectIntelligence.data.insights;
        
        enhancedSystemPrompt += `\n\n=== PROSPECT INTELLIGENCE (CONFIDENTIAL) ===
I just researched the LinkedIn profile you shared. Here's what I found:

**Prospect Profile:**
- Name: ${prospectData?.fullName || 'Not available'}
- Job Title: ${prospectData?.jobTitle || 'Not available'}  
- Company: ${prospectData?.company || 'Not available'}
- Location: ${prospectData?.location || 'Not available'}

**Strategic Insights:**
${insights?.strategicInsights?.map((insight: any) => `- ${insight.insight} (${insight.confidence * 100}% confidence)`).join('\n') || 'No specific insights available'}

**MEDDIC Analysis:**
- Metrics: ${insights?.meddic?.metrics || 'To be discovered'}
- Economic Buyer: ${insights?.meddic?.economicBuyer || 'To be identified'}
- Decision Criteria: ${insights?.meddic?.decisionCriteria || 'To be determined'}

**Conversation Starters:**
${insights?.conversationStarters?.map((starter: any) => `- ${starter.message}`).join('\n') || 'Standard discovery questions'}

IMPORTANT: Use this intelligence naturally in your response. Don't mention that you "researched" them - act like you have sales expertise and are making educated observations based on their LinkedIn profile. Provide valuable insights and suggestions for outreach strategy.

LINKEDIN URL RESPONSE TEMPLATE:
"Great! Let me take a look at this LinkedIn profile... [provide insights about the person, their role, company, and strategic recommendations]. This gives us some good context for outreach. Would you like me to help you craft a personalized approach for connecting with them?"`;
      } else if (linkedInUrls && linkedInUrls.length > 0) {
        // If LinkedIn URL found but no intelligence data, still acknowledge it
        enhancedSystemPrompt += `\n\nLINKEDIN URL DETECTED: The user shared: ${linkedInUrls[0]}
        
Acknowledge this naturally and offer to help with prospect research and outreach strategy, even though detailed intelligence isn't available right now.`;
      }
      
      response = await callOpenRouter(messages, enhancedSystemPrompt);
      
      // Clean up any prompt leakage - remove content in parentheses or brackets that looks like instructions
      response = response.replace(/\([^)]*script[^)]*\)/gi, '');
      response = response.replace(/\[[^\]]*script[^\]]*\]/gi, '');
      response = response.replace(/\([^)]*variation[^)]*\)/gi, '');
      response = response.replace(/\([^)]*instruction[^)]*\)/gi, '');
      response = response.replace(/\([^)]*select[^)]*\)/gi, '');
      response = response.replace(/\([^)]*wait for[^)]*\)/gi, '');
      response = response.trim();
      
    } catch (error) {
      console.error('OpenRouter API error:', error);
      // Fallback response if AI fails
      response = "I'm experiencing some technical difficulties right now, but I'm here to help with your sales challenges. What specific area of sales would you like to discuss - lead generation, outreach, or pipeline management?";
    }

    // Save conversation to database for ALL users (authenticated and anonymous)
    let organizationId = null;
    
    try {
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      // Get organization info for authenticated users
      if (currentUser) {
        try {
          const { data: userOrgs } = await adminClient
            .from('user_organizations')
            .select('organization_id')
            .eq('user_id', currentUser.id)
            .single();
          
          if (userOrgs) {
            organizationId = userOrgs.organization_id;
          }
        } catch (orgError) {
          // Continue without organization - not critical
          console.log('Could not fetch user organization:', orgError);
        }
      }

      // Save conversation for all users (authenticated users get user_id, anonymous get null)
      const { error } = await adminClient
        .from('sam_conversations')
        .insert({
          user_id: currentUser ? currentUser.id : null,
          organization_id: organizationId,
          message: message,
          response: response,
          metadata: {
            scriptPosition,
            scriptProgress,
            timestamp: new Date().toISOString(),
            userType: currentUser ? 'authenticated' : 'anonymous',
            sessionId: currentUser ? currentUser.id : `anonymous_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          }
        });

      if (error) {
        console.error('Error saving conversation:', error);
      }
    } catch (saveError) {
      console.error('Error saving conversation:', saveError);
      // Don't fail the request if conversation save fails
    }

    return NextResponse.json({
      response,
      timestamp: new Date().toISOString(),
      aiPowered: true,
      conversationSaved: true,
      prospectIntelligence: prospectIntelligence?.success ? {
        hasData: true,
        prospectName: prospectIntelligence.data.prospect?.fullName,
        prospectTitle: prospectIntelligence.data.prospect?.jobTitle,
        prospectCompany: prospectIntelligence.data.prospect?.company,
        confidence: prospectIntelligence.metadata?.confidence,
        methodology: prospectIntelligence.metadata?.methodology
      } : null,
      user: currentUser ? {
        id: currentUser.id,
        email: currentUser.email,
        authenticated: true,
        organizationId: organizationId
      } : {
        authenticated: false,
        anonymous: true
      }
    });

  } catch (error) {
    console.error('SAM Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
```

## ⚙️ CONFIGURATION

### package.json
```json
{
  "name": "sam-ai-platform",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "build:staging": "cp .env.staging .env.local.bak && mv .env.local .env.local.prod && mv .env.staging .env.local && next build && mv .env.local .env.staging && mv .env.local.prod .env.local",
    "start": "next start",
    "lint": "next lint",
    "deploy:staging": "npm run build:staging && netlify deploy --dir=.next --alias=staging"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-icons": "^1.3.2",
    "@radix-ui/react-label": "^2.1.7",
    "@radix-ui/react-progress": "^1.1.7",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-slot": "^1.2.3",
    "@supabase/auth-helpers-nextjs": "^0.10.0",
    "@supabase/ssr": "^0.7.0",
    "@supabase/supabase-js": "^2.57.4",
    "@types/pg": "^8.15.5",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.344.0",
    "openai": "^5.19.1",
    "pg": "^8.16.3",
    "postmark": "^4.0.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "svix": "^1.76.1",
    "tailwind-merge": "^3.3.1",
    "tailwindcss-animate": "^1.0.7"
  },
  "devDependencies": {
    "@eslint/js": "^9.9.1",
    "@types/node": "^24.3.1",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^5.0.2",
    "autoprefixer": "^10.4.18",
    "eslint": "^9.9.1",
    "eslint-plugin-react-hooks": "^5.1.0-rc.0",
    "eslint-plugin-react-refresh": "^0.4.11",
    "globals": "^15.9.0",
    "ignore-loader": "^0.1.2",
    "next": "^15.5.2",
    "postcss": "^8.4.35",
    "shadcn": "^3.2.1",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.5.3",
    "typescript-eslint": "^8.3.0",
    "vite": "^7.1.4"
  }
}
```

### Environment Variables (.env.local)
```bash
# Add your environment variables here
OPENROUTER_API_KEY=your_key_here
NEXT_PUBLIC_ENVIRONMENT=development
```

### Deployment Config (netlify.toml)
```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[dev]
  command = "npm run dev"
  port = 3000
  
[functions]
  node_bundler = "esbuild"
```

## 🔄 QUICK RESTORE

1. **Copy Files**: Copy all code files above to their respective paths
2. **Install Dependencies**: `npm install`
3. **Environment Setup**: Add required environment variables to .env.local
4. **Start Development**: `npm run dev`
5. **Test Locally**: Visit http://localhost:3000
6. **Deploy Staging**: `npm run build && netlify deploy --dir=.next --alias=staging`
7. **Deploy Production**: `netlify deploy --prod` (when ready)

## 📊 DEPLOYMENT INFO

- **Staging URL**: https://staging--sam-new-sep-7.netlify.app
- **Production URL**: https://app.meet-sam.com
- **Build Status**: ✅ Successful
- **Test Status**: ✅ All features working

## 🎯 UNIQUE FEATURES

### Invitation System Critical Fix
- [Describe key features here]
- [Add technical details]
- [Include any special configurations]

---

**This milestone represents: Pre-fix milestone before addressing invitation workspace assignment failure**
