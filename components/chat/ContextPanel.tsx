'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, BookOpen, BarChart3, Globe } from "lucide-react";

export function ContextPanel() {
    return (
        <div className="flex flex-col h-full">
            {/* Tabs Header */}
            <div className="px-4 pt-4 border-b border-border/40">
                <Tabs defaultValue="intelligence" className="w-full">
                    <TabsList className="w-full grid grid-cols-4 bg-surface/50 p-1 rounded-lg mb-4">
                        <TabsTrigger value="intelligence" title="Lead Intelligence"><Users size={16} /></TabsTrigger>
                        <TabsTrigger value="knowledge" title="Knowledge Base"><BookOpen size={16} /></TabsTrigger>
                        <TabsTrigger value="stats" title="Campaign Stats"><BarChart3 size={16} /></TabsTrigger>
                        <TabsTrigger value="browser" title="Live Browser"><Globe size={16} /></TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Content Area */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-6">

                    {/* MOCK: Active Lead Card */}
                    <div className="rounded-xl border border-border/60 bg-surface/30 p-4 space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg">
                                JS
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground">John Smith</h3>
                                <p className="text-sm text-muted-foreground">VP of Sales @ Acme Inc</p>
                                <div className="flex gap-2 mt-2">
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                        SaaS
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">
                                        Decision Maker
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* CRM Status */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-surface-highlight/50 p-2 rounded">
                                <div className="text-muted-foreground">Deal Stage</div>
                                <div className="font-medium text-foreground">Qualified Lead</div>
                            </div>
                            <div className="bg-surface-highlight/50 p-2 rounded">
                                <div className="text-muted-foreground">Last Contact</div>
                                <div className="font-medium text-foreground">2 days ago</div>
                            </div>
                        </div>
                    </div>

                    {/* MOCK: Onboarding Progress */}
                    <div className="rounded-xl border border-border/60 bg-surface/30 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-foreground">Onboarding Progress</h4>
                            <span className="text-xs text-primary font-bold">Stage 3/7</span>
                        </div>
                        <div className="h-2 w-full bg-surface-highlight rounded-full overflow-hidden">
                            <div className="h-full w-[42%] bg-gradient-to-r from-primary to-accent rounded-full" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Current: <strong>Competitor Intelligence</strong>. Identifying direct rivals and monitoring targets.
                        </p>
                    </div>

                </div>
            </ScrollArea>
        </div>
    );
}
