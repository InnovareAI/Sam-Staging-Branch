import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const icpId = params.id;
    const updates = await request.json();

    console.log('[ICP Update] Updating ICP:', icpId, 'with:', JSON.stringify(updates, null, 2));

    // Verify user has access to this ICP
    const { data: icp, error: fetchError } = await supabase
      .from('icp_configurations')
      .select('workspace_id')
      .eq('id', icpId)
      .single();

    if (fetchError || !icp) {
      console.error('[ICP Update] ICP not found:', fetchError);
      return NextResponse.json({ error: 'ICP not found' }, { status: 404 });
    }

    // Verify workspace access
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('workspace_id', icp.workspace_id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Update ICP
    const { data: updated, error: updateError } = await supabase
      .from('icp_configurations')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', icpId)
      .select()
      .single();

    if (updateError) {
      console.error('[ICP Update] Update failed:', updateError);
      return NextResponse.json({
        error: 'Failed to update ICP',
        details: updateError.message
      }, { status: 500 });
    }

    console.log('[ICP Update] Successfully updated ICP:', icpId);

    return NextResponse.json({
      success: true,
      icp: updated
    });

  } catch (error) {
    console.error('[ICP Update] Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const icpId = params.id;

    const { data: icp, error: fetchError } = await supabase
      .from('icp_configurations')
      .select('*')
      .eq('id', icpId)
      .single();

    if (fetchError || !icp) {
      return NextResponse.json({ error: 'ICP not found' }, { status: 404 });
    }

    // Verify workspace access
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('workspace_id', icp.workspace_id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      icp
    });

  } catch (error) {
    console.error('[ICP GET] Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
