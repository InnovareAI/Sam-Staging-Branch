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
        label: 'Agent',
        description: 'Collaborate with Sam',
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
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-border/40">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center overflow-hidden">
                        <img
                            src="/SAM.jpg"
                            alt="Sam"
                            className="w-10 h-10 rounded-xl object-cover"
                            style={{ objectPosition: 'center 30%' }}
                        />
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Sam AI</p>
                        <h2 className="text-sm font-semibold text-foreground">Sales Agent</h2>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <ScrollArea className="flex-1">
                <nav className="p-2 space-y-1">
                    {menuItems.map((item) => {
                        const IconComponent = item.icon;
                        return (
                            <button
                                key={item.id}
                                onClick={() => handleNavClick(item)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                                    item.isActive
                                        ? "bg-primary/15 text-foreground border border-primary/30"
                                        : "text-muted-foreground hover:bg-surface-highlight/50 hover:text-foreground border border-transparent"
                                )}
                            >
                                <span className={cn(
                                    "flex h-8 w-8 items-center justify-center rounded-lg",
                                    item.isActive ? "bg-primary/20 text-primary" : "bg-surface-highlight text-muted-foreground"
                                )}>
                                    <IconComponent size={16} />
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{item.label}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>
                                </div>
                            </button>
                        );
                    })}
                </nav>
            </ScrollArea>

            {/* Footer - User Info */}
            <div className="p-3 border-t border-border/40">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-surface/30 border border-border/30">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                        <User size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{userName || 'User'}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors shrink-0"
                        title="Sign out"
                    >
                        <LogOut size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
