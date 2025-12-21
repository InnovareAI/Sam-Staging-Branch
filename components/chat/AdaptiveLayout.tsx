'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { PanelRightClose, PanelRightOpen, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdaptiveLayoutProps {
    children: React.ReactNode;
    sidebar: React.ReactNode;
    contextPanel: React.ReactNode;
    isContextOpen: boolean;
    onToggleContext: () => void;
    isSidebarOpen: boolean;
    onToggleSidebar: () => void;
}

export function AdaptiveLayout({
    children,
    sidebar,
    contextPanel,
    isContextOpen,
    onToggleContext,
    isSidebarOpen,
    onToggleSidebar
}: AdaptiveLayoutProps) {
    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* 1. Left Sidebar (Collapsible) */}
            <aside
                className={cn(
                    "w-64 border-r border-border/40 bg-surface-muted/30 transition-all duration-300 ease-in-out flex flex-col",
                    !isSidebarOpen && "-ml-64 opacity-0 lg:ml-0 lg:opacity-100 lg:w-64" // Stick on desktop, toggle on mobile
                )}
            >
                {sidebar}
            </aside>

            {/* 2. Main Chat Area */}
            <main className="flex-1 flex flex-col min-w-0 bg-background relative">
                {/* Header / Toggle Controls */}
                <header className="h-14 border-b border-border/40 flex items-center justify-between px-4 bg-background/80 backdrop-blur z-10">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="lg:hidden text-muted-foreground">
                            <Menu size={20} />
                        </Button>
                        <h1 className="font-semibold text-foreground">Sam <span className="text-muted-foreground font-normal mx-2">/</span> Orchestration</h1>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggleContext}
                        className={cn("gap-2", isContextOpen ? "text-primary" : "text-muted-foreground")}
                    >
                        {isContextOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
                        <span className="hidden sm:inline">{isContextOpen ? 'Close Context' : 'Open Context'}</span>
                    </Button>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-y-auto relative">
                    {children}
                </div>
            </main>

            {/* 3. Right Context Panel (Collapsible) */}
            <aside
                className={cn(
                    "border-l border-border/40 bg-surface-muted/30 transition-all duration-300 ease-in-out flex flex-col",
                    isContextOpen ? "w-80 opacity-100 translate-x-0" : "w-0 opacity-0 translate-x-20 overflow-hidden"
                )}
            >
                <div className="w-80 h-full flex flex-col">
                    {contextPanel}
                </div>
            </aside>
        </div>
    );
}
