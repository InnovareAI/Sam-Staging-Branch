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

// SAM App Navigation Data
const data = {
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
      url: "/admin",
      icon: Shield,
      items: [
        {
          title: "User Management",
          url: "/admin/users",
        },
        {
          title: "Workspaces",
          url: "/admin/workspaces",
        },
        {
          title: "System Settings",
          url: "/admin/settings",
        },
      ],
    },
  ],
}

export function AppSidebar({ 
  user,
  workspaces,
  isSuperAdmin,
  ...props 
}: React.ComponentProps<typeof Sidebar> & {
  user?: { name: string; email: string; avatar?: string } | null;
  workspaces?: { name: string; logo: React.ElementType; plan: string }[];
  isSuperAdmin?: boolean;
}) {
  const sidebarData = {
    ...data,
    user: user || data.user,
    teams: workspaces || data.teams,
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
