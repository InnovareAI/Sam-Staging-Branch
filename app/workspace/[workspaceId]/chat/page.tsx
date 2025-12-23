'use client';

import { ChatInterface } from '@/components/chat/ChatInterface';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';

/**
 * Chat Page - Uses global SamContext and global side panels defined in WorkspaceLayout
 */
export default function ChatPage() {
    return (
        <div className="flex-1 flex flex-col min-w-0 bg-background relative h-[calc(100vh-2rem)]">
            <ChatInterface />
        </div>
    );
}
