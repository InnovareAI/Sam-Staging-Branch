import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Super admin emails
const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];

export async function POST(request: NextRequest) {
  try {
    // Get auth header for admin verification
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    // Create Supabase client with service role - BYPASSES ALL RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Also create client with user context for verification
    const userSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the requesting user is authenticated
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message },
        { status: 401 }
      );
    }

    const { name, company = 'InnovareAI' } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Workspace name is required' },
        { status: 400 }
      );
    }

    // Use service role to BYPASS ALL RLS and schema issues
    const { data: workspace, error: workspaceError } = await adminSupabase
      .from('workspaces')
      .insert({
        name: name,
        owner_id: user.id,
        created_by: user.id,
        company: company,
        settings: {}
      })
      .select()
      .single();

    if (workspaceError) {
      console.error('Service role workspace creation failed:', workspaceError);
      
      // If even service role fails due to missing columns, try minimal
      const { data: minimalWorkspace, error: minimalError } = await adminSupabase
        .from('workspaces')
        .insert({
          name: name,
          owner_id: user.id
        })
        .select()
        .single();

      if (minimalError) {
        return NextResponse.json(
          { 
            error: 'Failed to create workspace', 
            details: minimalError.message,
            hint: 'Database table may not exist or have required columns'
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Workspace created with minimal schema',
        workspace: {
          id: minimalWorkspace.id,
          name: minimalWorkspace.name,
          owner_id: minimalWorkspace.owner_id
        }
      });
    }

    // Successfully created with full schema
    return NextResponse.json({
      success: true,
      message: 'Workspace created successfully',
      workspace: {
        id: workspace.id,
        name: workspace.name,
        company: workspace.company,
        owner_id: workspace.owner_id,
        created_by: workspace.created_by
      }
    });

  } catch (error) {
    console.error('Server error creating workspace:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}