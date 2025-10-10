import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/app/lib/supabase';

/**
 * PATCH /api/prospect-approval/sessions/update-campaign
 * Update campaign name for an approval session
 */
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const { session_id, campaign_name } = await request.json();

    if (!session_id || !campaign_name) {
      return NextResponse.json({
        success: false,
        error: 'Session ID and campaign name required'
      }, { status: 400 });
    }

    // Get user's workspace using admin client to bypass RLS
    const adminClient = supabaseAdmin();
    const { data: userProfile } = await adminClient
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    const workspaceId = userProfile?.current_workspace_id;

    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'No workspace found'
      }, { status: 404 });
    }

    // Verify session belongs to user's workspace
    const { data: session } = await supabase
      .from('prospect_approval_sessions')
      .select('workspace_id')
      .eq('id', session_id)
      .single();

    if (!session || session.workspace_id !== workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'Session not found or access denied'
      }, { status: 403 });
    }

    // Update campaign name
    const { error: updateError } = await supabase
      .from('prospect_approval_sessions')
      .update({ campaign_name })
      .eq('id', session_id);

    if (updateError) {
      console.error('Error updating campaign name:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Failed to update campaign name'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      campaign_name
    });

  } catch (error) {
    console.error('Update campaign name error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
