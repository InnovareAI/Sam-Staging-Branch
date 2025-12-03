import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/prospects/add-to-campaign
 *
 * Transfer approved prospects from workspace_prospects to campaign_prospects.
 * This is the final step after approval - prospects are added to a campaign.
 *
 * Features:
 * - Validates prospects are approved
 * - Checks for active campaign constraint (prospect can only be in one active campaign)
 * - Creates campaign_prospects records with master_prospect_id FK
 * - Updates workspace_prospects.active_campaign_id
 *
 * Body:
 * {
 *   workspaceId: string,
 *   campaignId: string,
 *   prospectIds: string[],     // workspace_prospect IDs to add
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceId, campaignId, prospectIds } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }

    if (!prospectIds || !Array.isArray(prospectIds) || prospectIds.length === 0) {
      return NextResponse.json({ error: 'prospectIds array is required' }, { status: 400 });
    }

    // Verify workspace membership
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify campaign exists and belongs to workspace
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, status, campaign_type')
      .eq('id', campaignId)
      .eq('workspace_id', workspaceId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Fetch prospects to add
    const { data: prospects, error: prospectError } = await supabase
      .from('workspace_prospects')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('id', prospectIds);

    if (prospectError) {
      console.error('Error fetching prospects:', prospectError);
      return NextResponse.json({ error: 'Failed to fetch prospects' }, { status: 500 });
    }

    if (!prospects || prospects.length === 0) {
      return NextResponse.json({ error: 'No valid prospects found' }, { status: 400 });
    }

    // Filter and categorize prospects
    const approvedProspects = prospects.filter(p => p.approval_status === 'approved');
    const alreadyInCampaign = prospects.filter(p => p.active_campaign_id !== null);
    const notApproved = prospects.filter(p => p.approval_status !== 'approved');

    if (approvedProspects.length === 0) {
      return NextResponse.json({
        error: 'No approved prospects to add',
        details: {
          not_approved: notApproved.length,
          already_in_campaign: alreadyInCampaign.length,
        },
      }, { status: 400 });
    }

    // Prepare campaign_prospects records
    const campaignProspects = approvedProspects
      .filter(p => p.active_campaign_id === null) // Only add if not already in a campaign
      .map(p => ({
        campaign_id: campaignId,
        workspace_id: workspaceId,
        master_prospect_id: p.id,  // FK to workspace_prospects
        first_name: p.first_name || 'Unknown',
        last_name: p.last_name || '',
        email: p.email || null,
        company_name: p.company || null,
        title: p.title || null,
        location: p.location || null,
        phone: p.phone || null,
        linkedin_url: p.linkedin_url || null,
        linkedin_url_hash: p.linkedin_url_hash || null,
        provider_id: p.linkedin_provider_id || null,
        connection_degree: p.connection_degree || null,
        status: 'pending',
        personalization_data: {
          source: p.source,
          added_at: new Date().toISOString(),
          batch_id: p.batch_id,
          enrichment: p.enrichment_data,
        },
        created_at: new Date().toISOString(),
      }));

    if (campaignProspects.length === 0) {
      return NextResponse.json({
        error: 'All selected prospects are already in active campaigns',
        details: {
          already_in_campaign: alreadyInCampaign.length,
        },
      }, { status: 400 });
    }

    // Insert into campaign_prospects
    // Using upsert to handle potential duplicates (same linkedin_url_hash in same campaign)
    const { data: inserted, error: insertError } = await supabase
      .from('campaign_prospects')
      .upsert(campaignProspects, {
        onConflict: 'campaign_id,linkedin_url',
        ignoreDuplicates: true,
      })
      .select('id, master_prospect_id');

    if (insertError) {
      console.error('Error inserting campaign_prospects:', insertError);
      return NextResponse.json({ error: 'Failed to add prospects to campaign' }, { status: 500 });
    }

    const insertedCount = inserted?.length || 0;

    // Update workspace_prospects.active_campaign_id for successfully added prospects
    if (inserted && inserted.length > 0) {
      const masterProspectIds = inserted
        .map(i => i.master_prospect_id)
        .filter(Boolean);

      if (masterProspectIds.length > 0) {
        const { error: updateError } = await supabase
          .from('workspace_prospects')
          .update({
            active_campaign_id: campaignId,
            updated_at: new Date().toISOString(),
          })
          .in('id', masterProspectIds);

        if (updateError) {
          console.error('Error updating workspace_prospects.active_campaign_id:', updateError);
          // Don't fail - prospects are already in campaign
        }
      }
    }

    // Get final campaign prospect count
    const { count: totalProspects } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        type: campaign.campaign_type,
      },
      added_count: insertedCount,
      skipped: {
        not_approved: notApproved.length,
        already_in_campaign: alreadyInCampaign.length - insertedCount,
      },
      total_campaign_prospects: totalProspects || 0,
      message: `Successfully added ${insertedCount} prospect(s) to campaign "${campaign.name}".`,
    });

  } catch (error: unknown) {
    console.error('Add to campaign error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/prospects/add-to-campaign?workspaceId=xxx
 *
 * Get available campaigns for adding prospects.
 * Returns draft and active campaigns with their current prospect counts.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    // Verify workspace membership
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get campaigns that can receive prospects (draft or active)
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, status, campaign_type, created_at')
      .eq('workspace_id', workspaceId)
      .in('status', ['draft', 'active'])
      .order('created_at', { ascending: false });

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError);
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
    }

    // Enrich with prospect counts (batch query)
    const campaignIds = campaigns?.map(c => c.id) || [];
    let prospectCounts: Record<string, number> = {};

    if (campaignIds.length > 0) {
      const { data: counts } = await supabase
        .from('campaign_prospects')
        .select('campaign_id')
        .in('campaign_id', campaignIds);

      if (counts) {
        prospectCounts = counts.reduce((acc, row) => {
          acc[row.campaign_id] = (acc[row.campaign_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }
    }

    const enrichedCampaigns = campaigns?.map(c => ({
      ...c,
      prospect_count: prospectCounts[c.id] || 0,
    })) || [];

    return NextResponse.json({
      success: true,
      campaigns: enrichedCampaigns,
    });

  } catch (error: unknown) {
    console.error('Fetch campaigns error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
