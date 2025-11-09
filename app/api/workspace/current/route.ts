import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Force rebuild: 2025-11-09
export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Cookie setting can fail in API route context
            }
          }
        },
        cookieOptions: {
          global: {
            secure: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7
          }
        }
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Get user's current workspace from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.current_workspace_id) {
      return NextResponse.json({
        success: false,
        error: 'No workspace found'
      }, { status: 404 })
    }

    // CRITICAL: Verify user is actually a member of this workspace
    // EXCEPTION: Super admins can access any workspace
    const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(user.email || '');

    if (!isSuperAdmin) {
      const { data: membership, error: membershipError } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', userData.current_workspace_id)
        .eq('user_id', user.id)
        .single()

      if (membershipError || !membership) {
        return NextResponse.json({
          success: false,
          error: 'Access denied - not a workspace member'
        }, { status: 403 })
      }
    }

    // Get workspace details
    // For super admins, use admin client to bypass RLS
    let workspace;
    let workspaceError;

    if (isSuperAdmin) {
      // Use service role key to bypass RLS for super admins
      const { createClient } = await import('@supabase/supabase-js');
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const result = await adminClient
        .from('workspaces')
        .select('id, name, company_name')
        .eq('id', userData.current_workspace_id)
        .single();
      workspace = result.data;
      workspaceError = result.error;
    } else {
      const result = await supabase
        .from('workspaces')
        .select('id, name, company_name')
        .eq('id', userData.current_workspace_id)
        .single();
      workspace = result.data;
      workspaceError = result.error;
    }

    if (workspaceError || !workspace) {
      return NextResponse.json({
        success: false,
        error: 'Workspace not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      workspace: {
        id: workspace.id,
        name: workspace.name || workspace.company_name || 'Unknown'
      }
    })

  } catch (error) {
    console.error('Current workspace API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
