'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/app/lib/supabase';
import { Loader2, MessageSquare, LogOut, MessageCircle, Brain, CheckSquare, Megaphone, BarChart3, Settings, Building2, Shield } from 'lucide-react';

interface User {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
}

interface Workspace {
  id: string;
  name: string;
  commenting_agent_enabled?: boolean;
}

const menuItems = [
  {
    id: 'chat',
    label: 'Agent',
    description: 'Collaborate with Sam in real time',
    icon: MessageCircle,
    path: '/?tab=chat',
    isLegacy: true
  },
  {
    id: 'knowledge',
    label: 'Knowledgebase',
    description: 'Curate training assets and product intel',
    icon: Brain,
    path: '/knowledge',
    isLegacy: false
  },
  {
    id: 'data-approval',
    label: 'Prospect Database',
    description: 'Review, approve and manage prospect data',
    icon: CheckSquare,
    path: '/?tab=data-approval',
    isLegacy: true
  },
  {
    id: 'campaign',
    label: 'Campaigns',
    description: 'Plan multi-channel outreach with Sam',
    icon: Megaphone,
    path: '/campaign-hub',
    isLegacy: false
  },
  {
    id: 'commenting-agent',
    label: 'Commenting Agent',
    description: 'Automated LinkedIn engagement and commenting',
    icon: MessageSquare,
    path: '/commenting-agent',
    isLegacy: false
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'Monitor performance and coverage metrics',
    icon: BarChart3,
    path: '/?tab=analytics',
    isLegacy: true
  },
  {
    id: 'settings',
    label: 'Settings & Profile',
    description: 'Configure integrations, channels, and account',
    icon: Settings,
    path: '/?tab=settings',
    isLegacy: true
  },
  {
    id: 'workspace',
    label: 'Workspace',
    description: 'Organize teams, tenants, and invitations',
    icon: Building2,
    path: '/?tab=workspace',
    isLegacy: true
  },
  {
    id: 'ai-config',
    label: 'AI Configuration',
    description: 'Configure AI agents, models, and automation',
    icon: Brain,
    path: '/?tab=ai-config',
    isLegacy: true
  }
];

// Routes that should hide the global sidebar and render in full-screen mode
// These routes have their own internal navigation (e.g., ChatSidebar)
const FULL_SCREEN_ROUTES = ['/chat'];

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const workspaceId = params.workspaceId as string;

  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserAndWorkspace = async () => {
      const supabase = createClient();

      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        router.push('/login');
        return;
      }

      setUser({
        id: authUser.id,
        email: authUser.email || '',
        user_metadata: authUser.user_metadata,
      });

      // Check if user has access to this workspace
      const { data: member, error: memberError } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', authUser.id)
        .single();

      if (memberError || !member) {
        // User doesn't have access to this workspace
        router.push('/');
        return;
      }

      // Get workspace details
      const { data: workspaceData } = await supabase
        .from('workspaces')
        .select('id, name, commenting_agent_enabled')
        .eq('id', workspaceId)
        .single();

      if (workspaceData) {
        setWorkspace(workspaceData);
      }

      setLoading(false);
    };

    loadUserAndWorkspace();
  }, [workspaceId, router]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-pink-500" />
      </div>
    );
  }

  // Determine if this is a full-screen route (hides global sidebar)
  const isFullScreenRoute = FULL_SCREEN_ROUTES.some(route => pathname?.includes(route));

  // Determine active menu item based on current path
  const activeMenuItem = menuItems.find(item =>
    pathname?.includes(item.path)
  )?.id || menuItems[0]?.id;

  const activeSection = menuItems.find(item => item.id === activeMenuItem) || menuItems[0];

  // Handle navigation
  const handleMenuClick = (item: any) => {
    if (item.id === 'commenting-agent') {
      // [NEW] Redirect to the new Adaptive Chat Interface
      window.location.href = `/workspace/${workspaceId}/chat`;
      return;
    }

    if (item.isLegacy) {
      // Redirect to legacy app with tab param
      window.location.href = `/?tab=${item.id}`;
    } else {
      // Modern navigation
      router.push(`/workspace/${workspaceId}/${item.id}`);
    }
  };

  // Full-screen mode: render children directly without global sidebar
  if (isFullScreenRoute) {
    return (
      <div className="h-screen bg-background text-foreground overflow-hidden">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Left Sidebar - Custom Design */}
      <div className="hidden w-72 flex-col border-r border-border/60 bg-surface-muted/70 backdrop-blur lg:flex overflow-y-auto">
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
              <h2 className="text-xl font-semibold text-white">Your AI Sales Agent</h2>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-2 px-4">
            {menuItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = item.id === activeMenuItem;

              return (
                <button
                  key={item.id}
                  type="button"
                  // Handle navigation
                  onClick={() => handleMenuClick(item)}
                  className={`group w-full rounded-xl border border-transparent px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${isActive
                    ? 'bg-primary/15 text-white shadow-glow ring-1 ring-primary/35'
                    : 'text-muted-foreground hover:border-border/60 hover:bg-surface-highlight/60 hover:text-foreground'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${isActive
                        ? 'bg-primary/25 text-white'
                        : 'bg-surface-highlight text-muted-foreground group-hover:text-foreground'
                        }`}
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
            <div className="rounded-xl border border-border/60 bg-surface-highlight/40 px-4 py-4">
              {user ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/25 text-sm font-semibold text-white">
                      {(user.user_metadata?.full_name || user.user_metadata?.first_name || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {user.user_metadata?.full_name ||
                          (user.user_metadata?.first_name && user.user_metadata?.last_name
                            ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
                            : user.email) || 'Authenticated User'}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-green-500">Active session</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-surface px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-surface-highlight hover:text-white"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-surface">
        <div className="border-b border-border/60 px-6 py-5 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Workspace</p>
              <h1 className="mt-2 text-2xl font-semibold text-white">{activeSection?.label || 'Workspace'}</h1>
              <p className="text-sm text-muted-foreground/90 lg:max-w-xl">{activeSection?.description || workspace?.name}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div >
  );
}
