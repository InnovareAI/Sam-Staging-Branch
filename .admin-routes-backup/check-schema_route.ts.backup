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
        { error: 'Unauthorized', details: authError?.message },
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

    const results: any = {};

    try {
      // Check workspaces table schema
      const { data: workspacesSchema, error: workspacesError } = await adminSupabase
        .rpc('exec_sql', {
          query: `SELECT column_name, data_type, is_nullable, column_default 
                  FROM information_schema.columns 
                  WHERE table_name = 'workspaces' 
                  ORDER BY ordinal_position;`
        });

      results.workspaces_schema = {
        exists: !workspacesError,
        error: workspacesError?.message,
        columns: workspacesSchema || []
      };
    } catch (error) {
      results.workspaces_schema = {
        exists: false,
        error: 'Failed to query schema'
      };
    }

    try {
      // Check workspace_members table
      const { data: membersSchema, error: membersError } = await adminSupabase
        .rpc('exec_sql', {
          query: `SELECT column_name, data_type, is_nullable 
                  FROM information_schema.columns 
                  WHERE table_name = 'workspace_members' 
                  ORDER BY ordinal_position;`
        });

      results.workspace_members_schema = {
        exists: !membersError,
        error: membersError?.message,
        columns: membersSchema || []
      };
    } catch (error) {
      results.workspace_members_schema = {
        exists: false,
        error: 'Failed to query members schema'
      };
    }

    try {
      // Try to query workspaces table directly
      const { data: workspaceData, error: workspaceQueryError } = await adminSupabase
        .from('workspaces')
        .select('id, name, company, owner_id, created_at')
        .limit(5);

      results.workspaces_query = {
        success: !workspaceQueryError,
        error: workspaceQueryError?.message,
        sample_data: workspaceData || [],
        count: workspaceData?.length || 0
      };
    } catch (error) {
      results.workspaces_query = {
        success: false,
        error: 'Failed to query workspaces table'
      };
    }

    try {
      // Check if workspace_members exists
      const { data: membersData, error: membersQueryError } = await adminSupabase
        .from('workspace_members')
        .select('id, user_id, workspace_id, role')
        .limit(5);

      results.workspace_members_query = {
        success: !membersQueryError,
        error: membersQueryError?.message,
        sample_data: membersData || [],
        count: membersData?.length || 0
      };
    } catch (error) {
      results.workspace_members_query = {
        success: false,
        error: 'Failed to query workspace_members table'
      };
    }

    return NextResponse.json({
      message: 'Schema check completed',
      user_email: user.email,
      timestamp: new Date().toISOString(),
      results
    });

  } catch (error) {
    console.error('Schema check error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}