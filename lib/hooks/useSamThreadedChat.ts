import { useState, useEffect, useCallback } from 'react';

export interface SamThreadMessage {
  id: string;
  thread_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  model_used?: string;
  token_count?: number;
  processing_time_ms?: number;
  confidence_score?: number;
  relevance_score?: number;
  message_order: number;
  has_prospect_intelligence?: boolean;
  prospect_intelligence_data?: any;
  created_at: string;
}

export interface SamConversationThread {
  id: string;
  user_id: string;
  workspace_id?: string;
  organization_id?: string;
  title: string;
  thread_type: 'prospect' | 'campaign' | 'general' | 'linkedin_research' | 'company_analysis';
  status: 'active' | 'archived' | 'completed';

  // Thread context
  prospect_name?: string;
  prospect_company?: string;
  prospect_linkedin_url?: string;
  campaign_name?: string;
  tags?: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  
  // Discovery context
  current_discovery_stage?: string;
  discovery_progress?: number;
  sales_methodology: 'meddic' | 'spin' | 'challenger';
  deal_stage?: string;
  deal_value?: number;
  
  // Activity
  last_sam_message?: string;
  last_user_message?: string;
  message_count: number;
  last_active_at: string;
  created_at: string;
  updated_at: string;
}

export interface ThreadFilters {
  thread_type?: string;
  status?: string;
  priority?: string;
  tags?: string[];
  search?: string;
}

