import { useCallback } from 'react';
import { useSamContext } from '@/components/chat/SamContextProvider';
import { SamConversationThread, SamThreadMessage, ThreadFilters } from '@/lib/types/sam-chat';

export type { SamConversationThread, SamThreadMessage, SamAttachment } from '@/lib/types/sam-chat';

export function useSamThreadedChat() {
  const {
    threads,
    currentThread,
    messages,
    isLoadingThreads,
    isSending,
    chatError,
    loadThreads,
    loadMessages,
    createThread,
    sendMessage,
    switchToThread,
    updateThread,
    archiveThread,
    archiveAllThreads,
    deleteThread,
    clearAllThreads,
    clearChatError,
    processContext
  } = useSamContext();

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
      priority: 'medium'
    });
  }, [createThread]);

  // Special version of sendMessage that handles LinkedIn-specific logic
  const sendChatMessage = useCallback(async (content: string, threadId?: string, attachmentIds?: string[]) => {
    if (!content.trim() && (!attachmentIds || attachmentIds.length === 0)) return null;

    let targetThread = currentThread;

    // Auto-detect LinkedIn URLs and create appropriate thread
    const linkedInUrlPattern = /https?:\/\/(www\.)?linkedin\.com\/in\/[^\s]+/gi;
    const linkedInUrls = content.match(linkedInUrlPattern);

    if (linkedInUrls && !targetThread) {
      console.log('🔗 LinkedIn URL detected, creating research thread...');
      targetThread = await createLinkedInThread(linkedInUrls[0]);
      if (!targetThread) return null;
    }

    return sendMessage(content, threadId || targetThread?.id, attachmentIds);
  }, [currentThread, createLinkedInThread, sendMessage]);

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
    isLoading: isLoadingThreads,
    isSending,
    error: chatError,

    // Actions
    loadThreads,
    loadMessages,
    createThread,
    createLinkedInThread,
    sendMessage: sendChatMessage,
    switchToThread,
    updateThread,
    archiveThread,
    archiveAllThreads,
    deleteThread,
    clearAllThreads,

    // Helpers
    getThreadsByType,
    getRecentThreads,
    clearError: clearChatError
  };
}
