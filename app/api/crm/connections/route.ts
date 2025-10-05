/**
 * CRM Connections API
 * Lists all CRM connections for a workspace
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify workspace access
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all CRM connections for workspace
    const { data: connections, error } = await supabase
      .from('crm_connections')
      .select('id, crm_type, status, crm_account_name, connected_at, last_synced_at')
      .eq('workspace_id', workspaceId)
      .order('connected_at', { ascending: false });

    if (error) {
      console.error('Error fetching CRM connections:', error);
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
    }

    return NextResponse.json({ connections: connections || [] });

  } catch (error) {
    console.error('CRM connections API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
