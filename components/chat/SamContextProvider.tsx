'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { useParams } from 'next/navigation';

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
        }
    }, []);

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
            processContext
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
