import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * Diagnostic endpoint to check user authentication and workspace access
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        authenticated: false,
        error: authError?.message || 'No user session',
        cookies: cookieStore.getAll().map(c => ({ name: c.name, hasValue: !!c.value }))
      });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    // Get workspace memberships using direct query (not join)
    const { data: memberships, error: membershipError } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('user_id', user.id);

    // Get workspaces separately
    let workspaces = [];
    if (memberships && memberships.length > 0) {
      const workspaceIds = memberships.map(m => m.workspace_id);
      const { data: workspaceData } = await supabase
        .from('workspaces')
        .select('*')
        .in('id', workspaceIds);
      workspaces = workspaceData || [];
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      profile: profile || null,
      profileError: profileError?.message || null,
      memberships: memberships || [],
      membershipError: membershipError?.message || null,
      workspaces: workspaces,
      diagnosis: {
        hasProfile: !!profile,
        hasMemberships: memberships && memberships.length > 0,
        membershipCount: memberships?.length || 0,
        workspaceCount: workspaces.length,
        currentWorkspaceId: profile?.current_workspace_id || null
      }
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
