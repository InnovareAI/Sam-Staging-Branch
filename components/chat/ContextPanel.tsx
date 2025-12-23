'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Brain, BarChart3, Target, History, Search, MessageSquare, FileText, RefreshCw, Sparkles, PenTool, Zap, AlertCircle, TrendingUp, Users, Lightbulb } from "lucide-react";
import { useSamContext } from './SamContextProvider';
import { useSamThreadedChat } from "@/lib/hooks/useSamThreadedChat";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';
import { DiscoveryPanel } from './DiscoveryPanel';

export function ContextPanel() {
    const {
        activeTab,
        setActiveTab,
        activeLead,
        onboardingState,
        contextData,
        refreshContext,
        intelligence,
        processContext
    } = useSamContext();

    const { threads, currentThread, switchToThread, loadThreads, isLoading } = useSamThreadedChat();
    const [search, setSearch] = useState('');
    const [researchLoading, setResearchLoading] = useState<string | null>(null);
    const [researchResult, setResearchResult] = useState<any>(null);

    const params = useParams();
    const workspaceId = params?.workspaceId as string;

    const triggerResearch = async (analysisType: 'competitors' | 'trends' | 'news') => {
        if (!workspaceId) return;
        setResearchLoading(analysisType);
        setResearchResult(null);
        try {
            const response = await fetch('/api/sam/strategic-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId, analysisType }),
            });
            const data = await response.json();
            if (data.success) {
                setResearchResult({ type: analysisType, data: data.result });
            } else {
                alert('Research failed: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Research error:', error);
            alert('Failed to complete research. Please try again.');
        } finally {
            setResearchLoading(null);
        }
    };

    const [savingToKB, setSavingToKB] = useState(false);

    const saveToKnowledgeBase = async () => {
        if (!workspaceId || !researchResult) return;
        setSavingToKB(true);
        try {
            const response = await fetch('/api/sam/knowledge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId,
                    section: researchResult.type === 'competitors' ? 'competitors' : researchResult.type === 'trends' ? 'go_to_market' : 'industry_news',
                    title: researchResult.type === 'competitors' ? 'AI-Generated Competitor Analysis' : researchResult.type === 'trends' ? 'AI-Generated Market Trends' : 'AI-Generated Industry Insights',
                    content: JSON.stringify(researchResult.data, null, 2),
                    source: 'ai_research',
                }),
            });
            const data = await response.json();
            if (data.success || data.id) {
                alert('✅ Saved to Knowledge Base!');
                setResearchResult(null);
                refreshContext();
            } else {
                alert('Failed to save: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('Failed to save to Knowledge Base.');
        } finally {
            setSavingToKB(false);
        }
    };

    // Load threads and context on mount
    useEffect(() => {
        loadThreads();
        refreshContext();
    }, [loadThreads, refreshContext]);

    // Filter threads by search
    const filteredThreads = threads.filter(t =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.last_sam_message?.toLowerCase().includes(search.toLowerCase()) ||
        t.last_user_message?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-surface-muted/30">
            {/* Tabs Header */}
            <div className="px-4 pt-4 border-b border-border/40">
                <TooltipProvider delayDuration={200}>
                    <div className="w-full flex justify-center gap-3 mb-4">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                        activeTab === 'history'
                                            ? "bg-[#06B6D4]/25 text-[#22D3EE] ring-2 ring-[#06B6D4]/40"
                                            : "bg-[#06B6D4]/10 text-[#22D3EE]/60 hover:bg-[#06B6D4]/20 hover:text-[#22D3EE]"
                                    )}
                                >
                                    <Search size={18} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>Search History</p>
                            </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setActiveTab('discovery')}
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                        activeTab === 'discovery'
                                            ? "bg-[#A855F7]/25 text-[#D8B4FE] ring-2 ring-[#A855F7]/40"
                                            : "bg-[#A855F7]/10 text-[#D8B4FE]/60 hover:bg-[#A855F7]/20 hover:text-[#D8B4FE]"
                                    )}
                                >
                                    <Users size={18} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>Lead Discovery</p>
                            </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setActiveTab('knowledge')}
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                        activeTab === 'knowledge'
                                            ? "bg-[#8B5CF6]/25 text-[#A78BFA] ring-2 ring-[#8B5CF6]/40"
                                            : "bg-[#8B5CF6]/10 text-[#A78BFA]/60 hover:bg-[#8B5CF6]/20 hover:text-[#A78BFA]"
                                    )}
                                >
                                    <Brain size={18} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>AI Knowledge</p>
                            </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setActiveTab('stats')}
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                        activeTab === 'stats'
                                            ? "bg-[#EC4899]/25 text-[#F472B6] ring-2 ring-[#EC4899]/40"
                                            : "bg-[#EC4899]/10 text-[#F472B6]/60 hover:bg-[#EC4899]/20 hover:text-[#F472B6]"
                                    )}
                                >
                                    <BarChart3 size={18} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>Stats</p>
                            </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setActiveTab('strategy')}
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                        activeTab === 'strategy'
                                            ? "bg-[#F59E0B]/25 text-[#FBBF24] ring-2 ring-[#F59E0B]/40"
                                            : "bg-[#F59E0B]/10 text-[#FBBF24]/60 hover:bg-[#F59E0B]/20 hover:text-[#FBBF24]"
                                    )}
                                >
                                    <Target size={18} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>ICP Strategy</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </TooltipProvider>
            </div>

            {/* Content Area */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-6">
                    {/* AI Intelligence Header - ALWAYS VISIBLE */}
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
                            <p className="text-xs text-slate-400 leading-relaxed">
                                {intelligence.samStrategy}
                            </p>

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
                                            if (action.value === 'research_trends') triggerResearch('trends');
                                            if (action.value === 'research_news') triggerResearch('news');
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-medium text-slate-300 hover:bg-primary/20 hover:text-white transition-all"
                                    >
                                        {action.icon === 'Target' && <Target size={12} />}
                                        {action.icon === 'PenTool' && <PenTool size={12} />}
                                        {action.icon === 'Search' && <Search size={12} />}
                                        {action.icon === 'Brain' && <Brain size={12} />}
                                        {action.icon === 'Users' && <Users size={12} />}
                                        {action.icon === 'BarChart3' && <BarChart3 size={12} />}
                                        {action.icon === 'Zap' && <Zap size={12} />}
                                        {action.icon === 'FileText' && <FileText size={12} />}
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Priorities / Gaps */}
                        <div className="space-y-2">
                            {intelligence.insights.map((insight, idx) => (
                                <div key={idx} className={cn(
                                    "p-3 rounded-xl border flex gap-3 transition-all animate-in fade-in slide-in-from-right-2",
                                    insight.priority === 'high'
                                        ? "bg-red-500/10 border-red-500/20"
                                        : "bg-white/5 border-white/10"
                                )}>
                                    <div className="mt-0.5">
                                        {insight.type === 'gap' && <AlertCircle size={14} className="text-red-400" />}
                                        {insight.type === 'suggestion' && <Lightbulb size={14} className="text-amber-400" />}
                                        {insight.type === 'strategy' && <Zap size={14} className="text-primary" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] text-slate-300 leading-tight">
                                            {insight.content}
                                        </p>
                                        {insight.actionLabel && (
                                            <button
                                                onClick={() => insight.actionTab && setActiveTab(insight.actionTab)}
                                                className="mt-1 text-[10px] font-bold text-primary hover:underline"
                                            >
                                                {insight.actionLabel} →
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Separator className="bg-white/5" />
                    {/* History Tab */}
                    {activeTab === 'history' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            {/* Search & Refresh */}
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search conversations..."
                                        className="pl-9 bg-surface/50 border-border/50 h-9 text-sm"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={() => loadThreads()}
                                    disabled={isLoading}
                                    className="h-9 w-9 flex items-center justify-center rounded-md bg-surface/50 border border-border/50 text-muted-foreground hover:bg-surface-highlight hover:text-foreground transition-colors disabled:opacity-50"
                                    title="Refresh History"
                                >
                                    <RefreshCw size={16} className={cn(isLoading && "animate-spin")} />
                                </button>
                            </div>

                            {/* Thread List */}
                            <div className="space-y-2">
                                {isLoading && threads.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground/50 text-sm">
                                        Loading conversations...
                                    </div>
                                ) : filteredThreads.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground/50 text-sm">
                                        {search ? 'No matching conversations' : 'No previous conversations found'}
                                    </div>
                                ) : (
                                    filteredThreads.map((thread) => (
                                        <button
                                            key={thread.id}
                                            onClick={() => switchToThread(thread)}
                                            className={cn(
                                                "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all",
                                                currentThread?.id === thread.id
                                                    ? "bg-[#06B6D4]/15 border border-[#06B6D4]/30"
                                                    : "bg-surface/30 border border-border/30 hover:border-[#06B6D4]/30"
                                            )}
                                        >
                                            <MessageSquare size={14} className={cn(
                                                "mt-0.5 shrink-0",
                                                currentThread?.id === thread.id ? "text-[#22D3EE]" : "text-muted-foreground"
                                            )} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline gap-2">
                                                    <span className={cn(
                                                        "text-sm font-medium truncate",
                                                        currentThread?.id === thread.id ? "text-foreground" : "text-muted-foreground"
                                                    )}>
                                                        {thread.title}
                                                    </span>
                                                    {thread.last_active_at && (
                                                        <span className="text-[9px] text-muted-foreground/40 shrink-0">
                                                            {formatDistanceToNow(new Date(thread.last_active_at), { addSuffix: true })}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-muted-foreground/50 truncate mt-0.5">
                                                    {thread.last_sam_message || thread.last_user_message || "No messages"}
                                                </div>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeLead && (
                        <div className="rounded-xl border border-border/60 bg-surface/30 p-4 space-y-4 shadow-sm">
                            <div className="flex items-start gap-4">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-lg ring-2 ring-white/10">
                                    {activeLead.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-foreground truncate text-lg">{activeLead.name}</h3>
                                    <p className="text-sm text-muted-foreground truncate">{activeLead.title}</p>
                                    <p className="text-xs text-muted-foreground/80 truncate font-medium">@ {activeLead.company}</p>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Knowledge Base Tab - Enhanced Getting Started */}
                    {activeTab === 'knowledge' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            {/* SAM Readiness Header */}
                            <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                                        <Brain size={16} className="text-primary" />
                                        SAM Readiness
                                    </h4>
                                    <span className="text-2xl font-bold text-primary">{contextData?.knowledge?.completeness || 0}%</span>
                                </div>
                                <div className="h-2 w-full bg-surface-highlight rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-primary to-purple-400 rounded-full transition-all duration-500"
                                        style={{ width: `${contextData?.knowledge?.completeness || 0}%` }}
                                    />
                                </div>
                            </div>

                            {/* 4 Category Groups Checklist */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Knowledge Categories</h4>

                                {/* Foundation */}
                                <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-medium text-foreground flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                                            Foundation
                                        </span>
                                        <span className="text-xs text-cyan-400 font-medium">{contextData?.knowledge?.categoryScores?.foundation || 0}%</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground mb-2">Company, Product, Value Prop</div>
                                    <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-cyan-400 rounded-full transition-all" style={{ width: `${contextData?.knowledge?.categoryScores?.foundation || 0}%` }} />
                                    </div>
                                </div>

                                {/* GTM Strategy */}
                                <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-medium text-foreground flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                                            GTM Strategy
                                        </span>
                                        <span className="text-xs text-purple-400 font-medium">{contextData?.knowledge?.categoryScores?.gtm || 0}%</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground mb-2">Competitors, Channels, Pricing</div>
                                    <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-purple-400 rounded-full transition-all" style={{ width: `${contextData?.knowledge?.categoryScores?.gtm || 0}%` }} />
                                    </div>
                                </div>

                                {/* Customer Intelligence */}
                                <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-medium text-foreground flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-400"></div>
                                            Customer Intelligence
                                        </span>
                                        <span className="text-xs text-green-400 font-medium">{contextData?.knowledge?.categoryScores?.customer || 0}%</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground mb-2">Personas, ICPs, Pain Points</div>
                                    <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${contextData?.knowledge?.categoryScores?.customer || 0}%` }} />
                                    </div>
                                </div>

                                {/* Execution Assets */}
                                <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-medium text-foreground flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                                            Execution Assets
                                        </span>
                                        <span className="text-xs text-orange-400 font-medium">{contextData?.knowledge?.categoryScores?.execution || 0}%</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground mb-2">Collateral, Templates, Brand Voice</div>
                                    <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${contextData?.knowledge?.categoryScores?.execution || 0}%` }} />
                                    </div>
                                </div>
                            </div>

                            {/* Teach Sam - Strategic Intelligence */}
                            <div className="space-y-3 pt-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Sparkles size={12} className="text-amber-400" />
                                    Teach Sam
                                </h4>
                                <p className="text-[10px] text-muted-foreground">
                                    Help Sam understand your market context to provide better strategic advice.
                                </p>

                                {/* Research Result Card */}
                                {researchResult && (
                                    <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2 animate-in fade-in">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-amber-400 uppercase">
                                                {researchResult.type === 'competitors' && '🔍 Competitor Analysis'}
                                                {researchResult.type === 'trends' && '📈 Market Trends'}
                                                {researchResult.type === 'news' && '⚡ Industry Insights'}
                                            </span>
                                            <button onClick={() => setResearchResult(null)} className="text-muted-foreground hover:text-foreground">
                                                ✕
                                            </button>
                                        </div>
                                        <pre className="text-[9px] text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto bg-black/20 rounded p-2">
                                            {JSON.stringify(researchResult.data, null, 2)}
                                        </pre>
                                        <button
                                            onClick={saveToKnowledgeBase}
                                            disabled={savingToKB}
                                            className="w-full py-1.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                                        >
                                            {savingToKB ? 'Saving...' : 'Save to Knowledge Base'}
                                        </button>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => triggerResearch('competitors')}
                                        disabled={researchLoading !== null}
                                        className={cn(
                                            "p-3 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400 text-[10px] font-medium hover:bg-purple-500/20 transition-colors flex flex-col items-center gap-1.5",
                                            researchLoading === 'competitors' && "animate-pulse"
                                        )}
                                    >
                                        <Users size={16} />
                                        {researchLoading === 'competitors' ? 'Researching...' : 'Competitors'}
                                    </button>
                                    <button
                                        onClick={() => triggerResearch('trends')}
                                        disabled={researchLoading !== null}
                                        className={cn(
                                            "p-3 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 text-[10px] font-medium hover:bg-green-500/20 transition-colors flex flex-col items-center gap-1.5",
                                            researchLoading === 'trends' && "animate-pulse"
                                        )}
                                    >
                                        <TrendingUp size={16} />
                                        {researchLoading === 'trends' ? 'Researching...' : 'Market Trends'}
                                    </button>
                                    <button
                                        onClick={() => triggerResearch('news')}
                                        disabled={researchLoading !== null}
                                        className={cn(
                                            "p-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-[10px] font-medium hover:bg-cyan-500/20 transition-colors flex flex-col items-center gap-1.5",
                                            researchLoading === 'news' && "animate-pulse"
                                        )}
                                    >
                                        <Zap size={16} />
                                        {researchLoading === 'news' ? 'Researching...' : 'Industry News'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            window.location.href = `/workspace/${workspaceId}/knowledge`;
                                        }}
                                        className="p-3 rounded-lg border border-primary/30 bg-primary/10 text-primary text-[10px] font-medium hover:bg-primary/20 transition-colors flex flex-col items-center gap-1.5"
                                    >
                                        <Brain size={16} />
                                        Full KB
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Campaign Stats Tab */}
                    {activeTab === 'stats' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <div className="p-4 rounded-xl border border-[#EC4899]/30 bg-[#EC4899]/5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-[#F472B6] flex items-center gap-2">
                                        <BarChart3 size={18} /> Campaigns
                                    </h4>
                                    <span className="text-xs text-[#F472B6]/70">
                                        {contextData?.stats?.campaign?.active || 0} active / {contextData?.stats?.campaign?.total || 0} total
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <div className="text-xs text-[#F472B6]/70">Messages Sent</div>
                                        <div className="text-2xl font-bold text-foreground">{contextData?.stats?.campaign?.totalSent || 0}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-xs text-[#F472B6]/70">Response Rate</div>
                                        <div className="text-2xl font-bold text-foreground">{contextData?.stats?.campaign?.responseRate || '0%'}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="p-3 rounded-lg border border-border/40 bg-surface/30">
                                    <div className="text-xs text-muted-foreground mb-1">Meetings Booked</div>
                                    <div className="flex items-center justify-between">
                                        <div className="text-lg font-semibold">{contextData?.stats?.campaign?.meetings || 0}</div>
                                        <div className="h-2 w-24 bg-surface-highlight rounded-full overflow-hidden">
                                            <div className="h-full bg-green-500/60" style={{ width: `${Math.min((contextData?.stats?.campaign?.meetings || 0) * 10, 100)}%` }} />
                                        </div>
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg border border-border/40 bg-surface/30">
                                    <div className="text-xs text-[#F472B6]/70">Replies Received</div>
                                    <div className="text-lg font-semibold">{contextData?.stats?.campaign?.replied || 0}</div>
                                </div>
                                <div className="p-3 rounded-lg border border-border/40 bg-surface/30">
                                    <div className="text-xs text-muted-foreground mb-1 flex items-center justify-between">
                                        Positive Sentiment
                                        <TrendingUp size={12} className="text-green-400" />
                                    </div>
                                    <div className="text-lg font-semibold">82%</div>
                                    <div className="mt-1 flex gap-1 h-1">
                                        {[40, 60, 45, 80, 75, 90, 85].map((h, i) => (
                                            <div key={i} className="flex-1 bg-green-500/40 rounded-t-full" style={{ height: `${h}%` }} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <button
                                onClick={() => window.location.href = '/?tab=campaign'}
                                className="w-full p-3 rounded-lg border border-[#EC4899]/30 bg-[#EC4899]/10 text-[#F472B6] text-sm font-medium hover:bg-[#EC4899]/20 transition-colors"
                            >
                                Open Campaign Hub →
                            </button>
                        </div>
                    )}
                    {/* Strategy Tab */}
                    {activeTab === 'strategy' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <div className="p-4 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/5 space-y-3">
                                <h4 className="font-semibold text-[#FBBF24] flex items-center gap-2">
                                    <Lightbulb size={18} /> Strategic Insight
                                </h4>
                                {contextData?.strategy?.primaryICP ? (
                                    <div className="space-y-3">
                                        <div className="text-base font-medium text-foreground">{contextData.strategy.primaryICP.name}</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {contextData.strategy.primaryICP.industries?.slice(0, 3).map((ind: string) => (
                                                <span key={ind} className="text-[10px] px-2 py-0.5 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[#FBBF24]">{ind}</span>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2">{contextData.strategy.primaryICP.description || 'Targeting this segment for maximum impact based on current market signals.'}</p>
                                    </div>
                                ) : (
                                    <div className="py-4 text-center text-sm text-muted-foreground">
                                        No active strategy identified. Talk to Sam to define your ICP.
                                    </div>
                                )}
                            </div>

                            {currentThread && (
                                <div className="p-4 rounded-xl border border-border/60 bg-surface/30 space-y-3 shadow-sm">
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Conversation Context</h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between py-2 border-b border-border/30 text-sm">
                                            <span className="text-muted-foreground">Focus Area</span>
                                            <span className="font-medium capitalize">{currentThread.thread_type.replace('_', ' ')}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b border-border/30 text-sm">
                                            <span className="text-muted-foreground">Urgency</span>
                                            <span className={cn(
                                                "font-medium capitalize",
                                                currentThread.priority === 'high' ? "text-red-400" :
                                                    currentThread.priority === 'urgent' ? "text-red-500 font-bold" : "text-foreground"
                                            )}>
                                                {currentThread.priority}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Discovery Tab */}
                    {activeTab === 'discovery' && (
                        <DiscoveryPanel />
                    )}
                </div>
            </ScrollArea >

            {onboardingState && (
                <div className="p-4 border-t border-border/40 bg-surface-muted/50">
                    <div className="rounded-xl border border-border/60 bg-surface/30 p-4 space-y-3 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h4 className="text-base font-medium text-foreground">Onboarding Progress</h4>
                            <span className="text-sm text-primary font-bold">
                                Stage {onboardingState.currentStage}/7
                            </span>
                        </div>
                        <div className="h-2.5 w-full bg-surface-highlight rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-1000"
                                style={{ width: `${onboardingState.progress}%` }}
                            />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Current: <strong className="text-foreground">{onboardingState.stageName}</strong>.
                            {onboardingState.currentStage === 3 && " Identifying direct rivals and monitoring targets."}
                        </p>
                    </div>
                </div>
            )
            }
        </div >
    );
}


