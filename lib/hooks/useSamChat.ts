import { useState, useEffect, useCallback } from 'react';

export interface SamMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model_used?: string;
  token_count?: number;
  processing_time_ms?: number;
  confidence_score?: number;
  relevance_score?: number;
  message_order: number;
  metadata?: any;
  created_at: string;
}

export interface SamConversation {
  id: string;
  title: string;
  status: string;
  current_discovery_stage?: string;
  discovery_progress?: number;
  last_sam_message?: string;
  last_user_message?: string;
  last_active_at?: string;
  created_at: string;
  updated_at: string;
}

export function useSamChat() {
  const [conversations, setConversations] = useState<SamConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<SamConversation | null>(null);
  const [messages, setMessages] = useState<SamMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null); // Clear any previous errors
      const response = await fetch('/api/sam/threads?status=active');
      
      if (!response.ok) {
        // If unauthorized, don't show error (user not signed in)
        if (response.status === 401 || response.status === 403) {
          console.log('💡 User not authenticated, skipping conversation load');
          setConversations([]);
          return;
        }
        throw new Error('Failed to load conversations');
      }

      const data = await response.json();
      setConversations(data.threads || []);
    } catch (err) {
      console.error('💥 Load conversations error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load messages for a conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/sam/threads/${conversationId}/messages`);
      
      if (!response.ok) {
        throw new Error('Failed to load messages');
      }

      const data = await response.json();
      setMessages(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create new conversation
  const createConversation = useCallback(async (title?: string) => {
    console.log('🆕 Creating conversation with title:', title);
    try {
      setIsLoading(true);
      const response = await fetch('/api/sam/threads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title || `Sales Chat – ${new Date().toLocaleDateString()}`,
          thread_type: 'general',
          priority: 'medium',
          sales_methodology: 'meddic'
        }),
      });

      console.log('📡 Create conversation response:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Create conversation error:', errorText);
        throw new Error(`Failed to create conversation: ${response.status}`);
      }

      const data = await response.json();
      const newConversation = data.thread;
      
      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversation(newConversation);
      setMessages([]);
      
      return newConversation;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Send message
  const sendMessage = useCallback(async (content: string, conversationId?: string) => {
    if (!content.trim()) return null;

    console.log('🚀 Sending message:', content);

    // Use current conversation or create new one
    let targetConversation = currentConversation;
    if (!targetConversation) {
      console.log('📝 Creating new conversation...');
      targetConversation = await createConversation();
      if (!targetConversation) {
        console.error('❌ Failed to create conversation');
        return null;
      }
      console.log('✅ Created conversation:', targetConversation.id);
    }

    const targetId = conversationId || targetConversation.id;
    console.log('💬 Sending to conversation:', targetId);

    try {
      setIsSending(true);
      const response = await fetch(`/api/sam/threads/${targetId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', errorText);
        throw new Error(`Failed to send message: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Message sent successfully:', data);
      
      // Add both user and Sam messages to the conversation
      if (data.userMessage && data.samMessage) {
        console.log('💬 Adding messages to conversation');
        setMessages(prev => [...prev, data.userMessage, data.samMessage]);
        
        // Update conversation in list
        setConversations(prev => 
          prev.map(conv => 
            conv.id === targetId 
              ? {
                  ...conv,
                  last_user_message: data.userMessage.content,
                  last_sam_message: data.samMessage.content,
                  last_active_at: new Date().toISOString()
                }
              : conv
          )
        );
      } else {
        console.warn('⚠️ Missing messages in response:', data);
      }

      return data;
    } catch (err) {
      console.error('💥 SendMessage error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setIsSending(false);
    }
  }, [currentConversation, createConversation]);

  // Switch to a conversation
  const switchToConversation = useCallback(async (conversation: SamConversation) => {
    setCurrentConversation(conversation);
    await loadMessages(conversation.id);
  }, [loadMessages]);

  // Initialize - load conversations on mount only if user is likely authenticated
  // We'll let the parent component decide when to load conversations
  // useEffect(() => {
  //   loadConversations();
  // }, [loadConversations]);

  return {
    conversations,
    currentConversation,
    messages,
    isLoading,
    isSending,
    error,
    loadConversations,
    loadMessages,
    createConversation,
    sendMessage,
    switchToConversation,
    clearError: () => setError(null)
  };
}