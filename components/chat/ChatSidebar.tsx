'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MessageCircle, Brain, CheckSquare, Megaphone, MessageSquare, BarChart3, Settings, LogOut, User, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createClient } from '@/app/lib/supabase';

// Menu items from app/page.tsx
const menuItems = [
    {
        id: 'chat',
        label: 'Agent',
        description: 'Collaborate with Sam in real time',
        icon: MessageCircle,
        path: '/chat',
        isActive: true
    },
    {
        id: 'knowledge',
        label: 'Knowledgebase',
        description: 'Curate training assets and product intel',
        icon: Brain,
        path: '/knowledge'
    },
    {
        id: 'data-approval',
        label: 'Prospect Database',
        description: 'Review, approve and manage prospect data',
        icon: CheckSquare,
        path: '/data-approval'
    },
    {
        id: 'campaign',
        label: 'Campaigns',
        description: 'Plan multi-channel outreach with Sam',
        icon: Megaphone,
        path: '/campaign-hub'
    },
    {
        id: 'commenting-agent',
        label: 'Commenting Agent',
        description: 'Automated LinkedIn engagement and commenting',
        icon: MessageSquare,
        path: '/commenting-agent'
    },
    {
        id: 'analytics',
        label: 'Analytics',
        description: 'Monitor performance and coverage metrics',
        icon: BarChart3,
        path: '/analytics'
    },
    {
        id: 'settings',
        label: 'Settings & Profile',
        description: 'Configure integrations, channels, preferences',
        icon: Settings,
        path: '/settings'
    },
    {
        id: 'workspace',
        label: 'Workspace',
        description: 'Organize teams, tenants, and invitations',
        icon: Building2,
        path: '/workspace-settings'
    },
    {
        id: 'ai-config',
        label: 'AI Configuration',
        description: 'Configure AI agents, models, and automation',
        icon: Brain,
        path: '/ai-config'
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
        if ('isActive' in item && item.isActive) return; // Already on this page
        window.location.href = `/workspace/${workspaceId}${item.path}`;
    };

    return (
        <div className="flex flex-col h-full bg-surface-muted/70 backdrop-blur border-r border-border/60">
            {/* Sidebar Header - h-16 to match main header */}
            <div className="h-16 border-b border-border/60 px-6 flex items-center">
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
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold leading-tight text-foreground group-hover:text-white">
                                                {item.label}
                                            </p>
                                            {'badge' in item && item.badge && (
                                                <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-primary/20 text-primary rounded">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </div>
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
