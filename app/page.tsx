'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { useSamChat } from '@/lib/hooks/useSamChat';
import TrainingRoom from './components/TrainingRoom';
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
  UserPlus,
  LogOut
} from 'lucide-react';

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Sam chat integration
  const { 
    messages, 
    currentConversation, 
    isLoading, 
    isSending, 
    sendMessage, 
    loadConversations,
    error 
  } = useSamChat();

  const [showStarterScreen, setShowStarterScreen] = useState(true);
  const [inputMessage, setInputMessage] = useState('');
  const [activeMenuItem, setActiveMenuItem] = useState('chat');

  // Check user authentication status
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setLoading(false);
    };

    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔍 Supabase Auth Event:', event, session?.user?.id);
        setUser(session?.user || null);
        
        if (session?.user && event === 'SIGNED_IN') {
          console.log('✅ User authenticated with Supabase');
          
          // Create tenant/organization if it doesn't exist
          await createTenantIfNeeded(session.user);
          
          loadConversations();
        } else if (session?.user) {
          loadConversations();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [loadConversations]);

  // Handle sign in
  const handleSignIn = async () => {
    setAuthLoading(true);
    setAuthError('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthError(error.message);
    }
    
    setAuthLoading(false);
  };

  // Handle sign up
  const handleSignUp = async () => {
    setAuthLoading(true);
    setAuthError('');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          company_name: companyName
        }
      }
    });

    if (error) {
      setAuthError(error.message);
    } else {
      setAuthError('Account created successfully! You can now sign in.');
    }
    
    setAuthLoading(false);
  };

  // Handle magic link
  const handleMagicLink = async () => {
    setAuthLoading(true);
    setAuthError('');

    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true
      }
    });

    if (error) {
      setAuthError(error.message);
    } else {
      setAuthError('Check your email for the magic link!');
    }
    
    setAuthLoading(false);
  };

  // Handle password reset
  const handlePasswordReset = async () => {
    setAuthLoading(true);
    setAuthError('');

    const { data, error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      setAuthError(error.message);
    } else {
      setAuthError('Check your email for password reset link!');
    }
    
    setAuthLoading(false);
  };

  // Create tenant/organization if needed
  const createTenantIfNeeded = async (user: any) => {
    if (!user.user_metadata?.company_name) return;

    try {
      // Check if tenant already exists
      const { data: existingTenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('company_name', user.user_metadata.company_name)
        .single();

      if (!existingTenant) {
        // Create new tenant
        const { data: newTenant, error } = await supabase
          .from('tenants')
          .insert({
            name: user.user_metadata.company_name,
            company_name: user.user_metadata.company_name,
            slug: user.user_metadata.company_name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            plan: 'starter',
            status: 'active'
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating tenant:', error);
          return;
        }

        console.log('✅ Created tenant:', newTenant);

        // Create tenant membership
        if (newTenant) {
          const { error: membershipError } = await supabase
            .from('tenant_memberships')
            .insert({
              user_id: user.id,
              tenant_id: newTenant.id,
              role: 'owner'
            });

          if (membershipError) {
            console.error('Error creating tenant membership:', membershipError);
          } else {
            console.log('✅ Created tenant membership');
          }
        }
      }
    } catch (error) {
      console.error('Error in createTenantIfNeeded:', error);
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    const currentUser = user;
    
    // Show goodbye message first
    if (currentUser?.user_metadata?.first_name) {
      setAuthError(`Goodbye ${currentUser.user_metadata.first_name}, see you soon!`);
    } else {
      setAuthError('Goodbye, see you soon!');
    }
    
    // Clear form state immediately
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setCompanyName('');
    setIsSignUp(false);
    setShowMagicLink(false);
    setShowPasswordReset(false);
    setAuthLoading(false);
    
    // Sign out from Supabase
    await supabase.auth.signOut();
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen bg-gray-900 items-center justify-center">
        <div className="text-center">
          <img 
            src="/SAM.jpg" 
            alt="Sam AI" 
            className="w-24 h-24 rounded-full mx-auto mb-4"
          />
          <div className="text-white text-lg mb-2">Loading SAM AI...</div>
          <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  // Not authenticated - show auth form
  if (!user) {
    return (
      <div className="flex h-screen bg-gray-900 items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
          <div className="text-center mb-8">
            <img 
              src="/SAM.jpg" 
              alt="Sam AI" 
              className="w-16 h-16 rounded-full mx-auto mb-4 object-cover"
              style={{ objectPosition: 'center 30%' }}
            />
            <h1 className="text-2xl font-bold text-white mb-2">
              {isSignUp ? 'Join SAM AI' : 'Welcome to SAM AI'}
            </h1>
            <p className="text-gray-400">Your AI-powered Sales Assistant</p>
          </div>

          {showMagicLink ? (
            /* MAGIC LINK FORM */
            <div>
              <form onSubmit={(e) => {
                e.preventDefault();
                handleMagicLink();
              }}>
                <div className="space-y-4">
                  <div>
                    <input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                      required
                    />
                  </div>

                  {authError && (
                    <div className={`text-sm px-4 py-2 rounded ${
                      authError.includes('Check your email') || authError.includes('Goodbye') || authError.includes('Account created successfully')
                        ? 'bg-green-900/50 text-green-300' 
                        : 'bg-red-900/50 text-red-300'
                    }`}>
                      {authError.includes('Goodbye') ? (
                        <div className="flex items-center space-x-3">
                          <img 
                            src="/SAM.jpg" 
                            alt="Sam AI" 
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                            style={{ objectPosition: 'center 30%' }}
                          />
                          <span>{authError}</span>
                        </div>
                      ) : (
                        authError
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white py-3 rounded-lg font-medium transition-colors"
                  >
                    {authLoading ? 'Sending...' : 'Send Magic Link'}
                  </button>
                </div>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowMagicLink(false)}
                  className="text-purple-400 hover:text-purple-300 text-sm"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          ) : showPasswordReset ? (
            /* PASSWORD RESET FORM */
            <div>
              <form onSubmit={(e) => {
                e.preventDefault();
                handlePasswordReset();
              }}>
                <div className="space-y-4">
                  <div>
                    <input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                      required
                    />
                  </div>

                  {authError && (
                    <div className={`text-sm px-4 py-2 rounded ${
                      authError.includes('Check your email') || authError.includes('Goodbye') || authError.includes('Account created successfully')
                        ? 'bg-green-900/50 text-green-300' 
                        : 'bg-red-900/50 text-red-300'
                    }`}>
                      {authError.includes('Goodbye') ? (
                        <div className="flex items-center space-x-3">
                          <img 
                            src="/SAM.jpg" 
                            alt="Sam AI" 
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                            style={{ objectPosition: 'center 30%' }}
                          />
                          <span>{authError}</span>
                        </div>
                      ) : (
                        authError
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white py-3 rounded-lg font-medium transition-colors"
                  >
                    {authLoading ? 'Sending...' : 'Send Password Reset'}
                  </button>
                </div>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowPasswordReset(false)}
                  className="text-purple-400 hover:text-purple-300 text-sm"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          ) : (
            /* REGULAR SIGN IN/UP FORM */
            <div>
              <form onSubmit={(e) => {
                e.preventDefault();
                isSignUp ? handleSignUp() : handleSignIn();
              }}>
                <div className="space-y-4">
                  {isSignUp && (
                    <>
                      <div className="flex space-x-3">
                        <input
                          type="text"
                          placeholder="First Name"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Last Name"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                          required
                        />
                      </div>
                      
                      <div>
                        <input
                          type="text"
                          placeholder="Company Name"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                          required
                        />
                      </div>
                    </>
                  )}
                  
                  <div>
                    <input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                      required
                    />
                  </div>
                  
                  <div>
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                      required
                    />
                  </div>

                  {authError && (
                    <div className={`text-sm px-4 py-2 rounded ${
                      authError.includes('Check your email') || authError.includes('Goodbye') || authError.includes('Account created successfully')
                        ? 'bg-green-900/50 text-green-300' 
                        : 'bg-red-900/50 text-red-300'
                    }`}>
                      {authError.includes('Goodbye') ? (
                        <div className="flex items-center space-x-3">
                          <img 
                            src="/SAM.jpg" 
                            alt="Sam AI" 
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                            style={{ objectPosition: 'center 30%' }}
                          />
                          <span>{authError}</span>
                        </div>
                      ) : (
                        authError
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white py-3 rounded-lg font-medium transition-colors"
                  >
                    {authLoading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
                  </button>
                </div>
              </form>

              <div className="mt-6 space-y-3 text-center">
                <div>
                  <button
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-purple-400 hover:text-purple-300 text-sm"
                  >
                    {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
                  </button>
                </div>
                
                <div className="flex items-center justify-center space-x-4 text-sm">
                  {!isSignUp ? (
                    <>
                      <button
                        onClick={() => setShowPasswordReset(true)}
                        className="text-gray-400 hover:text-purple-300 transition-colors"
                      >
                        Reset Password
                      </button>
                      <span className="text-gray-600">|</span>
                      <button
                        onClick={() => setShowMagicLink(true)}
                        className="text-gray-400 hover:text-purple-300 transition-colors"
                      >
                        Magic Link
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setShowMagicLink(true)}
                      className="text-gray-400 hover:text-purple-300 transition-colors"
                    >
                      Use Magic Link Instead
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const menuItems = [
    { id: 'chat', label: 'Chat with Sam', icon: MessageCircle, active: true },
    { id: 'knowledge', label: 'Knowledge Base', icon: Book, active: false },
    { id: 'training', label: 'Sam Training Room', icon: GraduationCap, active: false },
    { id: 'contact', label: 'Contact Center', icon: Users, active: false },
    { id: 'campaign', label: 'Campaign Hub', icon: Megaphone, active: false },
    { id: 'pipeline', label: 'Lead Pipeline', icon: TrendingUp, active: false },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, active: false }
  ];

  const handleSendMessage = async () => {
    if (inputMessage.trim()) {
      const messageContent = inputMessage.trim();
      setInputMessage('');
      
      if (showStarterScreen) {
        setShowStarterScreen(false);
      }

      await sendMessage(messageContent);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

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
          <button className="w-full flex items-center space-x-3 px-6 py-3 text-gray-400 hover:bg-gray-600 hover:text-gray-300 transition-colors">
            <Settings size={18} />
            <span className="text-sm font-medium">Settings</span>
          </button>
          
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-white text-sm font-medium">
                    {user.user_metadata?.first_name ? 
                      `${user.user_metadata.first_name} ${user.user_metadata.last_name}` : 
                      user.email?.split('@')[0]
                    }
                  </p>
                  <p className="text-gray-400 text-xs">
                    {user.user_metadata?.company_name || user.email}
                  </p>
                </div>
                <button 
                  onClick={handleSignOut}
                  className="ml-3 p-2 text-gray-400 hover:text-white hover:bg-purple-600/20 rounded-lg transition-all duration-200 group" 
                  title="Sign out"
                >
                  <LogOut size={16} className="group-hover:scale-110 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-gray-900">
        {activeMenuItem === 'training' ? (
          <TrainingRoom />
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
            {isLoading && messages.length === 0 && (
              <div className="flex justify-center items-center py-8">
                <div className="text-gray-400">Loading conversation...</div>
              </div>
            )}
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
          </div>
        )}

        {/* CHAT INPUT CONTAINER */}
        {activeMenuItem === 'chat' && (
          <div className="flex-shrink-0 p-6">
            <div className="bg-black text-white px-4 py-3 rounded-t-lg max-w-4xl mx-auto">
              <div className="flex items-center space-x-3">
                <span className="text-sm">
                  {isSending ? 'Processing...' : isLoading ? 'Loading...' : 'Ready'}
                </span>
                <div className="flex space-x-1">
                  <div className={`w-2 h-2 rounded-full ${isSending || isLoading ? 'bg-purple-400 animate-pulse' : 'bg-green-400'}`}></div>
                  <div className={`w-2 h-2 rounded-full ${isSending || isLoading ? 'bg-purple-500 animate-pulse' : 'bg-green-500'}`} style={{animationDelay: '0.2s'}}></div>
                  <div className={`w-2 h-2 rounded-full ${isSending || isLoading ? 'bg-purple-600 animate-pulse' : 'bg-green-600'}`} style={{animationDelay: '0.4s'}}></div>
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {error ? `Error: ${error}` :
                 isSending ? 'Sam is thinking...' : 
                 isLoading ? 'Loading conversation...' : 
                 currentConversation ? `Active: ${currentConversation.title}` :
                 'Connected to Sam AI database'}
              </div>
            </div>
            
            <div className="bg-gray-700 p-4 rounded-b-lg max-w-4xl mx-auto">
              <div className="flex items-end bg-gray-600 rounded-lg px-4 py-2">
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
    </div>
  );
}