"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  MessageCircle,
  Brain,
  CheckSquare,
  Megaphone,
  MessageSquare,
  BarChart3,
  Settings,
  Building2,
  LogOut,
  User,
  Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { createClient } from "@/app/lib/supabase"
import { ThemeToggle } from "@/components/ui/theme-toggle"

// Menu items matching ChatSidebar - from app/page.tsx
const menuItems = [
  {
    id: 'chat',
    label: 'Agent',
    description: 'Collaborate with Sam in real time',
    icon: MessageCircle,
    path: '/chat'
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

export function AppSidebar({
  user,
  workspaceId,
  enabledFeatures,
  currentPath,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user?: { name: string; email: string; avatar?: string } | null;
  workspaceId?: string;
  enabledFeatures?: Record<string, boolean>;
  currentPath?: string;
}) {
  const router = useRouter();

  // Super admin check - shows Admin Panel for platform administrators
  const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'mg@innovareai.com'];
  const isSuperAdmin = user?.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase());

  const handleNavClick = (path: string) => {
    const fullPath = workspaceId ? `/workspace/${workspaceId}${path}` : path;
    router.push(fullPath);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Determine which item is active based on current path
  const getIsActive = (itemPath: string) => {
    if (!currentPath) return false;
    return currentPath.includes(itemPath);
  };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="border-b border-border/60 p-6">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-transparent">
            <img
              src="/SAM.jpg"
              alt="Sam AI"
              className="h-full w-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold tracking-tight" style={{ color: 'hsl(var(--header-foreground))' }}>
              SAM AI
            </span>
            <span className="text-xs text-muted-foreground">
              Sales Agent
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* Navigation Menu - matching ChatSidebar style */}
      <SidebarContent className="py-6 overflow-y-auto">
        <nav className="space-y-3 px-4">
          {menuItems.map((item) => {
            const isActive = getIsActive(item.path);
            const IconComponent = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.path)}
                className={cn(
                  "group w-full rounded-xl border border-transparent px-4 py-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  isActive
                    ? "bg-primary/15 text-foreground shadow-glow ring-1 ring-primary/35"
                    : "text-muted-foreground hover:border-border/60 hover:bg-surface-highlight/60 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                      isActive
                        ? "bg-primary/25 text-foreground"
                        : "bg-surface-highlight text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    <IconComponent size={20} />
                  </span>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-semibold leading-tight text-foreground truncate">
                      {item.label}
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground group-hover:text-muted-foreground/90 truncate">
                      {item.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}

          {/* Admin Panel - Super Admin Only */}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => handleNavClick('/admin')}
              className={cn(
                "group w-full rounded-xl border border-orange-500/30 px-4 py-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 mt-6",
                getIsActive('/admin')
                  ? "bg-orange-500/20 text-orange-300 shadow-glow ring-1 ring-orange-500/50"
                  : "text-orange-400/80 hover:bg-orange-500/10 hover:text-orange-300"
              )}
            >
              <div className="flex items-center gap-4">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                    getIsActive('/admin')
                      ? "bg-orange-500/30 text-orange-300"
                      : "bg-orange-500/20 text-orange-400 group-hover:text-orange-300"
                  )}
                >
                  <Shield size={20} />
                </span>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-semibold leading-tight truncate">
                    Admin Panel
                  </p>
                  <p className="mt-1 text-[11px] leading-snug opacity-75 truncate">
                    Super admin dashboard
                  </p>
                </div>
              </div>
            </button>
          )}
        </nav>
      </SidebarContent>

      {/* User Footer - matching ChatSidebar style */}
      <SidebarFooter className="border-t border-border/60 p-4">
        <div className="space-y-4">
          {/* User Profile Card */}
          <div className="rounded-2xl border border-border/60 bg-surface-highlight/40 p-4 transition-all duration-300">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-foreground ring-2 ring-primary/10 overflow-hidden shadow-inner">
                  {user?.avatar ? (
                    <img src={user.avatar} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <User size={20} className="text-primary/60" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-100">
                    {user?.name || 'User'}
                  </p>
                  <p className="truncate text-[10px] text-slate-500 uppercase tracking-tight">{user?.email || ''}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                    <p className="text-[10px] text-green-500 font-medium">Active</p>
                  </div>
                </div>
                <div>
                  <ThemeToggle />
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-highlight/60 px-3 py-2.5 text-xs font-semibold text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
