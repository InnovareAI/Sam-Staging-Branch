'use client';

import { useState } from 'react';
import { Search, Plus, MessageSquare, Clock, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export function ChatSidebar() {
    const [search, setSearch] = useState('');

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-border/40 space-y-4">
                <Button className="w-full justify-start gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20">
                    <Plus size={16} />
                    New Orchestration
                </Button>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search history..."
                        className="pl-9 bg-surface/50 border-border/50 h-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Thread List */}
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider">
                        Recent
                    </div>
                    {/* Mock Threads */}
                    {[1, 2, 3].map((i) => (
                        <button
                            key={i}
                            className={cn(
                                "w-full flex items-start gap-3 px-3 py-3 rounded-lg text-left transition-colors",
                                i === 1 ? "bg-primary/10 border border-primary/20" : "hover:bg-surface-highlight/50 border border-transparent"
                            )}
                        >
                            <MessageSquare size={16} className={cn("mt-0.5", i === 1 ? "text-primary" : "text-muted-foreground")} />
                            <div className="flex-1 overflow-hidden">
                                <div className={cn("text-sm font-medium truncate", i === 1 ? "text-foreground" : "text-muted-foreground")}>
                                    Project Alpha Launch
                                </div>
                                <div className="text-xs text-muted-foreground/60 truncate mt-0.5">
                                    Sam: Here's the drafted email sequence for...
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </ScrollArea>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-border/40 text-xs text-muted-foreground text-center">
                InnovareAI Orchestration v4.5
            </div>
        </div>
    );
}
