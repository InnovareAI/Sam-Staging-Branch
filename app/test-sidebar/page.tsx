'use client'

import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Building2, Zap } from "lucide-react"
import { useState } from "react"

export default function TestSidebarPage() {
  // Test data
  const [isSuperAdmin, setIsSuperAdmin] = useState(true)
  
  const user = {
    name: "Thorsten Linz",
    email: "tl@innovareai.com",
    avatar: "/avatars/tl.jpg"
  }

  const workspaces = [
    {
      name: "InnovareAI Workspace",
      logo: Building2,
      plan: "Enterprise"
    },
    {
      name: "Test Workspace",
      logo: Zap,
      plan: "Pro"
    }
  ]

  return (
    <SidebarProvider>
      <AppSidebar 
        user={user}
        workspaces={workspaces}
        isSuperAdmin={isSuperAdmin}
      />
      <SidebarInset>
        {/* Header with breadcrumbs */}
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    SAM Dashboard
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Test Sidebar</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {/* Hero section */}
          <div className="rounded-xl bg-muted/50 p-8">
            <h1 className="text-3xl font-semibold mb-4">🎉 shadcn Sidebar Test Page</h1>
            <p className="text-muted-foreground mb-6">
              This page demonstrates the new shadcn sidebar-07 component integrated with SAM's navigation structure.
            </p>
            
            {/* Toggle admin mode */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-background">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSuperAdmin}
                  onChange={(e) => setIsSuperAdmin(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">
                  Enable Super Admin Mode
                </span>
              </label>
              <span className="text-xs text-muted-foreground">
                {isSuperAdmin ? '✅ Admin menu visible' : '❌ Admin menu hidden'}
              </span>
            </div>
          </div>

          {/* Feature grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl bg-muted/50 p-6">
              <h3 className="font-semibold mb-2">🎯 Navigation</h3>
              <p className="text-sm text-muted-foreground">
                All SAM sections: Chat, Campaigns, Data Collection, Knowledge Base, Analytics, Settings
              </p>
            </div>
            
            <div className="rounded-xl bg-muted/50 p-6">
              <h3 className="font-semibold mb-2">🔌 Integrations</h3>
              <p className="text-sm text-muted-foreground">
                Quick access to LinkedIn, Email, and AI Agent integrations
              </p>
            </div>
            
            <div className="rounded-xl bg-muted/50 p-6">
              <h3 className="font-semibold mb-2">👥 Workspace Switcher</h3>
              <p className="text-sm text-muted-foreground">
                Switch between workspaces from the top dropdown menu
              </p>
            </div>
            
            <div className="rounded-xl bg-muted/50 p-6">
              <h3 className="font-semibold mb-2">📱 Collapsible</h3>
              <p className="text-sm text-muted-foreground">
                Click the hamburger icon to collapse sidebar to icons only
              </p>
            </div>
            
            <div className="rounded-xl bg-muted/50 p-6">
              <h3 className="font-semibold mb-2">🔒 Super Admin</h3>
              <p className="text-sm text-muted-foreground">
                {isSuperAdmin 
                  ? 'Admin section is visible at the bottom' 
                  : 'Toggle above to see admin section'}
              </p>
            </div>
            
            <div className="rounded-xl bg-muted/50 p-6">
              <h3 className="font-semibold mb-2">🎨 Responsive</h3>
              <p className="text-sm text-muted-foreground">
                Automatically adapts to mobile with overlay behavior
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-xl bg-muted/50 p-6">
            <h2 className="text-xl font-semibold mb-4">✅ What to Test</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>1. Click menu items to navigate (links are set up)</li>
              <li>2. Click the hamburger icon (☰) to collapse/expand sidebar</li>
              <li>3. Click the workspace dropdown at the top to switch workspaces</li>
              <li>4. Toggle "Super Admin Mode" above to show/hide admin section</li>
              <li>5. Click your user profile at the bottom for account menu</li>
              <li>6. Try on mobile - resize your browser to see responsive behavior</li>
              <li>7. Expand/collapse navigation groups with arrows</li>
            </ul>
          </div>

          {/* Next steps */}
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-6">
            <h2 className="text-xl font-semibold mb-4">🚀 Next Steps</h2>
            <ol className="space-y-2 text-sm">
              <li><strong>1. Integrate into main app:</strong> Replace old navigation in app/page.tsx</li>
              <li><strong>2. Connect auth:</strong> Pass real user data from session</li>
              <li><strong>3. Wire workspace switching:</strong> Connect to your workspace state management</li>
              <li><strong>4. Update routing:</strong> Ensure all URLs match your pages</li>
              <li><strong>5. Customize styling:</strong> Adjust colors in globals.css</li>
            </ol>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
