'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, 
  Book, 
  Users, 
  Megaphone, 
  TrendingUp, 
  BarChart3, 
  Send, 
  LogOut,
  Brain
} from 'lucide-react';
import { supabase } from './lib/supabase';
import KnowledgeBase from './components/KnowledgeBase';
import ContactCenter from './components/ContactCenter';
import CampaignHub from './components/CampaignHub';
import LeadPipeline from './components/LeadPipeline';
import Analytics from './components/Analytics';

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [hasWorkspace, setHasWorkspace] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [activeMenuItem, setActiveMenuItem] = useState('chat');
  const [messages, setMessages] = useState<Array<any>>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showStarterScreen, setShowStarterScreen] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  

  // Menu items for navigation
  const menuItems = [
    { id: 'chat', label: 'Chat with Sam', icon: MessageCircle },
    { id: 'knowledge', label: 'Knowledge Base', icon: Book },
    { id: 'training', label: 'Sam Training Room', icon: Brain },
    { id: 'contact', label: 'Contact Center', icon: Users },
    { id: 'campaign', label: 'Campaign Hub', icon: Megaphone },
    { id: 'pipeline', label: 'Lead Pipeline', icon: TrendingUp },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  useEffect(() => {
    const initializeUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!error && user) {
          setUser(user);
          if (user.email_confirmed_at) {
            await checkUserWorkspace(user);
          }
        }
      } catch (error) {
        console.error('Auth init error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user || null);
        if (session?.user?.email_confirmed_at) {
          await checkUserWorkspace(session.user);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const checkUserWorkspace = async (user) => {
    try {
      // CRITICAL: Only proceed if user has confirmed email
      if (!user?.email_confirmed_at) {
        console.log('🚫 User email not confirmed, skipping workspace check');
        setHasWorkspace(false);
        return;
      }

      // Check if user is assigned to any workspace
      const { data: userOrgs, error } = await supabase
        .from('user_organizations')
        .select('organization_id, organizations(name)')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error checking user workspaces:', error);
        return;
      }

      // If user has any workspace assignments, they don't need to create one
      if (userOrgs && userOrgs.length > 0) {
        setHasWorkspace(true);
        console.log('✅ User belongs to workspaces:', userOrgs);
      } else {
        setHasWorkspace(false);
        console.log('⚠️ User has no workspace assignments - will show workspace creation');
      }
    } catch (error) {
      console.error('Failed to check user workspaces:', error);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);

    try {
      if (isForgotPassword) {
        // Password reset
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        alert('Password reset email sent! Check your inbox.');
        setIsForgotPassword(false);
      } else if (isSignUp) {
        // Validate password match
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        
        // Validate password length
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              full_name: `${firstName} ${lastName}`,
            }
          }
        });
        if (error) throw error;
        alert('Check your email for verification!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      alert('Please enter your email address first');
      return;
    }

    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
      });
      if (error) throw error;
      alert('Magic link sent! Check your email.');
    } catch (error) {
      alert(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const resendVerificationEmail = async () => {
    if (!user?.email) return;
    
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });
      
      if (error) {
        alert('Failed to resend verification email: ' + error.message);
      } else {
        alert('Verification email sent! Please check your inbox.');
      }
    } catch (error) {
      alert('Failed to resend verification email. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const createOrganization = async (e) => {
    e.preventDefault();
    if (!workspaceName.trim()) {
      alert('Please enter an organization name');
      return;
    }

    setWorkspaceLoading(true);
    try {
      // Get the current session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/organization/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          name: workspaceName.trim(),
          userId: user.id,
        }),
      });

      if (!response.ok) {
        // Handle non-JSON error responses
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create workspace');
        } else {
          const text = await response.text();
          throw new Error(`Failed to create workspace: ${response.status} ${text}`);
        }
      }
      
      const data = await response.json();

      setHasWorkspace(true);
      alert('🎉 Workspace created successfully! Welcome to SAM AI!');
    } catch (error) {
      alert(error.message);
    } finally {
      setWorkspaceLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-900 items-center justify-center">
        <div className="text-center">
          <div className="text-white text-lg font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  // Show email verification screen for unverified users
  if (user && !user.email_confirmed_at) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <img 
              src="/SAM.jpg" 
              alt="Sam AI" 
              className="w-32 h-32 rounded-full object-cover mx-auto mb-8"
              style={{ objectPosition: 'center 30%' }}
            />
            <h2 className="text-3xl font-extrabold text-white mb-4">
              Verify Your Email
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              We sent a verification link to:<br/>
              <span className="text-purple-400 font-medium">{user.email}</span>
            </p>
            <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-4 mb-8">
              <p className="text-yellow-200 text-sm">
                📧 Check your email and click the verification link to continue.<br/>
                Don't forget to check your spam folder!
              </p>
            </div>
          </div>
          
          <div className="space-y-4">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-6 rounded-lg font-medium transition-colors"
            >
              I've Verified My Email
            </button>
            
            <button
              onClick={resendVerificationEmail}
              disabled={authLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {authLoading ? 'Sending...' : 'Resend Verification Email'}
            </button>
            
            <button
              onClick={handleSignOut}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 px-6 rounded-lg font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
          
          <p className="text-gray-500 text-sm mt-6">
            Email verification helps us prevent spam and keep SAM AI secure.
          </p>
        </div>
      </div>
    );
  }

  // Check if user is super admin
  const isSuperAdmin = user?.email === 'tl@innovareai.com';
  
  // Debug logging
  if (user) {
    console.log('🔍 DEBUG - User state:', {
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      hasWorkspace,
      isSuperAdmin,
      conditionCheck: user && user.email_confirmed_at && !hasWorkspace && !isSuperAdmin
    });
  }

  // Show workspace creation for verified users without workspace (with extra safety checks)
  if (user && user.email_confirmed_at && !hasWorkspace && !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <img 
              src="/SAM.jpg" 
              alt="Sam AI" 
              className="w-32 h-32 rounded-full object-cover mx-auto mb-8"
              style={{ objectPosition: 'center 30%' }}
            />
            <h2 className="text-3xl font-extrabold text-white mb-4">
              🚀 Create Your Workspace
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              Welcome {user.user_metadata?.first_name || user.email}!<br/>
              Let's set up your SAM AI workspace.
            </p>
          </div>
          
          <form onSubmit={createOrganization} className="space-y-4">
            <input
              type="text"
              placeholder="Workspace Name (e.g., Acme Corp)"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
            
            <button 
              type="submit"
              disabled={workspaceLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-6 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {workspaceLoading ? '⚡ Creating...' : '🚀 Create Workspace'}
            </button>
          </form>
          
          <button
            onClick={handleSignOut}
            className="flex items-center justify-center space-x-2 w-full py-3 px-6 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span>Sign Out</span>
          </button>
          
          <div className="text-center text-sm text-gray-500">
            Your workspace will be your dedicated environment for SAM AI.<br/>
            You'll be the workspace owner and can invite team members later.
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <img 
              src="/SAM.jpg" 
              alt="Sam AI" 
              className="w-32 h-32 rounded-full object-cover mx-auto mb-8"
              style={{ objectPosition: 'center 30%' }}
            />
            <h2 className="text-4xl font-extrabold text-white mb-4">
              Welcome to SAM AI
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              Your intelligent sales assistant
            </p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && !isForgotPassword && (
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
            )}
            
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
            
            {!isForgotPassword && (
              <>
                <input
                  type="password"
                  placeholder={isSignUp ? "Password (min 6 characters)" : "Password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
                
                {isSignUp && (
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                )}
              </>
            )}
            
            <button 
              type="submit"
              disabled={authLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-6 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {authLoading ? 'Loading...' : 
                isForgotPassword ? 'Send Reset Email' :
                isSignUp ? 'Create Account' : 'Sign In'
              }
            </button>
          </form>
          
          <div className="text-center space-y-2">
            {!isForgotPassword && (
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-purple-400 hover:text-purple-300 block w-full"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            )}
            
            {!isSignUp && (
              <div className="flex justify-center items-center space-x-4 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(!isForgotPassword);
                    setPassword('');
                    setConfirmPassword('');
                  }}
                  className="text-gray-400 hover:text-gray-300"
                >
                  {isForgotPassword ? 'Back to Sign In' : 'Forgot password?'}
                </button>
                
                {!isForgotPassword && (
                  <>
                    <span className="text-gray-600">|</span>
                    <button
                      type="button"
                      onClick={handleMagicLink}
                      disabled={authLoading}
                      className="text-purple-400 hover:text-purple-300 disabled:opacity-50"
                    >
                      Magic Link
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          
          <p className="text-gray-500 text-sm mt-6">
            Experience the power of AI-driven sales automation
          </p>
        </div>
      </div>
    );
  }

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

        {/* User Profile & Logout */}
        <div className="border-t border-gray-600 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-white text-sm font-medium">
                  {user?.email}
                </p>
                <p className="text-gray-400 text-xs">
                  Authenticated
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="text-gray-400 hover:text-gray-300"
            >
              <LogOut size={18} />
            </button>
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
        ) : (
          /* Chat Interface */
          <div className="flex-1 flex flex-col">
            <div className="border-b border-gray-700 p-4">
              <h1 className="text-white text-xl font-semibold">Chat with SAM AI</h1>
              <p className="text-gray-400 text-sm">Your intelligent sales assistant</p>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto p-4" ref={chatContainerRef}>
                {showStarterScreen ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <img 
                      src="/SAM.jpg" 
                      alt="Sam AI" 
                      className="w-32 h-32 rounded-full object-cover mb-6"
                      style={{ objectPosition: 'center 30%' }}
                    />
                    <h2 className="text-white text-2xl font-medium mb-4">
                      Welcome to SAM AI! 👋
                    </h2>
                    <p className="text-gray-400 text-lg mb-8 max-w-md">
                      I'm your intelligent sales assistant. Ask me about leads, campaigns, or anything sales-related!
                    </p>
                    <div className="text-left">
                      <p className="text-gray-500 text-sm mb-2">Try asking:</p>
                      <ul className="text-purple-400 text-sm space-y-1">
                        <li>• "Show me today's leads"</li>
                        <li>• "What's my conversion rate?"</li>
                        <li>• "Help me write a follow-up email"</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.role === 'user' 
                            ? 'bg-purple-600 text-white' 
                            : 'bg-gray-700 text-gray-100'
                        }`}>
                          {message.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="border-t border-gray-700 p-4">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ask SAM anything about sales..."
                    className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    disabled={isSending}
                  />
                  <button
                    onClick={() => {}}
                    disabled={isSending || !inputValue.trim()}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}