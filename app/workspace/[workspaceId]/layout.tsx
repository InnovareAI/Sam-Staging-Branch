import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { NightSkyEffect } from "@/components/ui/night-sky-effect";
import { SamContextProvider } from "@/components/chat/SamContextProvider";
import { GlobalContextWrapper } from "@/components/chat/GlobalContextWrapper";
import React from 'react';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const supabase = await createServerSupabaseClient();

  // Detect if we're on the chat route
  const headersList = await headers();
  const xPathname = headersList.get('x-pathname') || '';

  // Server-side auth check
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Server-side workspace access check
  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!member) {
    redirect('/');
  }

  // Get workspace details
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, commenting_agent_enabled')
    .eq('id', workspaceId)
    .single();

  // Prepare user data for sidebar
  const userData = {
    name: user.user_metadata?.full_name || user.user_metadata?.first_name || user.email?.split('@')[0] || 'User',
    email: user.email || '',
    avatar: user.user_metadata?.avatar_url,
  };

  const enabledFeatures = {
    commenting_agent_enabled: workspace?.commenting_agent_enabled ?? false,
  };

  return (
    <SamContextProvider>
      <SidebarProvider defaultOpen={true} >
        <AppSidebar
          user={userData}
          workspaceId={workspaceId}
          enabledFeatures={enabledFeatures}
          currentPath={xPathname}
        />
        <SidebarInset>
          <div className="flex flex-1 flex-col h-screen bg-background text-foreground overflow-hidden relative">
            <NightSkyEffect />
            {/* Main Content Area */}
            <main className="flex-1 overflow-auto relative flex flex-col z-10">
              {children}
            </main>
            <GlobalContextWrapper />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </SamContextProvider>
  );
}
