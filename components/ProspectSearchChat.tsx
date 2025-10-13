'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Minimize2, MessageCircle } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ProspectSearchChatProps {
  onSearchTriggered?: (jobId: string, criteria: any) => void;
  onProspectsReceived?: (prospects: any[]) => void;
}

export default function ProspectSearchChat({
  onSearchTriggered,
  onProspectsReceived
}: ProspectSearchChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'll help you find prospects. Tell me who you're looking for - like 'CEOs at tech startups in California' or '500 VPs in SaaS companies'.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Subscribe to job progress
  useEffect(() => {
    if (!currentJobId) return;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const subscription = supabase
      .channel('prospect-search-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'prospect_search_jobs',
          filter: `id=eq.${currentJobId}`
        },
        (payload) => {
          const { progress_current, progress_total, status } = payload.new;

          setProgress({
            current: progress_current,
            total: progress_total
          });

          if (status === 'completed') {
            // Fetch results
            fetchResults(currentJobId);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentJobId]);

  const fetchResults = async (jobId: string) => {
    try {
      const response = await fetch(`/api/linkedin/search/results?job_id=${jobId}&page=1&per_page=100`);
      const data = await response.json();

      if (data.success && data.prospects) {
        onProspectsReceived?.(data.prospects);

        addMessage({
          role: 'assistant',
          content: `✅ Found ${data.pagination.total} prospects! They're now displayed in the results panel. Want to refine the search or find more?`
        });

        setProgress(null);
        setCurrentJobId(null);
      }
    } catch (error) {
      console.error('Failed to fetch results:', error);
      addMessage({
        role: 'assistant',
        content: `❌ Sorry, I had trouble fetching the results. Please try again.`
      });
    }
  };

  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date()
    }]);
  };

  const parseSearchIntent = (input: string) => {
    // Simple parsing - can be enhanced with LLM later
    const lowerInput = input.toLowerCase();

    // Extract count
    const countMatch = input.match(/(\d+)\s*(prospects|people|leads|CEOs|VPs|directors|managers)?/i);
    const targetCount = countMatch ? parseInt(countMatch[1]) : 100;

    // Extract role/title
    let title = '';
    if (lowerInput.includes('ceo')) title = 'CEO';
    else if (lowerInput.includes('vp') || lowerInput.includes('vice president')) title = 'VP';
    else if (lowerInput.includes('director')) title = 'Director';
    else if (lowerInput.includes('manager')) title = 'Manager';
    else if (lowerInput.includes('founder')) title = 'Founder';

    // Extract location
    let location = [];
    if (lowerInput.includes('california') || lowerInput.includes('ca')) location.push('103644278');
    else if (lowerInput.includes('new york') || lowerInput.includes('ny')) location.push('105080838');
    else if (lowerInput.includes('texas') || lowerInput.includes('tx')) location.push('102748797');
    else location.push('103644278'); // Default to United States

    // Extract industry/keywords
    const keywords = input.replace(/\d+/g, '').replace(/(ceo|vp|director|manager|founder|in|at)/gi, '').trim();

    return {
      category: 'people',
      title,
      keywords,
      location,
      targetCount
    };
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Add user message
    addMessage({ role: 'user', content: userMessage });

    try {
      // Parse search intent
      const criteria = parseSearchIntent(userMessage);

      // Add thinking message
      addMessage({
        role: 'assistant',
        content: `Got it! Searching for ${criteria.targetCount} ${criteria.title || 'prospects'}${criteria.keywords ? ` in ${criteria.keywords}` : ''}...`
      });

      // Create search job
      const response = await fetch('/api/linkedin/search/create-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search_criteria: criteria,
          search_type: 'linkedin',
          target_count: criteria.targetCount
        })
      });

      const data = await response.json();

      if (data.success) {
        setCurrentJobId(data.job_id);
        onSearchTriggered?.(data.job_id, criteria);

        addMessage({
          role: 'assistant',
          content: `🚀 Search started! This will take about ${Math.ceil(data.metadata.estimated_time_seconds / 60)} minute${data.metadata.estimated_time_seconds > 60 ? 's' : ''}. You'll see results appear in real-time below.`
        });
      } else {
        addMessage({
          role: 'assistant',
          content: `❌ ${data.error || 'Search failed'}. ${data.action === 'connect_linkedin' ? 'Please connect your LinkedIn account in Settings first.' : 'Please try again.'}`
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      addMessage({
        role: 'assistant',
        content: `❌ Sorry, something went wrong. Please try again.`
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

  // Minimized bubble view
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 left-6 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="group relative flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-110"
          title="Expand Prospect Search Chat"
        >
          <img
            src="/SAM.jpg"
            alt="SAM AI"
            className="w-14 h-14 rounded-full object-cover border-2 border-white/20"
            style={{ objectPosition: 'center 30%' }}
          />
          {/* Notification badge if there are new messages or progress */}
          {(progress || isLoading) && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            </div>
          )}
          {/* Tooltip */}
          <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Click to open chat
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
          <h3 className="text-lg font-semibold text-white">Prospect Search</h3>
          <p className="text-sm text-gray-400">Ask me to find prospects - I'll handle the rest</p>
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
                  ? 'bg-purple-600 text-white'
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

        {/* Progress indicator */}
        {progress && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-800 border border-purple-500">
              <p className="text-sm text-gray-100 mb-2">
                ⏳ Searching... {progress.current}/{progress.total} ({Math.round((progress.current / progress.total) * 100)}%)
              </p>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {isLoading && !progress && (
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
            placeholder="e.g., 'Find 500 CEOs at tech startups in California'"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          💡 Try: "Find 100 VPs in SaaS" or "500 CEOs at California tech startups"
        </p>
      </div>
    </div>
  );
}
