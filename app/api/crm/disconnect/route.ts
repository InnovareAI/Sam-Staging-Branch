/**
 * CRM Disconnect API
 * Removes a CRM connection from a workspace
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, crm_type } = body;

    if (!workspace_id || !crm_type) {
      return NextResponse.json(
        { error: 'workspace_id and crm_type required' },
        { status: 400 }
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify workspace access (only owners/admins can disconnect)
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the CRM connection (cascade will delete field mappings)
    const { error: deleteError } = await supabase
      .from('crm_connections')
      .delete()
      .eq('workspace_id', workspace_id)
      .eq('crm_type', crm_type);

    if (deleteError) {
      console.error('Error disconnecting CRM:', deleteError);
      return NextResponse.json(
        { error: 'Failed to disconnect CRM' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${crm_type} disconnected successfully`
    });

  } catch (error) {
    console.error('CRM disconnect API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
