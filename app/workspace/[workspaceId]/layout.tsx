'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { createClient } from '@/app/lib/supabase';
import { Loader2 } from 'lucide-react';

interface User {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface Workspace {
  id: string;
  name: string;
  commenting_agent_enabled?: boolean;
}

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;

  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

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

      // Check if super admin
      setIsSuperAdmin(member.role === 'super_admin' || member.role === 'owner');

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-pink-500" />
      </div>
    );
  }

  const sidebarUser = user ? {
    name: user.user_metadata?.full_name || user.email.split('@')[0],
    email: user.email,
    avatar: user.user_metadata?.avatar_url,
  } : undefined;

  const enabledFeatures = {
    commenting_agent_enabled: workspace?.commenting_agent_enabled || false,
  };

  return (
    <SidebarProvider>
      <AppSidebar
        user={sidebarUser}
        workspaceId={workspaceId}
        isSuperAdmin={isSuperAdmin}
        enabledFeatures={enabledFeatures}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1 text-gray-400 hover:text-white" />
            <Separator orientation="vertical" className="mr-2 h-4 bg-gray-700" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/" className="text-gray-400 hover:text-white">
                    Home
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block text-gray-600" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-gray-200">
                    {workspace?.name || 'Workspace'}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <main className="flex-1 bg-gray-900 min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
