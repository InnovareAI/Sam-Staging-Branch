
import { createClient } from '@supabase/supabase-js';
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

    const { userId, workspaceId, role = 'member' } = await request.json();

    // Validate input
    if (!userId || !workspaceId) {
      return NextResponse.json(
        { error: 'User ID and Workspace ID are required' },
        { status: 400 }
      );
    }

    // Validate role
    if (!['owner', 'admin', 'member', 'viewer'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be: owner, admin, member, or viewer' },
        { status: 400 }
      );
    }

    console.log('Admin reassigning user workspace:', { 
      userId, 
      workspaceId, 
      role, 
      adminEmail: user.email,
      adminId: user.id 
    });

    // Call the Supabase function for workspace reassignment with history loss
    const { data: result, error: functionError } = await adminSupabase.rpc('reassign_user_workspace', {
      target_user_id: userId,
      target_workspace_id: workspaceId,
      new_role: role,
      admin_user_id: user.id
    });

    if (functionError) {
      console.error('Workspace reassignment function error:', functionError);
      return NextResponse.json(
        { error: 'Failed to reassign user workspace: ' + functionError.message },
        { status: 500 }
      );
    }

    // Check if the function returned an error
    if (!result?.success) {
      console.error('Workspace reassignment failed:', result?.error);
      return NextResponse.json(
        { error: result?.error || 'Failed to reassign user workspace' },
        { status: 400 }
      );
    }

    console.log('✅ User workspace reassigned successfully:', result);
    
    return NextResponse.json({
      success: true,
      message: result.message,
      data: {
        action: result.action,
        user_id: result.user_id,
        user_email: result.user_email,
        previous_workspace_id: result.previous_workspace_id,
        new_workspace_id: result.new_workspace_id,
        workspace_name: result.workspace_name,
        new_role: result.new_role,
        history_deleted: result.history_deleted,
        reassigned_at: result.reassigned_at,
        reassigned_by: result.reassigned_by
      }
    });

  } catch (error) {
    console.error('Admin workspace reassignment API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during workspace reassignment' },
      { status: 500 }
    );
  }
}
