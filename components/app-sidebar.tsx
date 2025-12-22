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
    <Sidebar collapsible="icon" {...props}>
      {/* SAM AI Header - matching ChatSidebar */}
      <SidebarHeader className="border-b border-border/60 px-4 py-4">
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
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-lg font-bold tracking-tight text-white">
              SAM AI
            </span>
            <span className="text-xs text-muted-foreground">
              Sales Agent
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* Navigation Menu - matching ChatSidebar style */}
      <SidebarContent className="py-4 overflow-y-auto">
        <nav className="space-y-2 px-3">
          {menuItems.map((item) => {
            const isActive = getIsActive(item.path);
            const IconComponent = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.path)}
                className={cn(
                  "group w-full rounded-xl border border-transparent px-3 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
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
                  <div className="flex-1 group-data-[collapsible=icon]:hidden">
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
      </SidebarContent>

      {/* User Footer - matching ChatSidebar style */}
      <SidebarFooter className="border-t border-border/60">
        <div className="space-y-4 px-4 py-4">
          {/* User Profile Card */}
          <div className="rounded-xl border border-border/60 bg-surface-highlight/40 px-4 py-4 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/25 text-sm font-semibold text-white">
                  <User size={16} />
                </div>
                <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                  <p className="truncate text-sm font-medium text-white">
                    {user?.name || 'User'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email || ''}</p>
                  <p className="text-xs text-green-500">Active session</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-surface-highlight px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive group-data-[collapsible=icon]:px-2"
              >
                <LogOut size={16} />
                <span className="group-data-[collapsible=icon]:hidden">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
