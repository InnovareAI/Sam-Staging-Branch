import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

/**
 * GET /api/workspace-prospects/available
 * Returns approved prospects from prospect_approval_data that are NOT yet assigned to any campaign
 *
 * NOTE: Prospects stay in prospect_approval_data after approval.
 * They only move to workspace_prospects when assigned to campaigns (not automatically on approval).
 */
export async function GET(req: NextRequest) {
  try {
    // Firebase auth - workspace comes from header
    let authContext;
    try {
      authContext = await verifyAuth(req);
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }

    const { workspaceId } = authContext;

    // Get approval sessions for this workspace
    const { rows: sessions } = await pool.query(
      `SELECT id FROM prospect_approval_sessions WHERE workspace_id = $1`,
      [workspaceId]
    );

    const sessionIds = (sessions || []).map((s: any) => s.id);

    if (sessionIds.length === 0) {
      return NextResponse.json({ prospects: [], total: 0 });
    }

    // Get approved prospects from prospect_approval_data
    const { rows: approvedProspects } = await pool.query(
      `SELECT pad.*, pas.workspace_id
       FROM prospect_approval_data pad
       INNER JOIN prospect_approval_sessions pas ON pad.session_id = pas.id
       WHERE pad.session_id = ANY($1) AND pad.approval_status = 'approved'
       ORDER BY pad.created_at DESC`,
      [sessionIds]
    );

    // Extract LinkedIn URLs from contact JSONB field
    const prospectsWithLinkedIn = (approvedProspects || []).map((p: any) => {
      const contact = p.contact || {};
      const linkedinUrl = contact.linkedin_url || contact.linkedin_profile_url || null;
      return {
        ...p,
        linkedin_profile_url: linkedinUrl
      };
    }).filter((p: any) => p.linkedin_profile_url);

    const linkedinUrls = prospectsWithLinkedIn.map((p: any) => p.linkedin_profile_url);

    // Check which prospects are already in campaigns
    let prospectsInCampaigns: string[] = [];
    if (linkedinUrls.length > 0) {
      const { rows: campaignProspects } = await pool.query(
        `SELECT linkedin_url FROM campaign_prospects
         WHERE workspace_id = $1 AND linkedin_url = ANY($2)`,
        [workspaceId, linkedinUrls]
      );

      prospectsInCampaigns = (campaignProspects || []).map((cp: any) => cp.linkedin_url);
    }

    // Filter to only prospects NOT in campaigns
    const availableProspects = prospectsWithLinkedIn.filter(
      (p: any) => !prospectsInCampaigns.includes(p.linkedin_profile_url)
    );

    // Transform to match expected format for CampaignHub
    const transformedProspects = availableProspects.map((p: any) => {
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
