import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

/**
 * GET /api/workspace-prospects/available
 * Returns approved prospects from prospect_approval_data that are NOT yet assigned to any campaign
 *
 * NOTE: Prospects stay in prospect_approval_data after approval.
 * They only move to workspace_prospects when assigned to campaigns (not automatically on approval).
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Get user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace_id from query params
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    // Verify user has access to this workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get approval sessions for this workspace
    const { data: sessions, error: sessionError } = await supabase
      .from('prospect_approval_sessions')
      .select('id')
      .eq('workspace_id', workspaceId);

    if (sessionError) {
      console.error('Error fetching approval sessions:', sessionError);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    const sessionIds = (sessions || []).map(s => s.id);

    if (sessionIds.length === 0) {
      return NextResponse.json({ prospects: [], total: 0 });
    }

    // Get approved prospects from prospect_approval_data
    const { data: approvedProspects, error: prospectsError } = await supabase
      .from('prospect_approval_data')
      .select('*, prospect_approval_sessions!inner(workspace_id)')
      .in('session_id', sessionIds)
      .eq('approval_status', 'approved')
      .order('created_at', { ascending: false });

    if (prospectsError) {
      console.error('Error fetching approved prospects:', prospectsError);
      return NextResponse.json({ error: 'Failed to fetch prospects' }, { status: 500 });
    }

    // Extract LinkedIn URLs from contact JSONB field
    const prospectsWithLinkedIn = (approvedProspects || []).map(p => {
      const contact = p.contact || {};
      const linkedinUrl = contact.linkedin_url || contact.linkedin_profile_url || null;
      return {
        ...p,
        linkedin_profile_url: linkedinUrl
      };
    }).filter(p => p.linkedin_profile_url);

    const linkedinUrls = prospectsWithLinkedIn.map(p => p.linkedin_profile_url);

    // Check which prospects are already in campaigns
    let prospectsInCampaigns: string[] = [];
    if (linkedinUrls.length > 0) {
      const { data: campaignProspects } = await supabase
        .from('campaign_prospects')
        .select('linkedin_url')
        .eq('workspace_id', workspaceId)
        .in('linkedin_url', linkedinUrls);

      prospectsInCampaigns = (campaignProspects || []).map(cp => cp.linkedin_url);
    }

    // Filter to only prospects NOT in campaigns
    const availableProspects = prospectsWithLinkedIn.filter(
      p => !prospectsInCampaigns.includes(p.linkedin_profile_url)
    );

    // Transform to match expected format for CampaignHub
    const transformedProspects = availableProspects.map(p => {
      const contact = p.contact || {};
      const company = p.company || {};
      const nameParts = (p.name || '').split(' ');

      return {
        id: p.id,
        workspace_id: workspaceId,
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
        full_name: p.name,
        email: contact.email || null,
        phone: contact.phone || null,
        company_name: company.name || null,
        job_title: p.title || null,
        linkedin_profile_url: p.linkedin_profile_url,
        location: p.location || null,
        industry: company.industry || null,
        source: p.source || 'manual',
        confidence_score: p.enrichment_score || null,
        created_at: p.created_at
      };
    });

    return NextResponse.json({
      prospects: transformedProspects,
      total: transformedProspects.length
    });

  } catch (error: any) {
    console.error('Error in /api/workspace-prospects/available:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
