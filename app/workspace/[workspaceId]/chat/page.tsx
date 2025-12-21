'use client';

import { useState } from 'react';
import { AdaptiveLayout } from '@/components/chat/AdaptiveLayout';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { ContextPanel } from '@/components/chat/ContextPanel';

import { SamContextProvider } from '@/components/chat/SamContextProvider';

export default function ChatPage() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isContextOpen, setIsContextOpen] = useState(true);

    return (
        <SamContextProvider>
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
        </SamContextProvider>
    );
}
