'use client';

import { useState } from 'react';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { ContextPanel } from '@/components/chat/ContextPanel';
import { SamContextProvider } from '@/components/chat/SamContextProvider';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

/**
 * Chat Page - Uses parent workspace layout's AppSidebar
 * 
 * The ChatSidebar was removed to prevent double sidebar issue.
 * Navigation is now handled by the parent workspace layout's AppSidebar.
 */
export default function ChatPage() {
    const [isContextOpen, setIsContextOpen] = useState(false);

    return (
        <SamContextProvider>
            <div className="flex h-[calc(100vh-2rem)] w-full relative">
                {/* Main Chat Area */}
                <div className={cn(
                    "flex-1 flex flex-col transition-all duration-300",
                    isContextOpen ? "mr-80" : ""
                )}>
                    <ChatInterface />
                </div>

                {/* Context Panel Toggle */}
                <button
                    onClick={() => setIsContextOpen(!isContextOpen)}
                    className={cn(
                        "fixed right-0 top-1/2 -translate-y-1/2 z-40",
                        "w-6 h-16 flex items-center justify-center",
                        "bg-surface-muted border border-border/60 rounded-l-lg",
                        "text-muted-foreground hover:text-foreground hover:bg-surface-highlight",
                        "transition-all duration-200",
                        isContextOpen && "right-80"
                    )}
                    title={isContextOpen ? "Close context" : "Open context"}
                >
                    <ChevronRight
                        size={16}
                        className={cn(
                            "transition-transform duration-200",
                            isContextOpen && "rotate-180"
                        )}
                    />
                </button>

                {/* Context Panel */}
                <div className={cn(
                    "fixed right-0 top-0 h-full w-80 z-30",
                    "bg-surface-muted/95 backdrop-blur border-l border-border/60",
                    "transform transition-transform duration-300 ease-in-out",
                    isContextOpen ? "translate-x-0" : "translate-x-full"
                )}>
                    <ContextPanel />
                </div>
            </div>
        </SamContextProvider>
    );
}
