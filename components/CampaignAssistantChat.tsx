'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Minimize2, Send } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface CampaignAssistantChatProps {
  isMinimized?: boolean;
  onMinimizeChange?: (minimized: boolean) => void;
  onCampaignCreated?: (campaign: any) => void;
}

export default function CampaignAssistantChat({
  isMinimized: externalIsMinimized,
  onMinimizeChange,
  onCampaignCreated
}: CampaignAssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "You don't need to jump back to the main window. Just chat with me here about your campaigns, messaging sequences, or strategy. You can minimize me for a distraction free experience.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [internalIsMinimized, setInternalIsMinimized] = useState(() => {
    // Load minimized state from localStorage (sticky across reloads)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('campaign_assistant_minimized')
      return saved === 'true'
    }
    return false
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use external state if provided, otherwise use internal state
  const isMinimized = externalIsMinimized !== undefined ? externalIsMinimized : internalIsMinimized;
  const setIsMinimized = (value: boolean) => {
    // Save to localStorage (sticky across reloads)
    if (typeof window !== 'undefined') {
      localStorage.setItem('campaign_assistant_minimized', value.toString())
    }

    if (onMinimizeChange) {
      onMinimizeChange(value);
    } else {
      setInternalIsMinimized(value);
    }
  };

  const scrollToBottom = () => {
    // Use setTimeout to ensure DOM is updated before scrolling
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, 0);
  };

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-scroll on initial mount (when chat opens)
  useEffect(() => {
    scrollToBottom();
  }, []);

  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    addMessage({ role: 'user', content: userMessage });
    setIsLoading(true);

    try {
      // TODO: Call SAM AI API for campaign assistance
      // For now, provide helpful responses based on keywords

      const lowerInput = userMessage.toLowerCase();
      let response = '';

      if (lowerInput.includes('message') || lowerInput.includes('sequence') || lowerInput.includes('write')) {
        response = "I'll help you craft compelling messages! Here's what I need to know:\n\n1. What's your target audience? (e.g., 'CTOs at SaaS companies')\n2. What's your value proposition?\n3. What's your call-to-action?\n4. Any specific tone? (Professional, casual, friendly)\n\nShare these details and I'll draft a multi-touch sequence for you.";
      } else if (lowerInput.includes('campaign') || lowerInput.includes('create') || lowerInput.includes('setup')) {
        response = "Great! Let's set up your campaign. I'll guide you through:\n\n✅ Channel Selection (LinkedIn, Email, or Multi-Channel)\n✅ Sequence Design (How many touchpoints?)\n✅ Timing & Cadence (When to send each message)\n✅ HITL Approval Setup\n\nWhat type of campaign are you thinking? LinkedIn outreach, email nurture, or both?";
      } else if (lowerInput.includes('linkedin')) {
        response = "Perfect! LinkedIn campaigns are highly effective for B2B outreach.\n\n📊 Best Practices:\n• Connection requests with personalized notes\n• Follow-up messages 2-3 days after connecting\n• Value-first approach (no hard sell immediately)\n• 3-5 touchpoints over 2-3 weeks\n\n🎯 What's your target outcome?\n- Build connections?\n- Book meetings?\n- Generate leads?";
      } else if (lowerInput.includes('email')) {
        response = "Email campaigns complement LinkedIn beautifully!\n\n📧 Effective Email Strategy:\n• Subject line: Keep it under 50 chars\n• Body: 100-150 words max\n• Clear CTA (single ask)\n• 3-4 follow-ups over 2 weeks\n\n💡 Want me to draft a sample sequence for your use case?";
      } else if (lowerInput.includes('help') || lowerInput.includes('what can you')) {
        response = "I can assist you with:\n\n📝 Message Drafting - Personalized outreach copy\n🎯 Campaign Strategy - Multi-touch sequences\n📊 Channel Mix - LinkedIn + Email optimization\n⏰ Timing - When to send each touchpoint\n✅ HITL Setup - Approval workflows\n📈 Best Practices - Proven tactics that work\n\nWhat aspect would you like help with first?";
      } else {
        response = "I'm here to help you create effective campaigns! You can ask me about:\n\n• Writing LinkedIn connection requests\n• Drafting email sequences\n• Setting up multi-channel campaigns\n• Optimizing timing and cadence\n• HITL approval workflows\n\nWhat would you like to work on?";
      }

      // Simulate AI thinking delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      addMessage({
        role: 'assistant',
        content: response
      });

    } catch (error) {
      console.error('Campaign assistant error:', error);
      addMessage({
        role: 'assistant',
        content: "I apologize, but I encountered an error. Please try again or rephrase your question."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 left-6 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="relative group w-16 h-16 rounded-full transition-transform hover:scale-110 active:scale-95"
        >
          {/* Animated border ring */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 animate-pulse" />
          <div className="absolute inset-[2px] rounded-full bg-gray-900" />

          {/* SAM image */}
          <img
            src="/SAM.jpg"
            alt="SAM AI"
            className="relative w-14 h-14 rounded-full object-cover z-10"
            style={{ objectPosition: 'center 30%' }}
          />

          {/* Tooltip */}
          <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Campaign Assistant
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-700 rounded-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Campaign Assistant</h3>
          <p className="text-sm text-gray-400">I'll help you create compelling campaigns</p>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
          title="Minimize chat"
        >
          <Minimize2 size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-100 border border-gray-700'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p className="text-xs opacity-60 mt-1">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2">
              <p className="text-sm text-gray-400">Thinking...</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., 'Help me write a LinkedIn sequence for CTOs'"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          💡 Ask me to draft messages, set up sequences, or optimize your campaign strategy
        </p>
      </div>
    </div>
  );
}
