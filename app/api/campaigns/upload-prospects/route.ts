import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

// Simple JSON-based prospect upload for campaigns
// Used by CampaignHub when prospects are already in memory (not from CSV upload)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Get user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { campaign_id, prospects } = body;

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 });
    }

    if (!prospects || !Array.isArray(prospects) || prospects.length === 0) {
      return NextResponse.json({ error: 'prospects array is required and must not be empty' }, { status: 400 });
    }

    // Verify campaign exists and user has access
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, workspace_id')
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found or access denied' }, { status: 404 });
    }

    // Verify user has access to this workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', campaign.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
    }

    let inserted_count = 0;
    let updated_count = 0;
    let error_count = 0;
    const errors = [];

    // Process each prospect
    for (let i = 0; i < prospects.length; i++) {
      try {
        const prospect = prospects[i];

        // Prepare prospect data
        // CRITICAL: Handle both direct fields and nested JSONB fields (contact, company)
        const prospectData = {
          campaign_id: campaign_id,
          workspace_id: campaign.workspace_id,
          first_name: prospect.first_name || (prospect.name ? prospect.name.split(' ')[0] : ''),
          last_name: prospect.last_name || (prospect.name ? prospect.name.split(' ').slice(1).join(' ') : ''),
          email: prospect.email || prospect.email_address || prospect.contact?.email || null,
          company_name: prospect.company_name || prospect.company?.name || prospect.company || '',
          title: prospect.title || prospect.job_title || '',
          linkedin_url: prospect.linkedin_url || prospect.linkedin_profile_url || prospect.contact?.linkedin_url || null,
          linkedin_user_id: prospect.linkedin_user_id || null,
          phone: prospect.phone || prospect.contact?.phone || null,
          location: prospect.location || '',
          industry: prospect.industry || prospect.company?.industry?.[0] || prospect.company?.industry || null,
          status: 'pending',
          notes: prospect.notes || null,
          personalization_data: prospect.personalization_data || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Check if prospect already exists for this campaign
        const { data: existing } = await supabase
          .from('campaign_prospects')
          .select('id')
          .eq('campaign_id', campaign_id)
          .eq('email', prospectData.email)
          .maybeSingle();

        if (existing) {
          // Update existing prospect
          const { error: updateError } = await supabase
            .from('campaign_prospects')
            .update({
              ...prospectData,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);

          if (updateError) {
            error_count++;
            errors.push({ index: i, error: updateError.message });
          } else {
            updated_count++;
          }
        } else {
          // Insert new prospect
          const { error: insertError } = await supabase
            .from('campaign_prospects')
            .insert(prospectData);

          if (insertError) {
            error_count++;
            errors.push({ index: i, error: insertError.message });
          } else {
            inserted_count++;
          }
        }
      } catch (error: any) {
        error_count++;
        errors.push({ index: i, error: error.message });
      }
    }

    // Count prospects with LinkedIn IDs
    const { count: prospects_with_linkedin_ids } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign_id)
      .not('linkedin_user_id', 'is', null);

    return NextResponse.json({
      success: true,
      message: 'Prospects uploaded successfully',
      campaign: {
        id: campaign.id,
        name: campaign.name
      },
      results: {
        total: prospects.length,
        inserted: inserted_count,
        updated: updated_count,
        errors: error_count
      },
      prospects_with_linkedin_ids: prospects_with_linkedin_ids || 0,
      error_details: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('Prospect upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload prospects', details: error.message },
      { status: 500 }
    );
  }
}
