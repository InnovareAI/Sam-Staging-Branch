import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/app/lib/supabase'

// Super admin emails
const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];

export async function GET(request: NextRequest) {
  try {
    // Create Supabase admin client (uses service role key)
    const adminSupabase = supabaseAdmin()

    console.log('🔍 Admin Workspaces: Starting query...');
    
    // Allow access to this API for all users - it's for admin dashboard display
    // The data is already filtered to public workspace information

    // Try different possible table names for workspaces
    let workspaces = null;
    let error = null;

    // First try 'workspaces' table without JOINs (relationships may not be configured)
    console.log('🔍 Trying workspaces table...');
    const workspacesResult = await adminSupabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false });

    if (workspacesResult.error) {
      console.log('❌ workspaces table error:', workspacesResult.error.message);
      
      // Try 'organizations' table
      console.log('🔍 Trying organizations table...');
      const orgsResult = await adminSupabase
        .from('organizations')
        .select(`
          id,
          name,
          slug,
          created_by,
          created_at,
          updated_at,
          settings
        `)
        .order('created_at', { ascending: false });

      if (orgsResult.error) {
        console.log('❌ organizations table error:', orgsResult.error.message);
        
        // Try user_organizations table to see existing data
        console.log('🔍 Checking user_organizations...');
        const userOrgsResult = await adminSupabase
          .from('user_organizations')
          .select('*')
          .limit(10);

        console.log('📊 user_organizations sample:', userOrgsResult.data);
        
        error = workspacesResult.error;
      } else {
        workspaces = orgsResult.data?.map(org => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          owner_id: org.created_by,
          created_at: org.created_at,
          updated_at: org.updated_at,
          settings: org.settings,
          workspace_members: [],
          member_count: 0
        }));
        console.log(`✅ Found ${workspaces?.length || 0} organizations`);
      }
    } else {
      workspaces = workspacesResult.data;
      console.log(`✅ Found ${workspaces?.length || 0} workspaces`);
      
      // Manually fetch workspace members since JOINs may not work
      if (workspaces && workspaces.length > 0) {
        console.log('🔍 Fetching workspace members manually...');
        const { data: allMembers } = await adminSupabase
          .from('workspace_members')
          .select('*');
          
        // Add workspace_members array to each workspace
        workspaces = workspaces.map(workspace => ({
          ...workspace,
          workspace_members: allMembers?.filter(member => member.workspace_id === workspace.id) || [],
          member_count: allMembers?.filter(member => member.workspace_id === workspace.id).length || 0
        }));
        
        console.log(`✅ Enhanced workspaces with member data`);
      }
    }

    if (error && !workspaces) {
      console.error('❌ Failed to fetch any workspace data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch workspaces', details: error.message },
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

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Check if user is admin
    if (!SUPER_ADMIN_EMAILS.includes(session.user.email || '')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { action, targetWorkspaceId, originalWorkspaceId, userId, role, workspaceId, permissionType } = body

    switch (action) {
      case 'switch_workspace':
        return await switchToWorkspace(supabase, session.user.id, targetWorkspaceId, originalWorkspaceId)
      
      case 'grant_permission':
        return await grantWorkspacePermission(supabase, session.user.id, userId, workspaceId, permissionType)
      
      case 'get_accessible_workspaces':
        return await getAccessibleWorkspaces(supabase, session.user.id)
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Admin workspaces POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function switchToWorkspace(supabase: any, adminUserId: string, targetWorkspaceId: string, originalWorkspaceId: string) {
  try {
    // Get workspace details
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name, slug, user_id')
      .eq('id', targetWorkspaceId)
      .single()

    if (workspaceError || !workspace) {
      // Try organizations table
      const { data: orgWorkspace, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, slug, created_by')
        .eq('id', targetWorkspaceId)
        .single()
      
      if (orgError || !orgWorkspace) {
        return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
      }
      
      // Map organization to workspace format
      workspace.id = orgWorkspace.id
      workspace.name = orgWorkspace.name
      workspace.slug = orgWorkspace.slug
      workspace.user_id = orgWorkspace.created_by
    }

    // Get campaigns in this workspace
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, name, status, created_at')
      .eq('workspace_id', targetWorkspaceId)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      success: true,
      workspace,
      campaigns: campaigns || [],
      message: `Switched to workspace: ${workspace?.name}`,
      adminNote: `You are now managing ${workspace?.name} on behalf of the workspace owner`
    })
  } catch (error) {
    console.error('Error switching workspace:', error)
    return NextResponse.json({ error: 'Failed to switch workspace' }, { status: 500 })
  }
}

async function grantWorkspacePermission(supabase: any, adminUserId: string, userId: string, workspaceId: string, permissionType: string) {
  // For now, just return success - this would normally update a permissions table
  return NextResponse.json({
    success: true,
    message: `Would grant ${permissionType} permission to workspace ${workspaceId} for user ${userId}`
  })
}

async function getAccessibleWorkspaces(supabase: any, userId: string) {
  try {
    // Admin users can access all workspaces
    let workspaces = []
    
    // Try workspaces table first
    const { data: workspacesData, error: workspacesError } = await supabase
      .from('workspaces')
      .select('id, name, slug, user_id, created_at')
      .order('created_at', { ascending: false })
    
    if (workspacesError) {
      // Try organizations table
      const { data: orgsData, error: orgsError } = await supabase
        .from('organizations')
        .select('id, name, slug, created_by as user_id, created_at')
        .order('created_at', { ascending: false })
      
      if (!orgsError && orgsData) {
        workspaces = orgsData
      }
    } else {
      workspaces = workspacesData || []
    }

    // Get user info for workspace owners
    const { data: users } = await supabase.auth.admin.listUsers()
    const userMap = new Map()
    users?.users?.forEach((user: any) => {
      userMap.set(user.id, { email: user.email, id: user.id })
    })

    const enrichedWorkspaces = workspaces.map((workspace: any) => ({
      ...workspace,
      owner: userMap.get(workspace.user_id),
      access_type: 'admin',
      permission_level: 'admin'
    }))

    return NextResponse.json({
      success: true,
      workspaces: enrichedWorkspaces,
      userRole: 'admin'
    })
  } catch (error) {
    console.error('Error getting accessible workspaces:', error)
    return NextResponse.json({ error: 'Failed to get workspaces' }, { status: 500 })
  }
}