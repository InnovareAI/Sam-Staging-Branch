'use client';

import { useState, useEffect } from 'react';
import { AdaptiveLayout } from '@/components/chat/AdaptiveLayout';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { ContextPanel } from '@/components/chat/ContextPanel';
import { SamContextProvider } from '@/components/chat/SamContextProvider';

export default function RootChatWrapper() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isContextOpen, setIsContextOpen] = useState(true);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">Loading...</div>;
    }

    return (
        <AdaptiveLayout
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            isContextOpen={isContextOpen}
            onToggleContext={() => setIsContextOpen(!isContextOpen)}
            sidebar={<ChatSidebar />}
            contextPanel={<ContextPanel />}
        >
            <ChatInterface />
        </AdaptiveLayout>
    );
}
