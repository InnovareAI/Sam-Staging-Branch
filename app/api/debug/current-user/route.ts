import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/app/lib/supabase';

/**
 * GET /api/debug/current-user
 * Returns current user info and workspace info for debugging
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated',
        authError: authError?.message
      });
    }

    // Get user profile
    const adminClient = supabaseAdmin();
    const { data: userProfile } = await adminClient
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    // Get workspace memberships
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id);

    // Get workspace details
    let workspaceDetails = null;
    if (userProfile?.current_workspace_id) {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id, name, slug')
        .eq('id', userProfile.current_workspace_id)
        .single();
      workspaceDetails = workspace;
    }

    // Get sessions for this user
    const { data: sessions } = await supabase
      .from('prospect_approval_sessions')
      .select('id, campaign_name, total_prospects, pending_count, approved_count, workspace_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        current_workspace_id: userProfile?.current_workspace_id
      },
      workspace: workspaceDetails,
      memberships: memberships || [],
      sessions: sessions || [],
      sessionCount: sessions?.length || 0
    });

  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
