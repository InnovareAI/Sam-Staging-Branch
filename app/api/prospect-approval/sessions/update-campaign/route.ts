import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/app/lib/supabase';

/**
 * PATCH /api/prospect-approval/sessions/update-campaign
 * Update campaign name for an approval session
 */
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // Use @supabase/ssr createServerClient (matches browser client)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          }
        }
      }
    );

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const { session_id, campaign_name, campaign_id } = await request.json();

    if (!session_id) {
      return NextResponse.json({
        success: false,
        error: 'Session ID required'
      }, { status: 400 });
    }

    if (!campaign_name && !campaign_id) {
      return NextResponse.json({
        success: false,
        error: 'Campaign name or campaign ID required'
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

    // Build update object with provided fields
    const updateData: { campaign_name?: string; campaign_id?: string } = {};
    if (campaign_name) updateData.campaign_name = campaign_name;
    if (campaign_id) updateData.campaign_id = campaign_id;

    // Update session
    const { error: updateError } = await supabase
      .from('prospect_approval_sessions')
      .update(updateData)
      .eq('id', session_id);

    if (updateError) {
      console.error('Error updating session:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Failed to update session'
      }, { status: 500 });
    }

    console.log(`✅ Updated session ${session_id}:`, updateData);

    return NextResponse.json({
      success: true,
      campaign_name,
      campaign_id
    });

  } catch (error) {
    console.error('Update campaign name error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
