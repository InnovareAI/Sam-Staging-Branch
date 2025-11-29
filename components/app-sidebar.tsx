"use client"

import * as React from "react"
import {
  MessageCircle,
  Megaphone,
  Database,
  FileText,
  BarChart3,
  Settings,
  Shield,
  Users,
  Building2,
  Brain,
  Linkedin,
  Mail,
  MessageSquare,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

// Function to generate navigation data with workspace-aware URLs
const getNavigationData = (workspaceId?: string) => {
  const wsPrefix = workspaceId ? `/workspace/${workspaceId}` : '';

  return {
    user: {
      name: "User",
      email: "user@example.com",
      avatar: "/avatars/user.jpg",
    },
    teams: [
      {
        name: "InnovareAI",
        logo: Building2,
        plan: "Enterprise",
      },
    ],
    navMain: [
      {
        title: "Chat",
        url: "/",
        icon: MessageCircle,
        isActive: true,
        items: [
          {
            title: "New Conversation",
            url: "/",
          },
          {
            title: "History",
            url: "/?history=true",
          },
        ],
      },
      {
        title: "Campaigns",
        url: "/campaigns",
        icon: Megaphone,
        items: [
          {
            title: "Active Campaigns",
            url: "/campaigns",
          },
          {
            title: "Create Campaign",
            url: "/campaigns/create",
          },
          {
            title: "Templates",
            url: "/campaigns/templates",
          },
        ],
      },
      {
        title: "Data Collection",
        url: "/data-collection",
        icon: Database,
        items: [
          {
            title: "Prospects",
            url: "/data-collection/prospects",
          },
          {
            title: "LinkedIn Search",
            url: "/data-collection/linkedin",
          },
          {
            title: "Import CSV",
            url: "/data-collection/import",
          },
        ],
      },
      {
        title: "Commenting Agent",
        url: `${wsPrefix}/commenting-agent`,
        icon: MessageSquare,
        badge: "NEW",
        requiresFeature: "commenting_agent_enabled",
        items: [
          {
            title: "Dashboard",
            url: `${wsPrefix}/commenting-agent`,
          },
          {
            title: "Profiles",
            url: `${wsPrefix}/commenting-agent/profiles`,
          },
          {
            title: "Approve Comments",
            url: `${wsPrefix}/commenting-agent/approve`,
          },
          {
            title: "Analytics",
            url: `${wsPrefix}/commenting-agent/analytics`,
          },
        ],
      },
      {
        title: "Knowledge Base",
        url: "/knowledge-base",
        icon: FileText,
      },
      {
        title: "Analytics",
        url: "/analytics",
        icon: BarChart3,
      },
      {
        title: "Settings",
        url: "/settings",
        icon: Settings,
        items: [
          {
            title: "Workspace",
            url: "/settings/workspace",
          },
          {
            title: "Integrations",
            url: "/settings/integrations",
          },
          {
            title: "AI Configuration",
            url: "/settings/ai",
          },
        ],
      },
    ],
    integrations: [
      {
        name: "LinkedIn",
        url: "/linkedin-integration",
        icon: Linkedin,
      },
      {
        name: "Email",
        url: "/settings/integrations",
        icon: Mail,
      },
      {
        name: "AI Agents",
        url: "/settings/ai",
        icon: Brain,
      },
    ],
    adminNav: [
      {
        title: "Super Admin",
        url: "/admin/superadmin",
        icon: Shield,
      },
    ],
  };
}

export function AppSidebar({
  user,
  workspaces,
  workspaceId,
  isSuperAdmin,
  enabledFeatures,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user?: { name: string; email: string; avatar?: string } | null;
  workspaces?: { name: string; logo: React.ElementType; plan: string }[];
  workspaceId?: string;
  isSuperAdmin?: boolean;
  enabledFeatures?: Record<string, boolean>;
}) {
  // Get navigation data with workspace-aware URLs
  const data = getNavigationData(workspaceId);

  // Filter navigation items based on enabled features
  const filterNavItems = (items: typeof data.navMain) => {
    return items.filter(item => {
      // Check if item requires a feature
      if ('requiresFeature' in item && item.requiresFeature) {
        const featureKey = item.requiresFeature as string;
        return enabledFeatures?.[featureKey] === true;
      }
      return true; // Show item if no feature requirement
    });
  };

  const sidebarData = {
    ...data,
    user: user || data.user,
    teams: workspaces || data.teams,
    navMain: filterNavItems(data.navMain),
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={sidebarData.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={sidebarData.navMain} />
        <NavProjects projects={sidebarData.integrations} />
        {isSuperAdmin && <NavMain items={sidebarData.adminNav} />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={sidebarData.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
