'use client';

import React, { useState, useEffect, useRef } from 'react';
import TrainingRoom from './components/TrainingRoom';
import KnowledgeBase from './components/KnowledgeBase';
import ContactCenter from './components/ContactCenter';
import CampaignHub from './components/CampaignHub';
import LeadPipeline from './components/LeadPipeline';
import Analytics from './components/Analytics';
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
  Paperclip
} from 'lucide-react';

export default function Page() {
  // No authentication - direct app access
  const [showStarterScreen, setShowStarterScreen] = useState(true);
  const [inputMessage, setInputMessage] = useState('');
  const [activeMenuItem, setActiveMenuItem] = useState('chat');
  const [messages, setMessages] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const menuItems = [
    { id: 'chat', label: 'Chat with Sam', icon: MessageCircle, active: true },
    { id: 'knowledge', label: 'Knowledge Base', icon: Book, active: false },
    { id: 'training', label: 'Sam Training Room', icon: GraduationCap, active: false },
    { id: 'contact', label: 'Contact Center', icon: Users, active: false },
    { id: 'campaign', label: 'Campaign Hub', icon: Megaphone, active: false },
    { id: 'pipeline', label: 'Lead Pipeline', icon: TrendingUp, active: false },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, active: false }
  ];

  // Auto-scroll to bottom when messages change or when sending
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // Simple message handler without authentication
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
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">A</span>
              </div>
              <div>
                <p className="text-white text-sm font-medium">Anonymous User</p>
                <p className="text-gray-400 text-xs">No Authentication</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-gray-900">
        {activeMenuItem === 'training' ? (
          <TrainingRoom />
        ) : activeMenuItem === 'knowledge' ? (
          <KnowledgeBase />
        ) : activeMenuItem === 'contact' ? (
          <ContactCenter />
        ) : activeMenuItem === 'campaign' ? (
          <CampaignHub />
        ) : activeMenuItem === 'pipeline' ? (
          <LeadPipeline />
        ) : activeMenuItem === 'analytics' ? (
          <Analytics />
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