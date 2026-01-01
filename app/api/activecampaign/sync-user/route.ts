import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { activeCampaignService } from '@/lib/activecampaign';

/**
 * POST /api/activecampaign/sync-user
 *
 * Syncs a new user to ActiveCampaign onboarding list
 * ONLY for users in InnovareAI workspaces
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, current_workspace_id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user's workspace to check reseller
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name, tenant')
      .eq('id', user.current_workspace_id)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // ONLY sync if workspace tenant is InnovareAI
    if (workspace.tenant !== 'innovareai') {
      return NextResponse.json({
        skipped: true,
        reason: `User belongs to ${workspace.tenant} workspace, not InnovareAI`,
        workspace: workspace.name,
        tenant: workspace.tenant
      });
    }

    // Sync to ActiveCampaign with InnovareAI tag
    const result = await activeCampaignService.addSamUserToList(
      user.email,
      user.first_name || '',
      user.last_name || '',
      'InnovareAI'
    );

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to sync to ActiveCampaign', details: result.error },
        { status: 500 }
      );
    }

    console.log(`✅ Synced InnovareAI user to ActiveCampaign: ${user.email}`);

    return NextResponse.json({
      success: true,
      user: {
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      },
      workspace: {
        name: workspace.name,
        tenant: workspace.tenant
      },
      activecampaign: {
        contactId: result.contactId,
        listId: result.listId,
        tagId: result.tagId,
        company: result.company
      }
    });

  } catch (error) {
    console.error('ActiveCampaign sync error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
