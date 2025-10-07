
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/route-auth';

export async function DELETE(request: NextRequest) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    const body = await request.json();
    const { workspaceIds } = body;

    if (!workspaceIds || !Array.isArray(workspaceIds) || workspaceIds.length === 0) {
      return NextResponse.json(
        { error: 'Workspace IDs array is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the request is from a super admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify the user making the request
    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    // Check if the user is a super admin
    const superAdminEmails = ['tl@innovareai.com', 'cl@innovareai.com'];
    if (!superAdminEmails.includes(user.email?.toLowerCase() || '')) {
      return NextResponse.json(
        { error: 'Super admin access required' },
        { status: 403 }
      );
    }

    // First, check which workspaces are protected - InnovareAI cannot be deleted
    const { data: workspacesToCheck, error: checkError } = await adminSupabase
      .from('workspaces')
      .select('id, name, slug')
      .in('id', workspaceIds);

    if (checkError) {
      console.error('Error checking workspaces:', checkError);
      return NextResponse.json(
        { error: 'Failed to check workspace permissions', details: checkError.message },
        { status: 500 }
      );
    }

    // Filter out protected workspaces (InnovareAI)
    const protectedWorkspaces = workspacesToCheck?.filter(ws => ws.slug === 'innovareai') || [];
    const deletableWorkspaceIds = workspaceIds.filter(id => 
      !protectedWorkspaces.some(protectedWs => protectedWs.id === id)
    );

    if (protectedWorkspaces.length > 0) {
      console.warn('Attempted to delete protected workspaces:', protectedWorkspaces.map(ws => ws.name));
      if (deletableWorkspaceIds.length === 0) {
        return NextResponse.json(
          { error: 'Cannot delete protected workspaces (InnovareAI)' },
          { status: 400 }
        );
      }
    }

    let deletedCount = 0;
    const errors: string[] = [];

    // Delete each workspace (this will cascade to related tables due to foreign key constraints)
    for (const workspaceId of deletableWorkspaceIds) {
      try {
        // Delete workspace members first
        const { error: memberError } = await adminSupabase
          .from('workspace_members')
          .delete()
          .eq('workspace_id', workspaceId);

        if (memberError) {
          console.error(`Failed to delete members for workspace ${workspaceId}:`, memberError);
        }

        // Delete workspace invitations
        const { error: inviteError } = await adminSupabase
          .from('workspace_invitations')
          .delete()
          .eq('workspace_id', workspaceId);

        if (inviteError) {
          console.error(`Failed to delete invitations for workspace ${workspaceId}:`, inviteError);
        }

        // Delete the workspace itself
        const { error: workspaceError } = await adminSupabase
          .from('workspaces')
          .delete()
          .eq('id', workspaceId);
        
        if (workspaceError) {
          console.error(`Failed to delete workspace ${workspaceId}:`, workspaceError);
          errors.push(`Failed to delete workspace ${workspaceId}: ${workspaceError.message}`);
        } else {
          deletedCount++;
          console.log(`Successfully deleted workspace ${workspaceId}`);
        }
      } catch (error) {
        console.error(`Error deleting workspace ${workspaceId}:`, error);
        errors.push(`Error deleting workspace ${workspaceId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const response: any = {
      success: true,
      deletedCount,
      totalRequested: workspaceIds.length,
      protectedSkipped: protectedWorkspaces.length
    };

    if (errors.length > 0) {
      response.errors = errors;
      response.partialSuccess = true;
    }

    if (protectedWorkspaces.length > 0) {
      response.skippedWorkspaces = protectedWorkspaces.map(ws => ({ 
        id: ws.id, 
        name: ws.name, 
        reason: 'Protected workspace cannot be deleted' 
      }));
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Delete workspaces error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
