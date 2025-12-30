'use client';

import React, { useState, useEffect } from 'react';
import {
    Users, Brain, BarChart3, Target, Sparkles,
    AlertCircle, Lightbulb, Zap, PenTool, Search,
    FileText, Clock, Archive, Plus, Trash2, Calendar
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useSamThreadedChat } from '@/lib/hooks/useSamThreadedChat';
import { useSamContext } from './SamContextProvider';
import { DiscoveryPanel } from './DiscoveryPanel';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';

export function ContextPanel() {
    const {
        activeTab, setActiveTab,
        activeLead, contextData,
        refreshContext, intelligence, triggerResearch
    } = useSamContext();

    const {
        threads, currentThread, switchToThread,
        archiveThread, archiveAllThreads, deleteThread,
        isLoadingThreads
    } = useSamThreadedChat();

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active');

    const params = useParams();
    const workspaceId = params?.workspaceId as string;

    // Load context on mount
    useEffect(() => {
        refreshContext();
    }, [refreshContext]);

    const filteredThreads = threads.filter(t => {
        const matchesStatus = t.status === statusFilter;
        const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) ||
            (t.prospect_name?.toLowerCase().includes(search.toLowerCase())) ||
            (t.prospect_company?.toLowerCase().includes(search.toLowerCase()));
        return matchesStatus && matchesSearch;
    });

    return (
        <div className="flex flex-col h-full bg-surface-muted/30">
            {/* Tabs Header */}
            <div className="px-4 pt-4 border-b border-white/5">
                <TooltipProvider delayDuration={200}>
                    <div className="w-full flex justify-center gap-3 mb-4">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                        activeTab === 'history'
                                            ? "bg-primary/25 text-primary ring-2 ring-primary/40"
                                            : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                                    )}
                                >
                                    <Clock size={18} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom"><p>History</p></TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setActiveTab('discovery')}
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                        activeTab === 'discovery'
                                            ? "bg-[#A855F7]/25 text-[#D8B4FE] ring-2 ring-[#A855F7]/40"
                                            : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                                    )}
                                >
                                    <Users size={18} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom"><p>Lead Discovery</p></TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setActiveTab('knowledge')}
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                        activeTab === 'knowledge'
                                            ? "bg-[#8B5CF6]/25 text-[#A78BFA] ring-2 ring-[#8B5CF6]/40"
                                            : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                                    )}
                                >
                                    <Brain size={18} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom"><p>AI Knowledge</p></TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setActiveTab('stats')}
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                        activeTab === 'stats'
                                            ? "bg-[#EC4899]/25 text-[#F472B6] ring-2 ring-[#EC4899]/40"
                                            : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                                    )}
                                >
                                    <BarChart3 size={18} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom"><p>Stats</p></TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setActiveTab('strategy')}
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                        activeTab === 'strategy'
                                            ? "bg-[#F59E0B]/25 text-[#FBBF24] ring-2 ring-[#F59E0B]/40"
                                            : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                                    )}
                                >
                                    <Target size={18} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom"><p>ICP Strategy</p></TooltipContent>
                        </Tooltip>
                    </div>
                </TooltipProvider>
            </div>

            {/* Content Area */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-6">
                    {/* Activity Tab */}
                    {activeTab === 'history' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                            <div className="flex flex-col gap-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                                    <Input
                                        placeholder="Search chats..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="pl-9 bg-white/5 border-white/10 h-9 text-xs"
                                    />
                                </div>
                                <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
                                    <button
                                        onClick={() => setStatusFilter('active')}
                                        className={cn("flex-1 py-1 text-[10px] font-bold rounded-md transition-all", statusFilter === 'active' ? "bg-white/10 text-white" : "text-slate-500")}
                                    >Active</button>
                                    <button
                                        onClick={() => setStatusFilter('archived')}
                                        className={cn("flex-1 py-1 text-[10px] font-bold rounded-md transition-all", statusFilter === 'archived' ? "bg-white/10 text-white" : "text-slate-500")}
                                    >Archived</button>
                                </div>
                                <button
                                    onClick={() => archiveAllThreads()}
                                    className="text-[10px] font-bold text-slate-500 hover:text-red-400 flex items-center gap-1 justify-center py-1 transition-colors"
                                >
                                    <Archive size={12} /> Archive All Chats
                                </button>
                            </div>

                            <div className="space-y-2">
                                {filteredThreads.map(thread => (
                                    <button
                                        key={thread.id}
                                        onClick={() => switchToThread(thread)}
                                        className={cn(
                                            "w-full text-left p-3 rounded-xl border transition-all group relative",
                                            currentThread?.id === thread.id
                                                ? "bg-primary/10 border-primary/20 ring-1 ring-primary/20"
                                                : "bg-white/5 border-white/5 hover:border-white/20"
                                        )}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[11px] font-bold text-white truncate max-w-[150px]">{thread.title}</span>
                                            <span className="text-[9px] text-slate-500">{new Date(thread.last_active_at).toLocaleDateString()}</span>
                                        </div>
                                        {thread.prospect_name && (
                                            <div className="text-[9px] text-primary/80 font-bold uppercase tracking-tighter mb-1">
                                                {thread.prospect_name} @ {thread.prospect_company}
                                            </div>
                                        )}
                                        <div className="text-[10px] text-slate-400 line-clamp-1 opacity-70">
                                            {thread.last_sam_message || thread.last_user_message || "No messages yet"}
                                        </div>
                                    </button>
                                ))}
                                {filteredThreads.length === 0 && (
                                    <div className="py-10 text-center text-slate-500">
                                        <Clock size={24} className="mx-auto mb-2 opacity-20" />
                                        <p className="text-xs">No chats found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* AI Intelligence Header - VISIBLE ON OTHER TABS */}
                    {activeTab !== 'history' && (
                        <div className="space-y-4 mb-2">
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border border-white/10 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 opacity-20 transition-opacity group-hover:opacity-40">
                                    <Zap size={40} className="text-primary" />
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles size={16} className="text-primary animate-pulse" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80">AI Command Center</span>
                                </div>
                                <h3 className="text-sm font-semibold text-white mb-1">{intelligence.currentGoal}</h3>
                                <p className="text-xs text-slate-400 leading-relaxed">{intelligence.samStrategy}</p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {intelligence.suggestedActions.map((action, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                if (action.value === 'discovery') setActiveTab('discovery');
                                                if (action.value === 'strategy' || action.value === 'icp') setActiveTab('strategy');
                                                if (action.value === 'knowledge') setActiveTab('knowledge');
                                                if (action.value === 'stats' || action.value === 'pipeline') setActiveTab('stats');
                                                if (action.value === 'research_competitors') triggerResearch('competitors');
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-medium text-slate-300 hover:bg-primary/20 hover:text-white transition-all"
                                        >
                                            <Zap size={10} /> {action.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                {intelligence.insights.map((insight, idx) => (
                                    <div key={idx} className={cn("p-3 rounded-xl border flex gap-3 transition-all", insight.priority === 'high' ? "bg-red-500/10 border-red-500/20" : "bg-white/5 border-white/10")}>
                                        <AlertCircle size={14} className={insight.priority === 'high' ? "text-red-400" : "text-primary"} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] text-slate-300 leading-tight">{insight.content}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Discovery Tab */}
                    {activeTab === 'discovery' && <DiscoveryPanel />}

                    {/* Knowledge Base Tab */}
                    {activeTab === 'knowledge' && (
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold text-white flex items-center gap-2"><Brain size={16} className="text-primary" /> SAM Readiness</h4>
                                    <span className="text-2xl font-bold text-primary">{contextData?.knowledge?.completeness || 0}%</span>
                                </div>
                                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-primary to-purple-400" style={{ width: `${contextData?.knowledge?.completeness || 0}%` }} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Knowledge Categories</h4>
                                <KnowledgeCategory label="Foundation" score={contextData?.knowledge?.categoryScores?.foundation || 0} color="cyan" />
                                <KnowledgeCategory label="GTM Strategy" score={contextData?.knowledge?.categoryScores?.gtm || 0} color="purple" />
                            </div>
                        </div>
                    )}

                    {activeTab === 'stats' && (
                        <div className="text-center py-10 opacity-30">
                            <BarChart3 size={32} className="mx-auto mb-2" />
                            <p className="text-xs">Stats dashboard is updating</p>
                        </div>
                    )}

                    {activeTab === 'strategy' && (
                        <div className="text-center py-10 opacity-30">
                            <Target size={32} className="mx-auto mb-2" />
                            <p className="text-xs">Strategy insights are refining</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

function KnowledgeCategory({ label, score, color }: { label: string, score: number, color: string }) {
    const colorClasses: Record<string, string> = {
        cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
        purple: "bg-purple-500/10 border-purple-500/20 text-purple-400"
    };
    return (
        <div className={cn("p-3 rounded-xl border flex items-center justify-between", colorClasses[color])}>
            <span className="text-xs font-bold">{label}</span>
            <span className="text-xs font-bold">{score}%</span>
        </div>
    );
}