export function useSamThreadedChat() {
  const [threads, setThreads] = useState<SamConversationThread[]>([]);
  const [currentThread, setCurrentThread] = useState<SamConversationThread | null>(null);
  const [messages, setMessages] = useState<SamThreadMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all threads for user
  const loadThreads = useCallback(async (filters?: ThreadFilters) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filters?.thread_type) params.append('type', filters.thread_type);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.priority) params.append('priority', filters.priority);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.tags?.length) params.append('tags', filters.tags.join(','));
      
      const response = await fetch(`/api/sam/threads?${params}`);
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          console.log('💡 User not authenticated, skipping thread load');
          setThreads([]);
          return;
        }
        throw new Error('Failed to load conversation threads');
      }

      const data = await response.json();
      setThreads(data.threads || []);
    } catch (err) {
      console.error('💥 Load threads error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load messages for a specific thread
  const loadMessages = useCallback(async (threadId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/sam/threads/${threadId}/messages`);
      
      if (!response.ok) {
        throw new Error('Failed to load thread messages');
      }

      const data = await response.json();
      const fetchedMessages: SamThreadMessage[] = data.messages || [];
      const sortedMessages = [...fetchedMessages].sort((a, b) => b.message_order - a.message_order);
      setMessages(sortedMessages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create new thread
  const createThread = useCallback(async (threadData: {
    title: string;
    thread_type: SamConversationThread['thread_type'];
    prospect_name?: string;
    prospect_company?: string;
    prospect_linkedin_url?: string;
    campaign_name?: string;
    tags?: string[];
    priority?: SamConversationThread['priority'];
    sales_methodology?: SamConversationThread['sales_methodology'];
  }) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/sam/threads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(threadData),
      });

      if (!response.ok) {
        throw new Error(`Failed to create thread: ${response.status}`);
      }

      const data = await response.json();
      const newThread = data.thread;
      
      setThreads(prev => [newThread, ...prev]);
      setCurrentThread(newThread);
      setMessages([]);
      
      return newThread;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-create LinkedIn research thread
  const createLinkedInThread = useCallback(async (
    linkedinUrl: string,
    prospectName?: string,
    prospectCompany?: string
  ) => {
    const title = prospectName && prospectCompany 
      ? `${prospectName} - ${prospectCompany}`
      : `LinkedIn Research - ${new Date().toLocaleDateString()}`;

    return await createThread({
      title,
      thread_type: 'linkedin_research',
      prospect_name: prospectName,
      prospect_company: prospectCompany,
      prospect_linkedin_url: linkedinUrl,
      tags: ['linkedin', 'prospect-research'],
      priority: 'medium',
      sales_methodology: 'meddic'
    });
  }, [createThread]);

  // Send message to thread
  const sendMessage = useCallback(async (content: string, threadId?: string) => {
    if (!content.trim()) return null;

    let targetThread = currentThread;
    
    // Auto-detect LinkedIn URLs and create appropriate thread
    const linkedInUrlPattern = /https?:\/\/(www\.)?linkedin\.com\/in\/[^\s]+/gi;
    const linkedInUrls = content.match(linkedInUrlPattern);
    
    if (linkedInUrls && !targetThread) {
      console.log('🔗 LinkedIn URL detected, creating research thread...');
      targetThread = await createLinkedInThread(linkedInUrls[0]);
      if (!targetThread) return null;
    }

    // Create general thread if none exists
    if (!targetThread) {
      targetThread = await createThread({
        title: `Chat - ${new Date().toLocaleDateString()}`,
        thread_type: 'general',
        priority: 'medium',
        sales_methodology: 'meddic'
      });
      if (!targetThread) return null;
    }

    const targetId = threadId || targetThread.id;

    try {
      setIsSending(true);
      const response = await fetch(`/api/sam/threads/${targetId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send message: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // Add messages to current thread
      if (data.userMessage && data.samMessage) {
        setMessages(prev => {
          const newMessages: SamThreadMessage[] = [];
          if (data.userMessage) {
            newMessages.push(data.userMessage);
          }
          if (data.samMessage) {
            newMessages.push(data.samMessage);
          }
          return [...newMessages, ...prev];
        });
        
        // Update thread in list
        setThreads(prev => 
          prev.map(thread => 
            thread.id === targetId 
              ? {
                  ...thread,
                  last_user_message: data.userMessage.content,
                  last_sam_message: data.samMessage.content,
                  message_count: thread.message_count + 2,
                  last_active_at: new Date().toISOString()
                }
              : thread
          )
        );
      }

      return data;
    } catch (err) {
      console.error('💥 SendMessage error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setIsSending(false);
    }
  }, [currentThread, createThread, createLinkedInThread]);

  // Switch to a thread
  const switchToThread = useCallback(async (thread: SamConversationThread) => {
    setCurrentThread(thread);
    await loadMessages(thread.id);
  }, [loadMessages]);

  // Update thread metadata
  const updateThread = useCallback(async (threadId: string, updates: Partial<SamConversationThread>) => {
    try {
      const response = await fetch(`/api/sam/threads/${threadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update thread');
      }

      const data = await response.json();
      const updatedThread = data.thread;
      
      setThreads(prev => 
        prev.map(thread => 
          thread.id === threadId ? updatedThread : thread
        )
      );
      
      if (currentThread?.id === threadId) {
        setCurrentThread(updatedThread);
      }
      
      return updatedThread;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [currentThread]);

  // Archive thread
  const archiveThread = useCallback(async (threadId: string) => {
    return await updateThread(threadId, { status: 'archived' });
  }, [updateThread]);

  // Delete thread
  const deleteThread = useCallback(async (threadId: string) => {
    try {
      const response = await fetch(`/api/sam/threads/${threadId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete thread');
      }

      setThreads(prev => prev.filter(thread => thread.id !== threadId));
      
      if (currentThread?.id === threadId) {
        setCurrentThread(null);
        setMessages([]);
      }
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [currentThread]);

  // Get threads grouped by type
  const getThreadsByType = useCallback(() => {
    return threads.reduce((groups, thread) => {
      if (!groups[thread.thread_type]) {
        groups[thread.thread_type] = [];
      }
      groups[thread.thread_type].push(thread);
      return groups;
    }, {} as Record<string, SamConversationThread[]>);
  }, [threads]);

  // Get recent active threads
  const getRecentThreads = useCallback((limit = 10) => {
    return threads
      .filter(thread => thread.status === 'active')
      .sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime())
      .slice(0, limit);
  }, [threads]);

  return {
    // State
    threads,
    currentThread,
    messages,
    isLoading,
    isSending,
    error,
    
    // Actions
    loadThreads,
    loadMessages,
    createThread,
    createLinkedInThread,
    sendMessage,
    switchToThread,
    updateThread,
    archiveThread,
    deleteThread,
    
    // Helpers
    getThreadsByType,
    getRecentThreads,
    clearError: () => setError(null)
  };
}
