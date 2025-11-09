import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get authenticated user
    const cookieStore = await cookies();
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          }
        }
      }
    );

    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        authenticated: false,
        error: 'Not authenticated',
        authError: authError?.message
      });
    }

    // Get user's workspaces
    const { data: members, error: membersError } = await supabase
      .from('workspace_members')
      .select('workspace_id, role, status')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (membersError) {
      return NextResponse.json({
        authenticated: true,
        userId: user.id,
        email: user.email,
        workspaces: [],
        error: 'Failed to fetch workspace memberships',
        details: membersError.message
      });
    }

    // Get workspace details
    const workspaceIds = members?.map(m => m.workspace_id) || [];
    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspaces')
      .select('id, name, client_code')
      .in('id', workspaceIds);

    // Get user's current workspace
    const { data: userData } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      authenticated: true,
      userId: user.id,
      email: user.email,
      workspaceMemberships: members?.length || 0,
      workspaces: workspaces || [],
      currentWorkspaceId: userData?.current_workspace_id || null,
      memberships: members?.map(m => ({
        workspaceId: m.workspace_id,
        role: m.role,
        status: m.status,
        workspaceName: workspaces?.find(w => w.id === m.workspace_id)?.name || 'Unknown'
      }))
    });

  } catch (error: any) {
    return NextResponse.json({
      error: 'Server error',
      details: error.message
    }, { status: 500 });
  }
}
