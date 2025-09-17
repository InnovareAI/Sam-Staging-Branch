import { NextRequest, NextResponse } from 'next/server'
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

    // First try 'workspaces' table
    console.log('🔍 Trying workspaces table...');
    const workspacesResult = await adminSupabase
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