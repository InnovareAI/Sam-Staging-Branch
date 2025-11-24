import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

/**
 * POST /api/campaigns/[id]/add-prospects-direct
 *
 * EMERGENCY BYPASS: Add prospects directly to campaign without approval flow
 *
 * This endpoint bypasses the broken prospect approval system and directly
 * inserts prospects into campaign_prospects table.
 *
 * Body: {
 *   prospects: Array<{
 *     first_name: string
 *     last_name: string
 *     email: string
 *     company_name?: string
 *     title?: string
 *     location?: string
 *   }>
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id;
    const supabase = await createSupabaseRouteClient();

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const body = await request.json();
    const { prospects } = body;

    if (!prospects || !Array.isArray(prospects) || prospects.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'prospects array is required and must not be empty'
      }, { status: 400 });
    }

    // Get campaign and verify access
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, workspace_id, created_by')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({
        success: false,
        error: 'Campaign not found'
      }, { status: 404 });
    }

    // Verify workspace membership
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', campaign.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({
        success: false,
        error: 'Not a member of this workspace'
      }, { status: 403 });
    }

    // Transform prospects to campaign_prospects format
    const campaignProspects = prospects.map(prospect => ({
      campaign_id: campaignId,
      workspace_id: campaign.workspace_id,
      first_name: prospect.first_name || 'Unknown',
      last_name: prospect.last_name || 'Unknown',
      email: prospect.email,
      company_name: prospect.company_name || '',
      title: prospect.title || '',
      location: prospect.location || null,
      industry: 'Not specified',
      status: 'pending',
      notes: null,
      linkedin_url: null,
      linkedin_user_id: null,
      added_by_unipile_account: null,
      personalization_data: {
        source: 'direct_upload',
        added_at: new Date().toISOString()
      }
    }));

    // Insert into campaign_prospects
    const { data: insertedProspects, error: insertError } = await supabase
      .from('campaign_prospects')
      .insert(campaignProspects)
      .select();

    if (insertError) {
      console.error('Error inserting prospects:', insertError);
      return NextResponse.json({
        success: false,
        error: 'Failed to add prospects to campaign',
        details: insertError.message
      }, { status: 500 });
    }

    console.log(`✅ BYPASS: Inserted ${insertedProspects.length} prospects directly to campaign ${campaignId}`);

    return NextResponse.json({
      success: true,
      message: `Added ${insertedProspects.length} prospects to campaign`,
      added_count: insertedProspects.length,
      prospects: insertedProspects
    });

  } catch (error) {
    console.error('Add prospects direct error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
