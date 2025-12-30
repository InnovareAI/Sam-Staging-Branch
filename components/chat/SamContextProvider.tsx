'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { SamConversationThread, SamThreadMessage, ThreadFilters } from '@/lib/types/sam-chat';

// Types for context data
export interface LeadIntelligence {
    name: string;
    title: string;
    company: string;
    linkedinUrl: string;
    email: string;
    phone?: string;
    crmStatus: string;
    lastContact: string;
    score: number;
}

export interface OnboardingState {
    currentStage: number; // 1-7
    stageName: string;
    progress: number; // 0-100
    tasksCompleted: number;
    totalTasks: number;
}

export interface AIInsight {
    type: 'goal' | 'strategy' | 'gap' | 'suggestion';
    content: string;
    priority?: 'low' | 'medium' | 'high';
    actionLabel?: string;
    actionTab?: 'history' | 'knowledge' | 'stats' | 'strategy' | 'discovery';
}

export interface ContextIntelligence {
    currentGoal: string;
    samStrategy: string;
    insights: AIInsight[];
    suggestedActions: { label: string; value: string; icon?: string }[];
}

interface SamContextType {
    // UI State
    activeTab: 'history' | 'knowledge' | 'stats' | 'strategy' | 'discovery';
    setActiveTab: (tab: 'history' | 'knowledge' | 'stats' | 'strategy' | 'discovery') => void;
    isContextOpen: boolean;
    setIsContextOpen: (isOpen: boolean) => void;

    // Data
    activeLead: LeadIntelligence | null;
    setActiveLead: (lead: LeadIntelligence | null) => void;

    onboardingState: OnboardingState | null;
    updateOnboarding: (data: Partial<OnboardingState>) => void;

    contextData: any | null;
    isLoadingContext: boolean;
    refreshContext: (threadId?: string) => Promise<void>;

    // Chat State
    threads: SamConversationThread[];
    currentThread: SamConversationThread | null;
    messages: SamThreadMessage[];
    isLoadingThreads: boolean;
    isSending: boolean;
    chatError: string | null;

    // Chat Actions
    loadThreads: (filters?: ThreadFilters) => Promise<void>;
    loadMessages: (threadId: string) => Promise<void>;
    createThread: (data: any) => Promise<SamConversationThread | null>;
    sendMessage: (content: string, threadId?: string, attachmentIds?: string[]) => Promise<any>;
    switchToThread: (thread: SamConversationThread) => Promise<void>;
    updateThread: (threadId: string, updates: Partial<SamConversationThread>) => Promise<SamConversationThread | null>;
    archiveThread: (threadId: string) => Promise<SamConversationThread | null>;
    archiveAllThreads: () => Promise<void>;
    deleteThread: (threadId: string) => Promise<boolean>;
    clearAllThreads: () => Promise<boolean>;
    clearChatError: () => void;

    // AI Intelligence
    intelligence: ContextIntelligence;
    processContext: (lastMessage: string, threadType: string) => void;
}

const SamContext = createContext<SamContextType | undefined>(undefined);

