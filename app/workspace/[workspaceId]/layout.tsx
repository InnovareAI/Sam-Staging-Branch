import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const supabase = await createServerSupabaseClient();

  // Detect if we're on the chat route - it has its own sidebar
  // Check multiple sources since rewrites change the pathname
  const headersList = await headers();
  const xPathname = headersList.get('x-pathname') || '';
  const xInvokePath = headersList.get('x-invoke-path') || '';
  const referer = headersList.get('referer') || '';
  const xUrl = headersList.get('x-url') || '';

  // Chat route check: path ends with /chat (works for both /chat and /workspace/{id}/chat)
  const isChatRoute = xPathname.endsWith('/chat') ||
    xInvokePath.endsWith('/chat') ||
    referer.endsWith('/chat') ||
    xUrl.includes('/chat');

  // Server-side auth check - instant, no loading spinner
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

  // Chat route uses its own AdaptiveLayout with ChatSidebar - skip AppSidebar
  if (isChatRoute) {
    return <>{children}</>;
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
    <SidebarProvider>
      <AppSidebar
        user={userData}
        workspaceId={workspaceId}
        enabledFeatures={enabledFeatures}
      />
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

