
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

    const { name = 'Test Workspace', company = 'InnovareAI' } = await request.json();

    // Generate slug from workspace name
    const generateSlug = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50) + '-' + Date.now().toString(36);
    };

    const slug = generateSlug(name);

    // Test workspace creation
    const { data, error } = await adminSupabase
      .from('workspaces')
      .insert({
        name: name,
        slug: slug,
        owner_id: user.id,
        created_by: user.id,
        company: company,
        settings: {}
      })
      .select()
      .single();

    if (error) {
      console.error('Workspace creation error:', error);
      return NextResponse.json(
        { 
          error: 'Failed to create workspace', 
          details: error.message,
          hint: error.hint,
          code: error.code
        },
        { status: 500 }
      );
    }

    // Add owner as workspace member
    const { error: memberError } = await adminSupabase
      .from('workspace_members')
      .insert({
        workspace_id: data.id,
        user_id: user.id,
        role: 'owner'
      });

    if (memberError) {
      console.error('Workspace member error:', memberError);
      return NextResponse.json(
        { 
          error: 'Workspace created but failed to add member', 
          details: memberError.message,
          workspaceId: data.id
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Test workspace created successfully',
      workspace: {
        id: data.id,
        name: data.name,
        company: data.company,
        owner_id: data.owner_id
      }
    });

  } catch (error) {
    console.error('Server error creating test workspace:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
