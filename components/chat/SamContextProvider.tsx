'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

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

interface SamContextType {
    // UI State
    activeTab: string;
    setActiveTab: (tab: string) => void;

    // Data
    activeLead: LeadIntelligence | null;
    setActiveLead: (lead: LeadIntelligence | null) => void;

    onboardingState: OnboardingState | null;
    updateOnboarding: (data: Partial<OnboardingState>) => void;

    contextData: any | null;
    isLoadingContext: boolean;
    refreshContext: (threadId?: string) => Promise<void>;
}

const SamContext = createContext<SamContextType | undefined>(undefined);

export function SamContextProvider({ children }: { children: ReactNode }) {
    const [activeTab, setActiveTab] = useState('knowledge');
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

    const updateOnboarding = (data: Partial<OnboardingState>) => {
        setOnboardingState(prev => ({ ...prev, ...data }));
    };

    const refreshContext = async (threadId?: string) => {
        try {
            setIsLoadingContext(true);
            const url = threadId ? `/api/sam/context?threadId=${threadId}` : '/api/sam/context';
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
    };

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
            refreshContext
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
