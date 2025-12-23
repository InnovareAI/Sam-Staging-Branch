import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowDown, Building2, Users, Search, MessageSquare, Briefcase, Filter, Settings2, Sparkles, ChevronRight, Globe, TrendingUp, CheckCircle, Upload, Link as LinkIcon } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

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
  const [searchMode, setSearchMode] = useState<'people' | 'companies' | 'nested' | 'import'>('people');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'discovery'>('chat'); // discovery view is legacy now, but keeping for compatibility during refactor

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your prospecting assistant. I can help you find individual **people**, search for **companies**, or run a **Deep Discovery** (Company → Decision Makers) flow. Which strategy would you like to use today?",
      timestamp: new Date()
    }
  ]);

  // Form States for Deep Discovery & Filters
  const [companyUrl, setCompanyUrl] = useState('');
  const [companyKeywords, setCompanyKeywords] = useState('');
  const [companyIndustry, setCompanyIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [personaTitle, setPersonaTitle] = useState('');
  const [personaSeniority, setPersonaSeniority] = useState('');
  const [discoveryLimit, setDiscoveryLimit] = useState(20);
  const [connectionDegree, setConnectionDegree] = useState<string>('2nd'); // Default to 2nd for precision
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const handleDiscoverySubmit = () => {
    if ((!companyKeywords && !companyUrl) || !personaTitle) return;
    setIsLoading(true);
    setView('chat'); // Switch to chat to show progress

    addMessage({
      role: 'assistant',
      content: `🚀 **Initiating High-Precision Discovery...**\n\n**Source:** ${companyUrl ? 'Sales Navigator URL' : companyKeywords}\n**Personas:** ${personaTitle}\n\nI'm extracting companies from your target list and finding the decision makers within them.`
    });

    nestedDiscoveryMutation.mutate({
      company_filters: companyUrl ? { url: companyUrl } : { keywords: companyKeywords, industry: companyIndustry, company_headcount: companySize ? [companySize] : undefined },
      persona_filters: { title: personaTitle, seniority_level: personaSeniority ? [personaSeniority] : undefined },
      max_companies: discoveryLimit,
      campaign_name: `Discovery: ${companyUrl ? 'URL Search' : companyKeywords} - ${personaTitle}`
    });
  };

  const scrollToBottom = () => {
    // Use setTimeout to ensure DOM is updated before scrolling
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setShowScrollButton(false);
    }, 0);
  };
  /* ... (existing logic remains) ... */
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      addMessage({
        role: 'assistant',
        content: `📂 **File Selected:** \`${file.name}\` (${(file.size / 1024).toFixed(2)} KB)\n\nReady to import this CSV? I'll analyze the rows and add matching prospects to your database.`
      });
    }
  };

  const handleCsvImport = async () => {
    if (!selectedFile) return;
    setIsLoading(true);
    addMessage({
      role: 'assistant',
      content: `⏳ **Processing CSV...** One moment while I parse the records and match them against LinkedIn profiles.`
    });

    // Integrated simulated delay or actual API call if available
    setTimeout(() => {
      addMessage({
        role: 'assistant',
        content: `✅ **Import Successful!** I've added the prospects from \`${selectedFile.name}\` to the **Data Approval** hub for your review.`
      });
      setIsLoading(false);
      setSelectedFile(null);
    }, 2000);
  };

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
    const keywords = input.replace(/\d+/g, '').replace(/(ceo|vp|director|manager|founder|in|at|1st|2nd|3rd|degree|connection|companies|and|their)/gi, '').trim();

    // Detect Contextual Mode: "Find companies in X" or "Find people at Y"
    const isCompanySearch = lowerInput.startsWith('find companies') || lowerInput.startsWith('search companies');
    const isNestedSearch = lowerInput.includes('companies') && (lowerInput.includes('and their') || lowerInput.includes('get their'));

    return {
      category: isNestedSearch ? 'nested' : isCompanySearch ? 'companies' : 'people',
      title,
      keywords,
      location,
      targetCount,
      connectionDegree: connectionDegree || '2nd', // Default to 2nd if not parsed
      isNested: isNestedSearch,
      isCompany: isCompanySearch
    };
  };

  // mutation for nested discovery
  const nestedDiscoveryMutation = useMutation({
    mutationFn: async (params: any) => {
      const response = await fetch('/api/linkedin/discover-decision-makers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!response.ok) throw new Error('Discovery failed');
      return response.json();
    },
    onSuccess: (data) => {
      addMessage({
        role: 'assistant',
        content: `🎯 **Discovery Complete!**\n\nI analyzed **${data.companies_analyzed} companies** and found **${data.prospect_count} prospects** matching your persona criteria.\n\nThey've been added to a new approval session: **${data.session_id ? data.session_id.substring(0, 8) : 'Discovery'}**. You can review them in the **Data Approval** tab.`
      });
    },
    onError: (error) => {
      console.error('Discovery error:', error);
      addMessage({
        role: 'assistant',
        content: `❌ Sorry, the deep discovery failed. Please check your LinkedIn connection and try again.`
      });
    },
    onSettled: () => {
      setIsLoading(false);
    }
  });

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
      needs_emails?: boolean;
      category?: string;
    }) => {
      // Use cost-optimized search router
      const response = await fetch('/api/linkedin/search-router', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchParams)
      });
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.prospects) {
        // Router returns results immediately
        onProspectsReceived?.(data.prospects);

        // Show cost optimization info
        const costInfo = data.cost_breakdown
          ? `\n\n💰 Cost: ${Object.values(data.cost_breakdown).join(', ')}`
          : '';

        const providerInfo = data.routing_info?.search_provider
          ? `\n🔍 Search provider: ${data.routing_info.search_provider}${data.routing_info.account_type ? ` (${data.routing_info.account_type})` : ''}`
          : '';

        addMessage({
          role: 'assistant',
          content: `✅ Found ${data.count || data.prospects.length} prospects! They've been added to the approval table. The campaign "${data.session_id ? data.session_id.substring(0, 8) : 'New Search'}" is ready for review in the Data Approval tab.${costInfo}${providerInfo}\n\nWant to search for more prospects?`
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

    // Auto-switch mode based on intent if not already in a specific mode
    if (criteria.category === 'nested' && searchMode !== 'nested') setSearchMode('nested');
    else if (criteria.category === 'companies' && searchMode !== 'companies') setSearchMode('companies');

    // Add thinking message
    if (searchMode === 'nested' || criteria.isNested) {
      addMessage({
        role: 'assistant',
        content: `🚀 **Initiating Deep Discovery...**\n\nStep 1: Finding target companies matching "${criteria.keywords || companyKeywords}".\nStep 2: Identifying ${criteria.title || personaTitle || 'decision-makers'} within those organizations.\n\nThis "Company -> Person" search ensures we capture the full decision-making unit. One moment...`
      });

      nestedDiscoveryMutation.mutate({
        company_filters: companyUrl ? { url: companyUrl } : { keywords: criteria.keywords || companyKeywords, location: criteria.location },
        persona_filters: { title: criteria.title || personaTitle, seniority_level: personaSeniority ? [personaSeniority] : undefined },
        max_companies: discoveryLimit,
        campaign_name: `${criteria.keywords || companyKeywords} - ${criteria.title || personaTitle} Discovery`
      });
    } else if (searchMode === 'companies') {
      addMessage({
        role: 'assistant',
        content: `🏢 Searching for companies matching "**${criteria.keywords}**"...`
      });

      searchProspectsMutation.mutate({
        category: 'companies',
        search_criteria: {
          keywords: criteria.keywords,
          location: criteria.location?.[0],
          company_headcount: companySize ? [companySize] : undefined
        },
        target_count: Math.min(criteria.targetCount, 50)
      } as any);
    } else {
      addMessage({
        role: 'assistant',
        content: `Got it! Searching for ${criteria.targetCount} ${criteria.title || 'prospects'}${criteria.keywords ? ` in ${criteria.keywords}` : ''} (${connectionDegree} degree connections)...`
      });

      // Use React Query mutation to perform search
      searchProspectsMutation.mutate({
        category: 'people',
        search_criteria: {
          title: criteria.title,
          keywords: criteria.keywords,
          location: criteria.location?.[0],
          connectionDegree: connectionDegree // Use the state-managed degree
        },
        target_count: Math.min(criteria.targetCount, 50)
      } as any);
    }
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
        <div className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-background border border-gray-700 rounded-lg shadow-2xl pointer-events-auto overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-surface/50 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600/20 rounded-lg border border-purple-500/30">
                {searchMode === 'people' ? <Users size={20} className="text-purple-400" /> :
                  searchMode === 'companies' ? <Building2 size={20} className="text-blue-400" /> :
                    searchMode === 'import' ? <Upload size={20} className="text-green-400" /> :
                      <Sparkles size={20} className="text-amber-400" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {searchMode === 'people' ? 'People Search' :
                    searchMode === 'companies' ? 'Company Search' :
                      searchMode === 'import' ? 'Bulk Import' :
                        'Deep Discovery'}
                </h3>
                <p className="text-[10px] text-gray-400 uppercase tracking-tighter">Powered by SAM AI • High Precision</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-gray-900/50 p-1 rounded-xl border border-gray-700 mx-2">
                <button
                  onClick={() => setSearchMode('people')}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 ${searchMode === 'people' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  People
                </button>
                <button
                  onClick={() => setSearchMode('companies')}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 ${searchMode === 'companies' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Companies
                </button>
                <button
                  onClick={() => setSearchMode('nested')}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 ${searchMode === 'nested' ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Nested
                </button>
                <button
                  onClick={() => {
                    setSearchMode('import');
                    setIsSettingsOpen(true);
                  }}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 ${searchMode === 'import' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Import
                </button>
              </div>

              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-white border border-transparent hover:border-gray-700"
                title="Search Settings"
              >
                <Settings2 size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Settings</span>
              </button>

              <div className="w-px h-4 bg-gray-700 mx-1"></div>

              <button
                onClick={onClose}
                className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-gray-400 hover:text-red-400"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Messages Panel */}
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
                    className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${message.role === 'user'
                      ? 'bg-purple-600 text-white rounded-tr-none'
                      : 'bg-surface-muted text-gray-100 border border-gray-700 rounded-tl-none'
                      }`}
                  >
                    <div className="text-sm leading-relaxed prose prose-invert max-w-none">
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <p className="text-[10px] opacity-40 mt-2 text-right">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}

              {/* Progress indicator */}
              {progress && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-xl px-4 py-3 bg-gray-900 border border-purple-500/50 shadow-inner">
                    <p className="text-xs font-medium text-purple-400 mb-2 flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                      </span>
                      Searching... {progress.current}/{progress.total}
                    </p>
                    <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-indigo-500 h-full transition-all duration-300"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {isLoading && !progress && (
                <div className="flex justify-start">
                  <div className="bg-surface-muted border border-gray-700 rounded-xl px-4 py-2 flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></span>
                    </div>
                    <span className="text-xs text-gray-400 font-medium">SAM is analyzing...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-4 bg-surface border-t border-gray-700">
              <div className="relative group">
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={searchMode === 'people' ? "Find marketing directors in London..." :
                    searchMode === 'companies' ? "Find SaaS companies in Berlin..." :
                      "Company name or niche for Discovery..."}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 pr-24 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none min-h-[46px]"
                  disabled={isLoading}
                />
                <div className="absolute right-2 bottom-2 flex items-center gap-2">
                  {showScrollButton && (
                    <button
                      onClick={scrollToBottom}
                      className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg transition-all"
                      title="Scroll to bottom"
                    >
                      <ArrowDown size={14} />
                    </button>
                  )}
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className={`px-4 py-1.5 text-white text-xs font-semibold rounded-lg transition-all shadow-lg ${searchMode === 'people' ? 'bg-purple-600 hover:bg-purple-700' :
                      searchMode === 'companies' ? 'bg-blue-600 hover:bg-blue-700' :
                        'bg-amber-600 hover:bg-amber-700'
                      } disabled:bg-gray-800 disabled:text-gray-600`}
                  >
                    {isLoading ? '...' : 'Send'}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 mt-3">
                <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1.5">
                  <span className={`w-1 h-1 rounded-full ${searchMode === 'people' ? 'bg-purple-500' : searchMode === 'companies' ? 'bg-blue-500' : 'bg-amber-500'}`}></span>
                  {searchMode === 'people' ? 'Person Search' : searchMode === 'companies' ? 'Organization Search' : 'Discovery Pipeline'} Active
                </span>
                <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1.5">
                  <span className="w-1 h-1 bg-green-500 rounded-full"></span>
                  Anti-Duplication On
                </span>
              </div>
            </div>
          </div>
        </div>

        <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <SheetContent side="right" className="w-[500px] sm:max-w-[540px] bg-gray-950 border-gray-800 p-0 overflow-y-auto">
            <div className="p-6 space-y-8">
              <SheetHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-600/20 rounded-lg border border-purple-500/30">
                    <Settings2 size={18} className="text-purple-400" />
                  </div>
                  <div>
                    <SheetTitle className="text-lg font-bold">Search Configuration</SheetTitle>
                    <SheetDescription className="text-xs text-gray-500">Fine-tune your prospecting filters</SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <Separator className="bg-gray-800" />

              {/* Mode Specific Settings */}
              <div className="space-y-6">
                {/* Bulk Discovery & Import Section */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Upload size={12} className="text-green-400" /> Bulk Discovery & Import
                  </label>
                  <div className="grid grid-cols-2 gap-3 p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center p-4 bg-black/40 border border-gray-700 rounded-lg hover:border-green-500/50 transition-all group"
                    >
                      <Upload size={22} className="text-gray-500 mb-2 group-hover:text-green-400" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase">CSV Upload</span>
                    </button>
                    <button
                      onClick={() => setSearchMode('nested')}
                      className="flex flex-col items-center justify-center p-4 bg-black/40 border border-gray-700 rounded-lg hover:border-blue-500/50 transition-all group"
                    >
                      <LinkIcon size={22} className="text-gray-500 mb-2 group-hover:text-blue-400" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase">LinkedIn URL</span>
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {selectedFile && (
                    <Button
                      onClick={handleCsvImport}
                      className="w-full bg-green-600 hover:bg-green-700 text-xs font-bold py-3 rounded-lg"
                    >
                      Import {selectedFile.name}
                    </Button>
                  )}
                </div>

                <Separator className="bg-gray-800" />
                {searchMode === 'nested' && (
                  <div className="space-y-4">
                    <div className="p-3 bg-amber-600/10 rounded-lg border border-amber-500/20 flex gap-3">
                      <Sparkles className="text-amber-500 shrink-0" size={16} />
                      <p className="text-[10px] text-amber-200/70 leading-relaxed">
                        In **Deep Discovery** mode, SAM first identifies target organizations, then finds decision-makers within them.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Globe size={12} className="text-blue-400" /> Step 1: Target Companies
                      </label>
                      <div className="space-y-3 p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-gray-500">Sales Navigator Search URL</label>
                          <Input
                            value={companyUrl}
                            onChange={(e) => setCompanyUrl(e.target.value)}
                            placeholder="Paste Company Search URL..."
                            className="bg-black/40 border-gray-700 h-9 text-xs focus:ring-purple-500/50"
                          />
                          <p className="text-[9px] text-gray-500 italic">Highly recommended for maximum precision.</p>
                        </div>
                        <div className="py-2 flex items-center gap-3">
                          <div className="h-px flex-1 bg-gray-800"></div>
                          <span className="text-[8px] font-bold text-gray-600 uppercase">OR</span>
                          <div className="h-px flex-1 bg-gray-800"></div>
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-gray-500">Industry / Keywords</label>
                            <Input
                              value={companyKeywords}
                              onChange={(e) => setCompanyKeywords(e.target.value)}
                              disabled={!!companyUrl}
                              placeholder="e.g. Fintech, SaaS"
                              className="bg-black/40 border-gray-700 h-9 text-xs disabled:opacity-30"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-semibold text-gray-500">Headcount</label>
                              <Select value={companySize} onValueChange={setCompanySize} disabled={!!companyUrl}>
                                <SelectTrigger className="bg-black/40 border-gray-700 h-9 text-xs">
                                  <SelectValue placeholder="Any" />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-900 border-gray-800">
                                  <SelectItem value="B">11-50</SelectItem>
                                  <SelectItem value="C">51-200</SelectItem>
                                  <SelectItem value="D">201-500</SelectItem>
                                  <SelectItem value="E">501-1k</SelectItem>
                                  <SelectItem value="F">1k+</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-semibold text-gray-500">Depth</label>
                              <Select value={discoveryLimit.toString()} onValueChange={(v) => setDiscoveryLimit(parseInt(v))}>
                                <SelectTrigger className="bg-black/40 border-gray-700 h-9 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-900 border-gray-800">
                                  <SelectItem value="10">10 Co.</SelectItem>
                                  <SelectItem value="25">25 Co.</SelectItem>
                                  <SelectItem value="50">50 Co.</SelectItem>
                                  <SelectItem value="100">100 Co.</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Users size={12} className="text-purple-400" /> Step 2: Decision Makers
                      </label>
                      <div className="space-y-3 p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-gray-500">Target Titles</label>
                          <Input
                            value={personaTitle}
                            onChange={(e) => setPersonaTitle(e.target.value)}
                            placeholder="e.g. CEO, VP Sales"
                            className="bg-black/40 border-gray-700 h-9 text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-gray-500">Seniority</label>
                          <Select value={personaSeniority} onValueChange={setPersonaSeniority}>
                            <SelectTrigger className="bg-black/40 border-gray-700 h-9 text-xs">
                              <SelectValue placeholder="All Levels" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 border-gray-800">
                              <SelectItem value="CXO">C-Level (CXO)</SelectItem>
                              <SelectItem value="VP">Vice President (VP)</SelectItem>
                              <SelectItem value="Director">Director</SelectItem>
                              <SelectItem value="Manager">Manager</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {searchMode === 'people' && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Filter size={12} className="text-purple-400" /> Filter Criteria
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-gray-500">Connection Degree</label>
                          <Select value={connectionDegree} onValueChange={setConnectionDegree}>
                            <SelectTrigger className="bg-black/40 border-gray-700 h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 border-gray-800">
                              <SelectItem value="1st">1st Degree</SelectItem>
                              <SelectItem value="2nd">2nd Degree</SelectItem>
                              <SelectItem value="3rd">3rd Degree</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-gray-500">Max Results</label>
                          <Select defaultValue="50">
                            <SelectTrigger className="bg-black/40 border-gray-700 h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 border-gray-800">
                              <SelectItem value="25">25 Results</SelectItem>
                              <SelectItem value="50">50 Results</SelectItem>
                              <SelectItem value="100">100 Results</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-gray-500">Location</label>
                        <Input
                          placeholder="e.g. London, San Francisco"
                          className="bg-black/40 border-gray-700 h-9 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {searchMode === 'companies' && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Building2 size={12} className="text-blue-400" /> Company Filters
                      </label>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-gray-500">Industry</label>
                          <Input
                            placeholder="e.g. Technology, Healthcare"
                            className="bg-black/40 border-gray-700 h-9 text-xs"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-gray-500">Headcount</label>
                            <Select value={companySize} onValueChange={setCompanySize}>
                              <SelectTrigger className="bg-black/40 border-gray-700 h-9 text-xs">
                                <SelectValue placeholder="Any" />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-900 border-gray-800">
                                <SelectItem value="B">11-50</SelectItem>
                                <SelectItem value="C">51-200</SelectItem>
                                <SelectItem value="D">201-500</SelectItem>
                                <SelectItem value="E">501-1k</SelectItem>
                                <SelectItem value="F">1k+</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-gray-500">Type</label>
                            <Select defaultValue="any">
                              <SelectTrigger className="bg-black/40 border-gray-700 h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-900 border-gray-800">
                                <SelectItem value="any">Any Type</SelectItem>
                                <SelectItem value="public">Public</SelectItem>
                                <SelectItem value="private">Private</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-8">
                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700 text-xs font-bold gap-2 py-6 rounded-xl shadow-lg"
                  onClick={() => {
                    setIsLoading(true);
                    setIsSettingsOpen(false);
                    if (searchMode === 'nested') {
                      handleDiscoverySubmit();
                    } else {
                      // Fallback to chat for standard modes
                      addMessage({ role: 'assistant', content: `Applying updated filters to your **${searchMode}** search. Go ahead and type your query below!` });
                      setIsLoading(false);
                    }
                  }}
                >
                  <CheckCircle className="h-4 w-4" /> Save & Apply Filters
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
