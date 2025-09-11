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

    // SuperAdmin can see ALL workspaces in the display
    // But invitation restrictions are handled in the InviteUserPopup component
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
      .order('created_at', { ascending: false });  // Show newest first

    if (error) {
      console.error('Failed to fetch workspaces:', error);
      return NextResponse.json(
        { error: 'Failed to fetch workspaces' },
        { status: 500 }
      );
    }

    // Get all unique user IDs (owners + members)
    const ownerIds = [...new Set(workspaces?.map(w => w.owner_id).filter(Boolean))];
    const memberIds = [...new Set(workspaces?.flatMap(w => 
      w.workspace_members?.map(m => m.user_id) || []
    ))];
    const allUserIds = [...new Set([...ownerIds, ...memberIds])];

    // Fetch user information from auth.users
    const userMap = new Map();
    if (allUserIds.length > 0) {
      try {
        // Fetch users in batches to avoid hitting limits
        const batchSize = 50;
        for (let i = 0; i < allUserIds.length; i += batchSize) {
          const batch = allUserIds.slice(i, i + batchSize);
          const { data: batchUsers } = await adminSupabase.auth.admin.listUsers();
          
          if (batchUsers?.users) {
            batchUsers.users
              .filter((user: any) => batch.includes(user.id))
              .forEach((user: any) => {
                userMap.set(user.id, {
                  id: user.id,
                  email: user.email,
                  first_name: user.user_metadata?.first_name,
                  last_name: user.user_metadata?.last_name
                });
              });
          }
        }
      } catch (error) {
        console.error('Error fetching user details:', error);
      }
    }

    // Enrich workspaces with owner and member information
    const enrichedWorkspaces = workspaces?.map(workspace => ({
      ...workspace,
      owner: userMap.get(workspace.owner_id),
      workspace_members: workspace.workspace_members?.map(member => ({
        ...member,
        user: userMap.get(member.user_id)
      })) || [],
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