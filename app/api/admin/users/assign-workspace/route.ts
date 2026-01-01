
import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/route-auth';

// Super admin emails
const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];

export async function POST(request: NextRequest) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
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
    const poolKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, poolKey);

    // Also create client with user context for verification
    // Pool imported from lib/db
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

    const { userId, workspaceId, role = 'member' } = await request.json();

    // Validate input
    if (!userId || !workspaceId) {
      return NextResponse.json(
        { error: 'User ID and Workspace ID are required' },
        { status: 400 }
      );
    }

    console.log('Admin assigning user to workspace:', { userId, workspaceId, role, adminEmail: user.email });

    // Check if user exists
    const { data: users, error: userError } = await adminSupabase.auth.admin.listUsers();
    if (userError) {
      console.error('Error checking users:', userError);
      return NextResponse.json(
        { error: 'Failed to verify user exists' },
        { status: 500 }
      );
    }
    
    const userExists = users?.users?.find((u: any) => u.id === userId);
    if (!userExists) {
      return NextResponse.json(
        { error: 'User not found in system' },
        { status: 404 }
      );
    }

    // Check if workspace exists
    const { data: workspace, error: workspaceError } = await adminSupabase
      .from('workspaces')
      .select('id, name, slug')
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Check if user is already a member of this workspace
    const { data: existingMembership, error: membershipCheckError } = await adminSupabase
      .from('workspace_members')
      .select('id, role')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single();

    if (membershipCheckError && membershipCheckError.code !== 'PGRST116') {
      console.error('Error checking existing membership:', membershipCheckError);
      return NextResponse.json(
        { error: 'Failed to check existing membership' },
        { status: 500 }
      );
    }

    if (existingMembership) {
      // Update existing membership role
      const { error: updateError } = await adminSupabase
        .from('workspace_members')
        .update({ 
          role,
          joined_at: new Date().toISOString() // Update join date to reflect re-assignment
        })
        .eq('id', existingMembership.id);

      if (updateError) {
        console.error('Error updating workspace membership:', updateError);
        return NextResponse.json(
          { error: 'Failed to update workspace membership' },
          { status: 500 }
        );
      }

      console.log('✅ Updated existing workspace membership:', { userId, workspaceId, role });
      return NextResponse.json({
        success: true,
        message: `User role updated to ${role} in workspace ${workspace.name}`,
        action: 'updated'
      });
    } else {
      // Create new membership
      const { error: insertError } = await adminSupabase
        .from('workspace_members')
        .insert({
          user_id: userId,
          workspace_id: workspaceId,
          role,
          joined_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error creating workspace membership:', insertError);
        return NextResponse.json(
          { error: 'Failed to assign user to workspace' },
          { status: 500 }
        );
      }

      console.log('✅ Created new workspace membership:', { userId, workspaceId, role });
      return NextResponse.json({
        success: true,
        message: `User assigned as ${role} to workspace ${workspace.name}`,
        action: 'assigned'
      });
    }

  } catch (error) {
    console.error('Admin workspace assignment API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during workspace assignment' },
      { status: 500 }
    );
  }
}
