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
    // Note: campaign_prospects has all prospect data directly (first_name, last_name, etc.)
    let query = supabase
      .from('campaign_prospects')
      .select('*')
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

    // Map company_name to company for frontend compatibility
    const mappedProspects = (prospects || []).map(p => ({
      ...p,
      company: p.company_name || p.company || null
    }));

    // Get total count
    const { count, error: countError } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);

    return NextResponse.json({
      prospects: mappedProspects,
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
    const body = await req.json();

    // Verify campaign exists and user has access
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('workspace_id')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Handle two modes: prospect_ids (existing prospects) or prospects (new prospect data)
    if (body.prospect_ids && Array.isArray(body.prospect_ids)) {
      // Mode 1: Add existing workspace prospects to campaign
      const { prospect_ids } = body;

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

    } else if (body.prospects && Array.isArray(body.prospects)) {
      // Mode 2: Create new prospects directly in campaign_prospects table
      const { prospects } = body;

      if (prospects.length === 0) {
        return NextResponse.json({
          error: 'prospects array cannot be empty'
        }, { status: 400 });
      }

      // CRITICAL: Check if any prospects are already in active campaigns
      const linkedinUrls = prospects
        .map(p => p.linkedin_url || p.linkedin_profile_url || p.contact?.linkedin_url)
        .filter(Boolean)
        .map(url => url.toLowerCase().trim().replace(/\/$/, ''))

      const emails = prospects
        .map(p => p.email)
        .filter(Boolean)
        .map(email => email.toLowerCase().trim())

      if (linkedinUrls.length > 0 || emails.length > 0) {
        const { data: existingProspects } = await supabase
          .from('campaign_prospects')
          .select(`
            id,
            first_name,
            last_name,
            linkedin_url,
            email,
            status,
            campaign_id,
            campaigns!inner(name, status)
          `)
          .eq('workspace_id', campaign.workspace_id)
          .neq('campaign_id', campaignId)
          .in('status', ['pending', 'approved', 'ready_to_message', 'queued_in_n8n', 'connection_requested', 'connected', 'messaging'])
          .or(`linkedin_url.in.(${linkedinUrls.length > 0 ? linkedinUrls.map(u => `"${u}"`).join(',') : '""'}),email.in.(${emails.length > 0 ? emails.map(e => `"${e}"`).join(',') : '""'})`)

        const conflictingProspects = (existingProspects || []).filter(p => {
          return p.campaigns?.status === 'active' || p.campaigns?.status === 'draft'
        })

        if (conflictingProspects.length > 0) {
          const conflictDetails = conflictingProspects.map(p => ({
            name: `${p.first_name} ${p.last_name}`,
            linkedin_url: p.linkedin_url,
            current_campaign: p.campaigns?.name || 'Unknown',
            status: p.status
          }))

          return NextResponse.json({
            error: 'campaign_conflict',
            message: `${conflictingProspects.length} prospect(s) are already in active campaigns. Remove them from existing campaigns before adding to this one.`,
            conflicts: conflictDetails
          }, { status: 409 })
        }
      }

      // Insert prospects directly into campaign_prospects
      const campaignProspects = prospects.map(prospect => ({
        campaign_id: campaignId,
        first_name: prospect.first_name || '',
        last_name: prospect.last_name || '',
        email: prospect.email || null,
        company_name: prospect.company_name || null,
        linkedin_url: prospect.linkedin_url || prospect.linkedin_profile_url || prospect.contact?.linkedin_url || null,
        title: prospect.title || null,
        phone: prospect.phone || null,
        location: prospect.location || null,
        industry: prospect.industry || null,
        status: prospect.status || 'approved',
        personalization_data: prospect.personalization_data || {},
        created_at: new Date().toISOString()
      }));

      const { data: addedProspects, error: insertError } = await supabase
        .from('campaign_prospects')
        .insert(campaignProspects)
        .select();

      if (insertError) {
        console.error('Failed to add prospects to campaign:', insertError);
        return NextResponse.json({
          error: 'Failed to add prospects to campaign',
          details: insertError.message
        }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Prospects created and added to campaign successfully',
        added_prospects: addedProspects?.length || 0,
        total_requested: prospects.length
      }, { status: 201 });

    } else {
      return NextResponse.json({
        error: 'Either prospect_ids or prospects array is required'
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Add prospects to campaign error:', error);
    return NextResponse.json(
      { error: 'Failed to add prospects to campaign', details: error.message },
      { status: 500 }
    );
  }
}