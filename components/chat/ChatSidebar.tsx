'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, MessageSquare, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSamThreadedChat } from '@/lib/hooks/useSamThreadedChat';
import { formatDistanceToNow } from 'date-fns';

export function ChatSidebar() {
    const {
        threads,
        loadThreads,
        currentThread,
        switchToThread,
        createThread,
        isLoading
    } = useSamThreadedChat();

    const [search, setSearch] = useState('');

    // Initial load
    useEffect(() => {
        loadThreads();
    }, [loadThreads]);

    const handleNewChat = async () => {
        // Creating a new thread usually involves just resetting the current thread 
        // or calling createThread explicitly. For now, we'll just clear current thread
        // assuming the hook handles "new thread" state by having null currentThread
        // But the hook's `sendMessage` handles creation if no thread exists.
        // So we need a way to "deselect" the current thread.
        // We can't do that easily with the exposed API unless we expose `setCurrentThread(null)`
        // For now, we trigger a createThread call to start fresh.
        await createThread({
            title: 'New Conversation',
            thread_type: 'general',
            priority: 'medium',
            sales_methodology: 'meddic'
        });
    };

    // Filter threads
    const filteredThreads = threads.filter(t =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.last_sam_message?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-border/40 space-y-4">
                <Button
                    onClick={handleNewChat}
                    className="w-full justify-start gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                >
                    <Plus size={16} />
                    New Chat
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
                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider flex justify-between">
                        <span>Recent</span>
                        {isLoading && <span className="animate-pulse">Loading...</span>}
                    </div>

                    {filteredThreads.map((thread) => (
                        <button
                            key={thread.id}
                            onClick={() => switchToThread(thread)}
                            className={cn(
                                "w-full flex items-start gap-3 px-3 py-3 rounded-lg text-left transition-colors",
                                currentThread?.id === thread.id
                                    ? "bg-primary/10 border border-primary/20"
                                    : "hover:bg-surface-highlight/50 border border-transparent"
                            )}
                        >
                            <MessageSquare size={16} className={cn("mt-0.5 shrink-0", currentThread?.id === thread.id ? "text-primary" : "text-muted-foreground")} />
                            <div className="flex-1 overflow-hidden min-w-0">
                                <div className="flex justify-between items-baseline gap-2">
                                    <div className={cn("text-sm font-medium truncate", currentThread?.id === thread.id ? "text-foreground" : "text-muted-foreground")}>
                                        {thread.title}
                                    </div>
                                    {thread.last_active_at && (
                                        <span className="text-[10px] text-muted-foreground/40 shrink-0">
                                            {formatDistanceToNow(new Date(thread.last_active_at), { addSuffix: true })}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground/60 truncate mt-0.5">
                                    {thread.last_sam_message || thread.last_user_message || "No messages yet"}
                                </div>

                                {/* Thread Tags */}
                                {thread.tags && thread.tags.length > 0 && (
                                    <div className="flex gap-1 mt-1.5">
                                        {thread.tags.slice(0, 2).map(tag => (
                                            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-surface-highlight border border-border/30 text-muted-foreground">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </button>
                    ))}

                    {filteredThreads.length === 0 && !isLoading && (
                        <div className="text-center py-8 text-muted-foreground/40 text-sm">
                            No conversations found.
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-border/40 space-y-2">
                <Button
                    variant="ghost"
                    onClick={() => {
                        const isArchivedView = threads.some(t => t.status === 'archived');
                        loadThreads({ status: isArchivedView ? 'active' : 'archived' });
                    }}
                    className={cn(
                        "w-full justify-start gap-2 h-9 px-2 transition-colors",
                        threads.some(t => t.status === 'archived')
                            ? "bg-primary/10 text-primary hover:bg-primary/20"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    {threads.some(t => t.status === 'archived') ? (
                        <>
                            <MessageSquare size={16} />
                            Back to Active Chats
                        </>
                    ) : (
                        <>
                            <Archive size={16} />
                            Archive History
                        </>
                    )}
                </Button>
                <div className="text-xs text-muted-foreground/60 text-center pt-2">
                    InnovareAI Orchestration v4.5
                </div>
            </div>
        </div>
    );
}
