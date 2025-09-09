'use client';

import React, { useState, useEffect } from 'react';
import { useUser, useOrganization, UserButton, SignOutButton } from '@clerk/nextjs';
import { OrganizationSwitcher } from './components/OrganizationSwitcher';
import { InviteUserModal } from './components/InviteUserModal';
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
  X,
  Send,
  Paperclip,
  Building,
  UserPlus,
  LogOut
} from 'lucide-react';

export default function Page() {
  // Check if Clerk is properly configured
  const isClerkConfigured = 
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && 
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== 'your_publishable_key_here';

  const { user, isLoaded: userLoaded } = useUser();
  const { organization } = useOrganization();
  
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
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [activeMenuItem, setActiveMenuItem] = useState('chat');

  // Load conversations when user is authenticated
  useEffect(() => {
    if (userLoaded && user) {
      console.log('🔄 Loading conversations for authenticated user...');
      loadConversations();
    }
  }, [userLoaded, user, loadConversations]);

  // Add timeout for loading state to prevent infinite loading
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadingTimeout(true);
      // Force redirect after timeout
      if (!userLoaded) {
        window.location.href = '/sign-in';
      }
    }, 5000); // Reduced to 5 seconds
    
    return () => clearTimeout(timer);
  }, [userLoaded]);

  // Loading state - wait for authentication (with timeout fallback)
  if (!userLoaded) {
    if (loadingTimeout) {
      // After timeout, show fallback UI or redirect
      window.location.href = '/sign-in';
      return (
        <div className="flex h-screen bg-gray-900 items-center justify-center">
          <div className="text-center">
            <img 
              src="/SAM.jpg" 
              alt="Sam AI" 
              className="w-24 h-24 rounded-full mx-auto mb-4"
            />
            <div className="text-white text-lg mb-2">Redirecting to sign-in...</div>
            <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="mt-4">
              <p className="text-gray-400 text-sm mb-2">Taking longer than expected...</p>
              <button 
                onClick={() => window.location.href = '/sign-in'}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                Continue to Sign In
              </button>
            </div>
          </div>
        </div>
      );
    }
    
    // Normal loading state
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

  // Not authenticated - redirect to sign-in (full page)
  if (!user) {
    window.location.href = '/sign-in';
    return (
      <div className="flex h-screen bg-gray-900 items-center justify-center">
        <div className="text-center">
          <div className="text-white text-lg mb-2">Redirecting to sign-in...</div>
          <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
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
      
      // Hide starter screen when user sends first message
      if (showStarterScreen) {
        setShowStarterScreen(false);
      }

      // Send message to Sam
      await sendMessage(messageContent);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Always show the full interface
  return (
    <AuthenticatedApp 
      user={user}
      organization={organization}
      messages={messages}
      currentConversation={currentConversation}
      isLoading={isLoading}
      isSending={isSending}
      sendMessage={sendMessage}
      error={error}
      showStarterScreen={showStarterScreen}
      inputMessage={inputMessage}
      setInputMessage={setInputMessage}
      activeMenuItem={activeMenuItem}
      setActiveMenuItem={setActiveMenuItem}
      handleSendMessage={handleSendMessage}
      handleKeyPress={handleKeyPress}
      showInviteModal={showInviteModal}
      setShowInviteModal={setShowInviteModal}
      menuItems={menuItems}
    />
  );
}


// Authenticated App Component - The full SAM AI interface
function AuthenticatedApp({ 
  user, 
  organization, 
  messages, 
  currentConversation, 
  isLoading, 
  isSending, 
  error, 
  showStarterScreen, 
  inputMessage, 
  setInputMessage, 
  activeMenuItem, 
  setActiveMenuItem, 
  handleSendMessage, 
  handleKeyPress, 
  showInviteModal, 
  setShowInviteModal, 
  menuItems 
}: any) {
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
            <button className="text-gray-400 hover:text-gray-300 transition-colors">
              <X size={20} />
            </button>
          </div>
          {/* Organization Switcher - Only show if user has organizations */}
          {organization && (
            <div className="mb-4">
              <OrganizationSwitcher />
            </div>
          )}
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
          
          {/* Invite Team Section */}
          <div className="px-3 mt-6">
            <div className="border-t border-gray-600 pt-4">
              <button
                onClick={() => setShowInviteModal(true)}
                className="w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-600 hover:text-gray-300 transition-colors border border-gray-600 hover:border-purple-500"
              >
                <UserPlus size={18} />
                <span>Invite Team</span>
              </button>
            </div>
          </div>
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
                {user ? (
                  <>
                    <UserButton 
                      afterSignOutUrl="/sign-in"
                      appearance={{
                        elements: {
                          avatarBox: "w-8 h-8"
                        }
                      }}
                    />
                    <div>
                      <p className="text-white text-sm font-medium">
                        {user.firstName || user.username || 'User'}
                      </p>
                      {organization && (
                        <p className="text-purple-400 text-xs flex items-center gap-1">
                          <Building size={10} />
                          {organization.name}
                        </p>
                      )}
                      {!organization && (
                        <p className="text-gray-400 text-xs">Personal</p>
                      )}
                    </div>
                    <SignOutButton redirectUrl="/sign-in">
                      <button className="ml-3 p-2 text-gray-400 hover:text-white hover:bg-purple-600/20 rounded-lg transition-all duration-200 group" title="Sign out">
                        <LogOut size={16} className="group-hover:scale-110 transition-transform" />
                      </button>
                    </SignOutButton>
                  </>
                ) : (
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                      <span className="text-gray-300 text-sm">U</span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">Guest User</p>
                      <p className="text-gray-400 text-xs">Demo Mode</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-gray-900">
        {/* Conditional Rendering */}
        {activeMenuItem === 'training' ? (
          <TrainingRoom />
        ) : showStarterScreen ? (
          /* STARTER SCREEN */
          <div className="flex-1 flex flex-col items-center justify-start pt-24 p-6">
            {/* Large Sam Image */}
            <div className="mb-12">
              <img 
                src="/SAM.jpg" 
                alt="Sam AI" 
                className="w-48 h-48 rounded-full object-cover shadow-lg"
                style={{ objectPosition: 'center 30%' }}
              />
            </div>
            
            {/* CTA Text */}
            <div className="text-center">
              <h2 className="text-white text-2xl font-medium">
                What do you want to get done today?
              </h2>
            </div>
          </div>
        ) : (
          /* CHAT MESSAGES - Real Sam conversation */
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
                        {message.confidence_score && (
                          <div className="mt-2 text-xs text-gray-400">
                            Confidence: {Math.round(message.confidence_score * 100)}%
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {message.role === 'user' && (
                    <div className="flex items-center justify-end space-x-2 mb-1">
                      <span className="text-gray-400 text-sm font-medium">You</span>
                    </div>
                  )}
                  {message.role === 'user' && (
                    <div className="bg-gray-800 text-white px-4 py-3 rounded-2xl">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    </div>
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

        {/* CHAT INPUT CONTAINER - Fixed at bottom, only show for chat */}
        {activeMenuItem === 'chat' && (
          <div className="flex-shrink-0 p-6">
            {/* Status Bar - BLACK background */}
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
            
            {/* Input Area - GRAY background, attached below */}
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

      {/* Invite User Modal */}
      <InviteUserModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        workspaceId={organization?.id || user?.id || 'demo-workspace'}
        workspaceName={organization?.name || `${user?.firstName || 'Demo'} Workspace`}
      />
    </div>
  );
}