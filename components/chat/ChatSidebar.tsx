'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MessageCircle, Brain, CheckSquare, Megaphone, MessageSquare, BarChart3, Settings, LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createClient } from '@/app/lib/supabase';

const menuItems = [
    {
        id: 'chat',
        label: 'Chat',
        description: 'Talk to Sam AI',
        icon: MessageCircle,
        path: '/chat',
        isActive: true
    },
    {
        id: 'knowledge',
        label: 'Knowledgebase',
        description: 'Training assets',
        icon: Brain,
        path: '/?tab=knowledge',
        isLegacy: true
    },
    {
        id: 'data-approval',
        label: 'Prospects',
        description: 'Manage prospect data',
        icon: CheckSquare,
        path: '/?tab=data-approval',
        isLegacy: true
    },
    {
        id: 'campaign',
        label: 'Campaigns',
        description: 'Multi-channel outreach',
        icon: Megaphone,
        path: '/?tab=campaign',
        isLegacy: true
    },
    {
        id: 'commenting-agent',
        label: 'Commenting',
        description: 'LinkedIn engagement',
        icon: MessageSquare,
        path: '/commenting-agent'
    },
    {
        id: 'analytics',
        label: 'Analytics',
        description: 'Performance metrics',
        icon: BarChart3,
        path: '/?tab=analytics',
        isLegacy: true
    },
    {
        id: 'settings',
        label: 'Settings',
        description: 'Integrations & config',
        icon: Settings,
        path: '/?tab=settings',
        isLegacy: true
    }
];

export function ChatSidebar() {
    const params = useParams();
    const workspaceId = params.workspaceId as string;
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);

    useEffect(() => {
        const loadUser = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserEmail(user.email || null);
                setUserName(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || null);
            }
        };
        loadUser();
    }, []);

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    const handleNavClick = (item: typeof menuItems[0]) => {
        if (item.isActive) return; // Already on this page

        if (item.isLegacy) {
            window.location.href = item.path;
        } else if (item.path.startsWith('/')) {
            window.location.href = `/workspace/${workspaceId}${item.path}`;
        }
    };

    return (
        <div className="flex flex-col h-full bg-surface-muted/70 backdrop-blur border-r border-border/60">
            {/* Sidebar Header */}
            <div className="border-b border-border/60 px-6 py-6">
                <div className="flex items-center gap-3">
                    <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-transparent">
                        <img
                            src="/SAM.jpg"
                            alt="Sam AI"
                            className="h-11 w-11 rounded-2xl object-cover"
                            style={{ objectPosition: 'center 30%' }}
                        />
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Sam AI</p>
                        <h2 className="text-xl font-semibold text-foreground">Sales Agent</h2>
                    </div>
                </div>
            </div>

            {/* Navigation Menu */}
            <div className="flex-1 overflow-y-auto py-4">
                <nav className="space-y-2 px-4">
                    {menuItems.map((item) => {
                        // In ChatSidebar, 'chat' is always the active context visually if we are here
                        const isActive = item.id === 'chat';
                        const IconComponent = item.icon;

                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => handleNavClick(item)}
                                className={cn(
                                    "group w-full rounded-xl border border-transparent px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                                    isActive
                                        ? "bg-primary/15 text-white shadow-glow ring-1 ring-primary/35"
                                        : "text-muted-foreground hover:border-border/60 hover:bg-surface-highlight/60 hover:text-foreground"
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    <span
                                        className={cn(
                                            "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                                            isActive
                                                ? "bg-primary/25 text-white"
                                                : "bg-surface-highlight text-muted-foreground group-hover:text-foreground"
                                        )}
                                    >
                                        <IconComponent size={18} />
                                    </span>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold leading-tight text-foreground group-hover:text-white">
                                            {item.label}
                                        </p>
                                        <p className="mt-1 text-xs leading-snug text-muted-foreground group-hover:text-muted-foreground/90">
                                            {item.description}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Sidebar Bottom */}
            <div className="space-y-0 border-t border-border/60">
                <div className="space-y-4 px-5 py-5">
                    {/* Clear Session Button (Styled like dashboard) */}
                    <button
                        type="button"
                        onClick={async () => {
                            // This would need reset logic passed down, but for now we just show it
                            // Or we can import useSamThreadedChat to clear?
                            // For visual consistency primarily
                            if (window.confirm('Clear conversation context?')) {
                                window.location.reload();
                            }
                        }}
                        className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-surface-highlight/50 px-4 py-3 text-sm font-medium text-muted-foreground transition hover:border-border hover:bg-surface-highlight hover:text-foreground"
                    >
                        <span className="flex items-center gap-2">
                            <Settings size={16} />
                            Clear Session
                        </span>
                        <span className="text-xs text-muted-foreground/80">⌘⇧⌫</span>
                    </button>

                    {/* User Profile Card */}
                    <div className="rounded-xl border border-border/60 bg-surface-highlight/40 px-4 py-4">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/25 text-sm font-semibold text-white">
                                    <User size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="truncate text-sm font-medium text-white">
                                        {userName || 'Authenticated User'}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                                    <p className="text-xs text-green-500">Active session</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-surface text-sm font-medium text-muted-foreground transition hover:bg-surface-highlight hover:text-white"
                            >
                                <LogOut size={16} />
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
