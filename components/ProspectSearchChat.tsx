'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { X, ArrowDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ProspectSearchChatProps {
  onSearchTriggered?: (jobId: string, criteria: any) => void;
  onProspectsReceived?: (prospects: any[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProspectSearchChat({
  onSearchTriggered,
  onProspectsReceived,
  isOpen,
  onClose
}: ProspectSearchChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "You don't need to jump back to the main window. Just chat with me here about your current search, updates, or new searches. You can close me for a distraction free experience.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const scrollToBottom = () => {
    // Use setTimeout to ensure DOM is updated before scrolling
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setShowScrollButton(false);
    }, 0);
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    setShowScrollButton(!isAtBottom);
  };

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-scroll when progress updates
  useEffect(() => {
    if (progress) {
      scrollToBottom();
    }
  }, [progress]);

  // Auto-scroll when modal opens
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen]);

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

  // REACT QUERY: Mutation for fetching prospect search results
  const fetchResultsMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await fetch(`/api/linkedin/search/results?job_id=${jobId}&page=1&per_page=100`);
      if (!response.ok) throw new Error('Failed to fetch results');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.prospects) {
        onProspectsReceived?.(data.prospects);

        addMessage({
          role: 'assistant',
          content: `✅ Found ${data.pagination.total} prospects! They're now displayed in the results panel. Want to refine the search or find more?`
        });

        setProgress(null);
        setCurrentJobId(null);
      }
    },
    onError: (error) => {
      console.error('Failed to fetch results:', error);
      addMessage({
        role: 'assistant',
        content: `❌ Sorry, I had trouble fetching the results. Please try again.`
      });
    }
  });

  const fetchResults = (jobId: string) => {
    fetchResultsMutation.mutate(jobId);
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

    // Extract connection degree - REQUIRED, must clarify if not specified
    let connectionDegree: string | null = null;
    if (lowerInput.includes('1st degree') || lowerInput.includes('first degree') ||
        lowerInput.includes('1st connection') || lowerInput.includes('first connection') ||
        lowerInput.includes('my connections') || lowerInput.includes('direct connection')) {
      connectionDegree = '1st';
    } else if (lowerInput.includes('2nd degree') || lowerInput.includes('second degree') ||
               lowerInput.includes('2nd connection') || lowerInput.includes('second connection')) {
      connectionDegree = '2nd';
    } else if (lowerInput.includes('3rd degree') || lowerInput.includes('third degree') ||
               lowerInput.includes('3rd connection') || lowerInput.includes('third connection')) {
      connectionDegree = '3rd';
    }

    // Extract industry/keywords
    const keywords = input.replace(/\d+/g, '').replace(/(ceo|vp|director|manager|founder|in|at|1st|2nd|3rd|degree|connection)/gi, '').trim();

    return {
      category: 'people',
      title,
      keywords,
      location,
      targetCount,
      connectionDegree
    };
  };

  // REACT QUERY: Mutation for performing prospect search
  const searchProspectsMutation = useMutation({
    mutationFn: async (searchParams: {
      search_criteria: {
        title: string;
        keywords: string;
        location?: string;
        connectionDegree: string;
      };
      target_count: number;
    }) => {
      const response = await fetch('/api/linkedin/search/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchParams)
      });
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.prospects) {
        // Simple endpoint returns results immediately
        onProspectsReceived?.(data.prospects);

        addMessage({
          role: 'assistant',
          content: `✅ Found ${data.count} prospects! They've been added to the approval table. The campaign "${data.session_id ? data.session_id.substring(0, 8) : 'New Search'}" is ready for review in the Data Approval tab.\n\nWant to search for more prospects?`
        });
      } else {
        addMessage({
          role: 'assistant',
          content: `❌ ${data.error || 'Search failed'}. ${data.error?.includes('Authentication') || data.error?.includes('LinkedIn not connected') ? 'Please make sure you\'re logged in and LinkedIn is connected in Settings.' : 'Please try again.'}`
        });
      }
    },
    onError: (error) => {
      console.error('Search error:', error);
      addMessage({
        role: 'assistant',
        content: `❌ Sorry, something went wrong. Please try again.`
      });
    },
    onSettled: () => {
      setIsLoading(false);
    }
  });

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Add user message
    addMessage({ role: 'user', content: userMessage });

    // Parse search intent
    const criteria = parseSearchIntent(userMessage);

    // CRITICAL: Always require connection degree clarification
    if (!criteria.connectionDegree) {
      addMessage({
        role: 'assistant',
        content: `Before I search, I need to know: Which connection degree do you want to target?\n\n**1st degree** - Your direct connections\n**2nd degree** - Friends of friends (most common)\n**3rd degree** - Extended network\n\nPlease specify "1st", "2nd", or "3rd" degree connections.`
      });
      setIsLoading(false);
      return;
    }

    // Add thinking message
    addMessage({
      role: 'assistant',
      content: `Got it! Searching for ${criteria.targetCount} ${criteria.title || 'prospects'}${criteria.keywords ? ` in ${criteria.keywords}` : ''} (${criteria.connectionDegree} degree connections)...`
    });

    // Use React Query mutation to perform search
    searchProspectsMutation.mutate({
      search_criteria: {
        title: criteria.title,
        keywords: criteria.keywords,
        location: criteria.location?.[0], // Simple endpoint takes single location
        connectionDegree: criteria.connectionDegree // Use parsed connection degree from user input
      },
      target_count: Math.min(criteria.targetCount, 50) // Simple endpoint limited to 50
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
        <div className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-gray-900 border border-gray-700 rounded-lg shadow-2xl pointer-events-auto">
          {/* Header */}
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Prospecting Assistant</h3>
              <p className="text-sm text-gray-400">Ask me to find or refine prospects - I'll handle the rest</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 space-y-4 relative"
          >
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

            {/* Scroll to Bottom Button */}
            {showScrollButton && (
              <button
                onClick={scrollToBottom}
                className="sticky bottom-4 left-1/2 transform -translate-x-1/2 bg-purple-600 hover:bg-purple-700 text-white rounded-full p-3 shadow-lg transition-all z-10 animate-bounce"
                title="Scroll to bottom"
              >
                <ArrowDown size={20} />
              </button>
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
      </div>
    </>
  );
}