export function SamContextProvider({ children }: { children: ReactNode }) {
    const params = useParams();
    const workspaceId = params.workspaceId as string | undefined;

    const [activeTab, setActiveTab] = useState<'history' | 'knowledge' | 'stats' | 'strategy' | 'discovery'>('knowledge');
    const [isContextOpen, setIsContextOpen] = useState(false);
    const [activeLead, setActiveLead] = useState<LeadIntelligence | null>(null);

    const [contextData, setContextData] = useState<any | null>(null);
    const [isLoadingContext, setIsLoadingContext] = useState(false);

    const [onboardingState, setOnboardingState] = useState<OnboardingState>({
        currentStage: 1,
        stageName: "Initial Setup",
        progress: 0,
        tasksCompleted: 0,
        totalTasks: 5
    });

    // Chat State
    const [threads, setThreads] = useState<SamConversationThread[]>([]);
    const [currentThread, setCurrentThread] = useState<SamConversationThread | null>(null);
    const [messages, setMessages] = useState<SamThreadMessage[]>([]);
    const [isLoadingThreads, setIsLoadingThreads] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);

    const [intelligence, setIntelligence] = useState<ContextIntelligence>({
        currentGoal: "Establish Baseline Knowledge",
        samStrategy: "Learn about your product and target personas to optimize outreach.",
        insights: [
            { type: 'gap', content: "Sam needs more details about your pricing to handle objections.", priority: 'high', actionLabel: 'Add Pricing', actionTab: 'knowledge' },
            { type: 'suggestion', content: "Mentioning the recent funding round in your next message could build trust.", priority: 'medium' }
        ],
        suggestedActions: [
            { label: "Update ICP", value: "icp", icon: "Target" },
            { label: "Draft Reply", value: "reply", icon: "PenTool" }
        ]
    });

    const updateOnboarding = (data: Partial<OnboardingState>) => {
        setOnboardingState(prev => ({ ...prev, ...data }));
    };

    const processContext = useCallback((lastMessage: string, threadType: string) => {
        // Simple heuristic for demo/prototype intelligence
        const lowerMessage = lastMessage.toLowerCase();

        if (lowerMessage.includes('price') || lowerMessage.includes('cost')) {
            setActiveTab('knowledge');
            setIntelligence(prev => ({
                ...prev,
                currentGoal: "Pricing Strategy",
                insights: [
                    { type: 'strategy', content: "Sam is analyzing competitor pricing based on your query.", priority: 'medium' },
                    ...prev.insights.filter(i => i.type !== 'strategy')
                ],
                suggestedActions: [
                    { label: "Update Pricing", value: "knowledge", icon: "Brain" },
                    { label: "Competitor Analysis", value: "research_competitors", icon: "Users" }
                ]
            }));
        } else if (lowerMessage.includes('lead') || lowerMessage.includes('prospect') || lowerMessage.includes('find')) {
            setActiveTab('discovery');
            setIntelligence(prev => ({
                ...prev,
                currentGoal: "Lead Discovery",
                samStrategy: "Finding high-intent prospects that match your 'Founder' persona.",
                suggestedActions: [
                    { label: "Refine Search", value: "discovery", icon: "Search" },
                    { label: "Export Leads", value: "export", icon: "Download" }
                ]
            }));
        } else if (lowerMessage.includes('campaign') || lowerMessage.includes('stats') || lowerMessage.includes('performance')) {
            setActiveTab('stats');
            setIntelligence(prev => ({
                ...prev,
                currentGoal: "Performance Optimization",
                samStrategy: "Reviewing your campaign response rates and sentiment analysis.",
                suggestedActions: [
                    { label: "Analyze Pipeline", value: "pipeline", icon: "BarChart3" },
                    { label: "Optimize Messaging", value: "strategy", icon: "Zap" }
                ]
            }));
        } else if (lowerMessage.includes('competitor') || lowerMessage.includes('rival') || lowerMessage.includes('alternative')) {
            setActiveTab('strategy');
            setIntelligence(prev => ({
                ...prev,
                currentGoal: "Competitive Positioning",
                samStrategy: "Differentiating your product against key rivals in the market.",
                suggestedActions: [
                    { label: "Research Rivals", value: "research_competitors", icon: "Users" },
                    { label: "Value Prop Audit", value: "knowledge", icon: "Target" }
                ]
            }));
        } else if (lowerMessage.includes('onboarding') || lowerMessage.includes('setup') || lowerMessage.includes('start')) {
            setIntelligence(prev => ({
                ...prev,
                currentGoal: "Product Setup",
                samStrategy: "Ensuring SAM has the foundational knowledge to act as your agent.",
                suggestedActions: [
                    { label: "Add Documents", value: "knowledge", icon: "FileText" },
                    { label: "Verify ICP", value: "strategy", icon: "Target" }
                ]
            }));
        }
    }, []);

    // --- Chat Methods ---

    const loadThreads = useCallback(async (filters?: ThreadFilters) => {
        try {
            setIsLoadingThreads(true);
            setChatError(null);

            const params = new URLSearchParams();
            if (filters?.thread_type) params.append('type', filters.thread_type);
            if (filters?.status) params.append('status', filters.status);
            if (filters?.priority) params.append('priority', filters.priority);
            if (filters?.search) params.append('search', filters.search);
            if (filters?.tags?.length) params.append('tags', filters.tags.join(','));

            const response = await fetch(`/api/sam/threads?${params}`);

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    setThreads([]);
                    return;
                }
                throw new Error('Failed to load conversation threads');
            }

            const data = await response.json();
            setThreads(data.threads || []);
        } catch (err) {
            console.error('💥 Load threads error:', err);
            setChatError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoadingThreads(false);
        }
    }, []);

    const loadMessages = useCallback(async (threadId: string) => {
        try {
            setIsLoadingThreads(true);
            const response = await fetch(`/api/sam/threads/${threadId}/messages`);

            if (!response.ok) {
                throw new Error('Failed to load thread messages');
            }

            const data = await response.json();
            const fetchedMessages: SamThreadMessage[] = data.messages || [];
            // Keep in chronological order (oldest first)
            const sortedMessages = [...fetchedMessages].sort((a, b) => a.message_order - b.message_order);
            setMessages(sortedMessages);
        } catch (err) {
            setChatError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoadingThreads(false);
        }
    }, []);

    const createThread = useCallback(async (threadData: any) => {
        try {
            setIsLoadingThreads(true);
            const response = await fetch('/api/sam/threads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...threadData,
                    workspace_id: threadData.workspace_id || workspaceId
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Failed to create thread: ${response.status} - ${errorData.error || 'Unknown'}`);
            }

            const data = await response.json();
            const newThread = data.thread;

            if (!newThread || !newThread.id) {
                console.error('❌ No thread data OR missing ID returned from server:', data);
                throw new Error('Invalid thread data returned from server');
            }

            console.log(`✅ Thread created: ${newThread.id}`);
            setThreads(prev => [newThread, ...prev]);
            setCurrentThread(newThread);
            setMessages([]);

            return newThread;
        } catch (err) {
            setChatError(err instanceof Error ? err.message : 'Unknown error');
            return null;
        } finally {
            setIsLoadingThreads(false);
        }
    }, [workspaceId]);

    const sendMessage = useCallback(async (content: string, threadId?: string, attachmentIds?: string[]) => {
        if (!content.trim() && (!attachmentIds || attachmentIds.length === 0)) return null;

        let targetThread = currentThread;
        const targetId = threadId || targetThread?.id;

        if (!targetId) {
            console.log('📝 No active thread, creating one...');
            // Create a general thread if none exists and no ID provided
            const newThread = await createThread({
                title: `Chat - ${new Date().toLocaleDateString()}`,
                thread_type: 'general',
                priority: 'medium',
                sales_methodology: 'meddic'
            });
            if (!newThread) return null;
            return sendMessage(content, newThread.id, attachmentIds);
        }

        try {
            setIsSending(true);
            const response = await fetch(`/api/sam/threads/${targetId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, attachmentIds }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to send message: ${response.status} - ${errorText}`);
            }

            const data = await response.json();

            if (data.userMessage && data.samMessage) {
                setMessages(prev => [...prev, data.userMessage, data.samMessage]);

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

                processContext(data.userMessage.content, targetThread?.thread_type || 'general');
            }

            return data;
        } catch (err) {
            console.error('💥 SendMessage error:', err);
            setChatError(err instanceof Error ? err.message : 'Unknown error');
            return null;
        } finally {
            setIsSending(false);
        }
    }, [currentThread, createThread, processContext]);

    const switchToThread = useCallback(async (thread: SamConversationThread) => {
        setCurrentThread(thread);
        await loadMessages(thread.id);
    }, [loadMessages]);

    const updateThread = useCallback(async (threadId: string, updates: Partial<SamConversationThread>) => {
        try {
            const response = await fetch(`/api/sam/threads/${threadId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            if (!response.ok) throw new Error('Failed to update thread');

            const data = await response.json();
            const updatedThread = data.thread;

            setThreads(prev =>
                prev.map(thread => thread.id === threadId ? updatedThread : thread)
            );

            if (currentThread?.id === threadId) {
                setCurrentThread(updatedThread);
            }

            return updatedThread;
        } catch (err) {
            setChatError(err instanceof Error ? err.message : 'Unknown error');
            return null;
        }
    }, [currentThread]);

    const archiveThread = useCallback(async (threadId: string) => {
        return await updateThread(threadId, { status: 'archived' });
    }, [updateThread]);

    const archiveAllThreads = useCallback(async () => {
        try {
            setIsLoadingThreads(true);
            console.log('📦 Archiving all active threads...');

            const response = await fetch('/api/sam/threads/archive-all', {
                method: 'POST',
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Failed to archive all: ${response.status} - ${errText}`);
            }

            setThreads(prev =>
                prev.map(t => ({ ...t, status: 'archived' }))
            );
            setCurrentThread(null);
            setMessages([]);
        } catch (err) {
            console.error('Failed to archive all threads:', err);
        } finally {
            setIsLoadingThreads(false);
        }
    }, []);

    const deleteThread = useCallback(async (threadId: string) => {
        try {
            const response = await fetch(`/api/sam/threads/${threadId}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete thread');

            setThreads(prev => prev.filter(thread => thread.id !== threadId));

            if (currentThread?.id === threadId) {
                setCurrentThread(null);
                setMessages([]);
            }

            return true;
        } catch (err) {
            setChatError(err instanceof Error ? err.message : 'Unknown error');
            return false;
        }
    }, [currentThread]);

    const clearAllThreads = useCallback(async () => {
        try {
            const response = await fetch('/api/sam/threads/clear-all', {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to clear threads');

            setThreads([]);
            setCurrentThread(null);
            setMessages([]);
            return true;
        } catch (err) {
            setChatError(err instanceof Error ? err.message : 'Unknown error');
            return false;
        }
    }, []);

    const clearChatError = useCallback(() => setChatError(null), []);

    // --- End Chat Methods ---

    const refreshContext = useCallback(async (threadId?: string) => {
        try {
            setIsLoadingContext(true);
            const params = new URLSearchParams();
            if (threadId) params.set('threadId', threadId);
            if (workspaceId) params.set('workspaceId', workspaceId);

            const url = `/api/sam/context${params.toString() ? `?${params.toString()}` : ''}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.success) {
                setContextData(data);
            }
        } catch (error) {
            console.error('Failed to refresh Sam context:', error);
        } finally {
            setIsLoadingContext(false);
        }
    }, [workspaceId]);

    // Initial fetch when workspaceId becomes available
    useEffect(() => {
        if (workspaceId) {
            refreshContext();
            loadThreads();
        }
    }, [workspaceId, refreshContext, loadThreads]);

    return (
        <SamContext.Provider value={{
            activeTab,
            setActiveTab,
            activeLead,
            setActiveLead,
            onboardingState,
            updateOnboarding,
            contextData,
            isLoadingContext,
            refreshContext,
            isContextOpen,
            setIsContextOpen,
            intelligence,
            processContext,

            // Chat
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
            clearChatError
        }}>
            {children}
        </SamContext.Provider>
    );
}

export function useSamContext() {
    const context = useContext(SamContext);
    if (context === undefined) {
        throw new Error('useSamContext must be used within a SamContextProvider');
    }
    return context;
}
