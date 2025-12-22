'use client';

import { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { BookOpen, BarChart3, Lightbulb, History, Search, MessageSquare, FileText } from "lucide-react";
import { useSamContext } from './SamContextProvider';
import { useSamThreadedChat } from "@/lib/hooks/useSamThreadedChat";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';

export function ContextPanel() {
    const {
        activeTab,
        setActiveTab,
        activeLead,
        onboardingState,
        contextData,
        refreshContext
    } = useSamContext();

    const { threads, currentThread, switchToThread, loadThreads } = useSamThreadedChat();
    const [search, setSearch] = useState('');

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
                                    onClick={() => setActiveTab('knowledge')}
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                        activeTab === 'knowledge'
                                            ? "bg-[#8B5CF6]/25 text-[#A78BFA] ring-2 ring-[#8B5CF6]/40"
                                            : "bg-[#8B5CF6]/10 text-[#A78BFA]/60 hover:bg-[#8B5CF6]/20 hover:text-[#A78BFA]"
                                    )}
                                >
                                    <BookOpen size={18} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>Knowledge</p>
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
                                    <Lightbulb size={18} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>Strategy</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </TooltipProvider>
            </div>

            {/* Content Area */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-6">
                    {/* History Tab */}
                    {activeTab === 'history' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search conversations..."
                                    className="pl-9 bg-surface/50 border-border/50 h-9 text-sm"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>

                            {/* Thread List */}
                            <div className="space-y-2">
                                {filteredThreads.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground/50 text-sm">
                                        {search ? 'No matching conversations' : 'No conversations yet'}
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
                    {/* Knowledge Base Tab */}
                    {activeTab === 'knowledge' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            {/* Completeness Summary (Small) */}
                            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface/40 border border-border/40">
                                <span className="text-xs text-muted-foreground">Knowledge Health</span>
                                <span className="text-xs font-bold text-[#A78BFA]">{contextData?.knowledge?.completeness || 0}% Complete</span>
                            </div>

                            {/* Products Section */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Products</h4>
                                {contextData?.knowledge?.products?.length > 0 ? (
                                    <div className="space-y-2">
                                        {contextData.knowledge.products.map((p: any) => (
                                            <div key={p.id} className="p-3 rounded-lg bg-[#8B5CF6]/5 border border-[#8B5CF6]/20">
                                                <div className="font-medium text-sm text-[#A78BFA]">{p.name}</div>
                                                {p.description && (
                                                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-xs text-muted-foreground italic px-2">No products found</div>
                                )}
                            </div>

                            {/* Competitors Section */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Competitors</h4>
                                {contextData?.knowledge?.competitors?.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {contextData.knowledge.competitors.map((c: any) => (
                                            <div key={c.id} className="px-3 py-1.5 rounded-md bg-surface border border-border/40 text-xs font-medium">
                                                {c.name}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-xs text-muted-foreground italic px-2">No competitors found</div>
                                )}
                            </div>

                            {/* Recent Documents */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Uploads</h4>
                                {contextData?.knowledge?.documents?.length > 0 ? (
                                    <div className="space-y-1">
                                        {contextData.knowledge.documents.map((d: any) => (
                                            <div key={d.id} className="flex items-center gap-2 p-2 rounded hover:bg-surface-highlight/50 transition-colors cursor-default">
                                                <FileText size={14} className="text-muted-foreground" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs text-foreground truncate">{d.name}</div>
                                                    <div className="text-[10px] text-muted-foreground">{new Date(d.date).toLocaleDateString()}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-xs text-muted-foreground italic px-2">No documents recently uploaded</div>
                                )}
                            </div>

                            {/* Quick Action */}
                            <button
                                onClick={() => window.location.href = '/?tab=knowledge'}
                                className="w-full mt-2 p-2 rounded-lg border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 text-[#A78BFA] text-xs font-medium hover:bg-[#8B5CF6]/20 transition-colors"
                            >
                                Manage Knowledge Base →
                            </button>
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
                                    <div className="text-xs text-muted-foreground mb-1">Replies Received</div>
                                    <div className="text-lg font-semibold">{contextData?.stats?.campaign?.replied || 0}</div>
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
                </div>
            </ScrollArea>

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
            )}
        </div>
    );
}


