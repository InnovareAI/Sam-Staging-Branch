'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, BarChart3, Lightbulb } from "lucide-react";
import { useSamContext } from './SamContextProvider';
import { useSamThreadedChat } from "@/lib/hooks/useSamThreadedChat";
import { cn } from "@/lib/utils";

export function ContextPanel() {
    const {
        activeTab,
        setActiveTab,
        activeLead,
        onboardingState,
        contextData,
        refreshContext
    } = useSamContext();

    const { currentThread } = useSamThreadedChat();

    return (
        <div className="flex flex-col h-full bg-surface-muted/30">
            {/* Tabs Header */}
            <div className="px-4 pt-4 border-b border-border/40">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TooltipProvider delayDuration={200}>
                        <div className="w-full flex justify-center gap-4 mb-4">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => setActiveTab('knowledge')}
                                        className={cn(
                                            "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                                            activeTab === 'knowledge'
                                                ? "bg-[#8B5CF6]/25 text-[#A78BFA] ring-2 ring-[#8B5CF6]/40"
                                                : "bg-[#8B5CF6]/10 text-[#A78BFA]/60 hover:bg-[#8B5CF6]/20 hover:text-[#A78BFA]"
                                        )}
                                    >
                                        <BookOpen size={22} />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    <p>Knowledge Base</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => setActiveTab('stats')}
                                        className={cn(
                                            "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                                            activeTab === 'stats'
                                                ? "bg-[#EC4899]/25 text-[#F472B6] ring-2 ring-[#EC4899]/40"
                                                : "bg-[#EC4899]/10 text-[#F472B6]/60 hover:bg-[#EC4899]/20 hover:text-[#F472B6]"
                                        )}
                                    >
                                        <BarChart3 size={22} />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    <p>Campaign Stats</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => setActiveTab('strategy')}
                                        className={cn(
                                            "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                                            activeTab === 'strategy'
                                                ? "bg-[#F59E0B]/25 text-[#FBBF24] ring-2 ring-[#F59E0B]/40"
                                                : "bg-[#F59E0B]/10 text-[#FBBF24]/60 hover:bg-[#F59E0B]/20 hover:text-[#FBBF24]"
                                        )}
                                    >
                                        <Lightbulb size={22} />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    <p>Strategy Advisor</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </TooltipProvider>
                </Tabs>
            </div>

            {/* Content Area */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-6">

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
                            <div className="p-4 rounded-xl border border-[#8B5CF6]/30 bg-[#8B5CF6]/5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-[#A78BFA] flex items-center gap-2">
                                        <BookOpen size={18} /> Knowledge Completeness
                                    </h4>
                                    <span className="text-xl font-bold text-[#A78BFA]">{contextData?.knowledge?.completeness || 0}%</span>
                                </div>
                                <div className="h-2 w-full bg-[#8B5CF6]/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[#8B5CF6] transition-all duration-1000"
                                        style={{ width: `${contextData?.knowledge?.completeness || 0}%` }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {contextData?.knowledge?.sections && Object.entries(contextData.knowledge.sections).map(([name, data]: [string, any]) => (
                                    <div key={name} className="flex items-center justify-between p-3 rounded-lg bg-surface/40 border border-border/40 hover:border-[#8B5CF6]/30 transition-colors">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium capitalize">{name.replace('_', ' ')}</span>
                                            <span className="text-xs text-muted-foreground">{data.entries} entries</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-surface-highlight rounded-full overflow-hidden">
                                                <div className="h-full bg-[#8B5CF6]/60" style={{ width: `${data.percentage}%` }} />
                                            </div>
                                            <span className="text-[10px] text-muted-foreground w-6 text-right">{data.percentage}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Campaign Stats Tab */}
                    {activeTab === 'stats' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <div className="p-4 rounded-xl border border-[#EC4899]/30 bg-[#EC4899]/5 space-y-4">
                                <h4 className="font-semibold text-[#F472B6] flex items-center gap-2">
                                    <BarChart3 size={18} /> Active Campaigns
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <div className="text-xs text-[#F472B6]/70">Total Sent</div>
                                        <div className="text-2xl font-bold text-foreground">{contextData?.stats?.campaign?.totalSent || 0}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-xs text-[#F472B6]/70">Response Rate</div>
                                        <div className="text-2xl font-bold text-foreground">{contextData?.stats?.campaign?.responseRate || '0%'}</div>
                                    </div>
                                </div>
                                <div className="pt-2 text-xs text-[#F472B6]/80 flex items-center gap-1.5">
                                    <span className="flex h-1.5 w-1.5 rounded-full bg-green-500" />
                                    {contextData?.stats?.campaign?.trend || 'Stable performance'}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="p-3 rounded-lg border border-border/40 bg-surface/30">
                                    <div className="text-xs text-muted-foreground mb-1">Meetings Booked</div>
                                    <div className="flex items-center justify-between">
                                        <div className="text-lg font-semibold">{contextData?.stats?.campaign?.meetings || 0}</div>
                                        <div className="h-2 w-24 bg-surface-highlight rounded-full overflow-hidden">
                                            <div className="h-full bg-[#EC4899]/60" style={{ width: '30%' }} />
                                        </div>
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg border border-border/40 bg-surface/30">
                                    <div className="text-xs text-muted-foreground mb-1">Replies Received</div>
                                    <div className="text-lg font-semibold">{contextData?.stats?.campaign?.replied || 0}</div>
                                </div>
                            </div>
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


