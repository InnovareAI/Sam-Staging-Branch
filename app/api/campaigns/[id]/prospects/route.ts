import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaignId = params.id;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Verify campaign exists and user has access
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('workspace_id')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Build query for campaign prospects
    let query = supabase
      .from('campaign_prospects')
      .select(`
        *,
        workspace_prospects (
          id,
          email_address,
          linkedin_profile_url,
          full_name,
          first_name,
          last_name,
          job_title,
          company_name,
          location,
          prospect_status,
          contact_count,
          last_contacted_at
        )
      `)
      .eq('campaign_id', campaignId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: prospects, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Failed to fetch campaign prospects:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch campaign prospects' 
      }, { status: 500 });
    }

    // Get total count
    const { count, error: countError } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);

    return NextResponse.json({ 
      prospects: prospects || [],
      total: count || 0,
      limit,
      offset
    });

  } catch (error: any) {
    console.error('Campaign prospects fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign prospects', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaignId = params.id;
    const { prospect_ids } = await req.json();

    if (!prospect_ids || !Array.isArray(prospect_ids)) {
      return NextResponse.json({ 
        error: 'prospect_ids array is required' 
      }, { status: 400 });
    }

    // Verify campaign exists and user has access
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('workspace_id')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Verify all prospects exist in the workspace
    const { data: existingProspects, error: prospectsError } = await supabase
      .from('workspace_prospects')
      .select('id')
      .eq('workspace_id', campaign.workspace_id)
      .in('id', prospect_ids);

    if (prospectsError) {
      console.error('Failed to verify prospects:', prospectsError);
      return NextResponse.json({ 
        error: 'Failed to verify prospects' 
      }, { status: 500 });
    }

    const validProspectIds = existingProspects?.map(p => p.id) || [];
    const invalidIds = prospect_ids.filter(id => !validProspectIds.includes(id));

    if (invalidIds.length > 0) {
      return NextResponse.json({ 
        error: 'Some prospect IDs are invalid',
        invalid_ids: invalidIds 
      }, { status: 400 });
    }

    // Add prospects to campaign (with conflict handling)
    const campaignProspects = prospect_ids.map(prospectId => ({
      campaign_id: campaignId,
      prospect_id: prospectId,
      status: 'pending',
      created_at: new Date().toISOString()
    }));

    const { data: addedProspects, error: insertError } = await supabase
      .from('campaign_prospects')
      .upsert(campaignProspects, { 
        onConflict: 'campaign_id,prospect_id',
        ignoreDuplicates: true 
      })
      .select();

    if (insertError) {
      console.error('Failed to add prospects to campaign:', insertError);
      return NextResponse.json({ 
        error: 'Failed to add prospects to campaign',
        details: insertError.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Prospects added to campaign successfully',
      added_prospects: addedProspects?.length || 0,
      total_requested: prospect_ids.length
    }, { status: 201 });

  } catch (error: any) {
    console.error('Add prospects to campaign error:', error);
    return NextResponse.json(
      { error: 'Failed to add prospects to campaign', details: error.message },
      { status: 500 }
    );
  }
}