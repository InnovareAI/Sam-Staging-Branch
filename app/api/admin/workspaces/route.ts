import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Super admin emails
const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];

export async function GET(request: NextRequest) {
  try {
    // Get auth header for admin verification
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Also create client with user context for verification
    const userSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the requesting user is authenticated and has admin rights
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is super admin
    if (!SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
      return NextResponse.json(
        { error: 'Forbidden - Super admin access required' },
        { status: 403 }
      );
    }

    // Fetch all workspaces with member information
    const { data: workspaces, error } = await adminSupabase
      .from('workspaces')
      .select(`
        id,
        name,
        slug,
        owner_id,
        created_at,
        updated_at,
        settings,
        workspace_members (
          id,
          user_id,
          role,
          joined_at
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch workspaces:', error);
      return NextResponse.json(
        { error: 'Failed to fetch workspaces' },
        { status: 500 }
      );
    }

    // Get user information for workspace owners
    const ownerIds = [...new Set(workspaces?.map(w => w.owner_id).filter(Boolean))];
    const { data: users } = await adminSupabase
      .from('users')
      .select('id, email, first_name, last_name')
      .in('id', ownerIds);

    const userMap = new Map(users?.map(u => [u.id, u]) || []);

    // Enrich workspaces with owner information
    const enrichedWorkspaces = workspaces?.map(workspace => ({
      ...workspace,
      owner: userMap.get(workspace.owner_id),
      member_count: workspace.workspace_members?.length || 0
    })) || [];

    return NextResponse.json({
      workspaces: enrichedWorkspaces,
      total: enrichedWorkspaces.length
    });

  } catch (error) {
    console.error('Server error fetching workspaces:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}