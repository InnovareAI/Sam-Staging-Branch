import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * DELETE /api/prospect-approval/remove-from-campaign
 *
 * Remove a prospect from an existing campaign
 * Used when user wants to move a duplicate prospect to a new campaign
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaign_id');
    const identifier = searchParams.get('identifier'); // linkedin_url OR email
    const identifierType = searchParams.get('type'); // 'linkedin' OR 'email'

    if (!campaignId || !identifier || !identifierType) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: campaign_id, identifier, type'
      }, { status: 400 });
    }

    // Get authenticated user
    const cookieStore = await cookies();
    const authClient = createServerClient(
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

    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Verify user has access to this campaign's workspace
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('workspace_id')
      .eq('id', campaignId)
      .single();

    if (!campaign) {
      return NextResponse.json({
        success: false,
        error: 'Campaign not found'
      }, { status: 404 });
    }

    const { data: member } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', campaign.workspace_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!member) {
      return NextResponse.json({
        success: false,
        error: 'You do not have access to this workspace'
      }, { status: 403 });
    }

    // Remove prospect from campaign_prospects table
    let deleteQuery = supabase
      .from('campaign_prospects')
      .delete()
      .eq('campaign_id', campaignId);

    if (identifierType === 'linkedin') {
      deleteQuery = deleteQuery.eq('linkedin_url', identifier);
    } else if (identifierType === 'email') {
      deleteQuery = deleteQuery.eq('email', identifier);
    }

    const { error: deleteError, count } = await deleteQuery;

    if (deleteError) {
      console.error('Error removing prospect from campaign:', deleteError);
      return NextResponse.json({
        success: false,
        error: 'Failed to remove prospect from campaign'
      }, { status: 500 });
    }

    console.log(`✅ Removed prospect (${identifierType}: ${identifier}) from campaign ${campaignId}`);

    return NextResponse.json({
      success: true,
      message: 'Prospect removed from campaign successfully',
      removed_count: count || 0
    });

  } catch (error) {
    console.error('Remove from campaign error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
