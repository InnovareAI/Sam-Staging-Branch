'use client';

import { cn } from '@/lib/utils';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
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
                    "border-r border-border/40 bg-surface-muted/30 flex flex-col transition-all duration-300 ease-in-out",
                    isSidebarOpen ? "w-64 opacity-100" : "w-0 opacity-0 overflow-hidden"
                )}
            >
                <div className="w-64 h-full flex flex-col">
                    {sidebar}
                </div>
            </aside>

            {/* 2. Main Chat Area */}
            <main className="flex-1 flex flex-col min-w-0 bg-background relative">
                {/* Minimal Header - h-16 to align border with side panels */}
                <header className="h-16 border-b border-border/40 flex items-center justify-between px-4 bg-background/80 backdrop-blur z-10">
                    <div className="flex items-center gap-3">
                        {/* Toggle Sidebar */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onToggleSidebar}
                            className={cn("p-2", isSidebarOpen ? "text-primary" : "text-muted-foreground")}
                        >
                            {isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
                        </Button>

                        <h1 className="font-semibold text-foreground text-sm">Sam</h1>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggleContext}
                        className={cn("p-2", isContextOpen ? "text-primary" : "text-muted-foreground")}
                    >
                        {isContextOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
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
                    isContextOpen ? "w-80 opacity-100" : "w-0 opacity-0 overflow-hidden"
                )}
            >
                <div className="w-80 h-full flex flex-col">
                    {contextPanel}
                </div>
            </aside>
        </div>
    );
}
