import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { extractLinkedInSlug } from '@/lib/linkedin-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Prevent 504 timeout on bulk campaign adds

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
    const { userId, workspaceId: authWorkspaceId } = await verifyAuth(request);

    const body = await request.json();
    const { workspaceId, campaignId, prospectIds } = body;

    // Use workspaceId from body if provided, otherwise use from auth
    const effectiveWorkspaceId = workspaceId || authWorkspaceId;

    if (!effectiveWorkspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    // If body workspaceId differs from auth, verify access
    if (workspaceId && workspaceId !== authWorkspaceId) {
      const memberCheck = await pool.query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
      );
      if (memberCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }

    if (!prospectIds || !Array.isArray(prospectIds) || prospectIds.length === 0) {
      return NextResponse.json({ error: 'prospectIds array is required' }, { status: 400 });
    }

    // Verify campaign exists and belongs to workspace
    const campaignResult = await pool.query(
      'SELECT id, name, status, campaign_type FROM campaigns WHERE id = $1 AND workspace_id = $2',
      [campaignId, effectiveWorkspaceId]
    );

    if (campaignResult.rows.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const campaign = campaignResult.rows[0];

    // Fetch prospects to add
    const prospectsResult = await pool.query(
      'SELECT * FROM workspace_prospects WHERE workspace_id = $1 AND id = ANY($2)',
      [effectiveWorkspaceId, prospectIds]
    );

    const prospects = prospectsResult.rows;

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
        workspace_id: effectiveWorkspaceId,
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
        // CRITICAL FIX (Dec 18): Extract slug from URL to prevent "User ID does not match format" errors
        linkedin_user_id: extractLinkedInSlug(p.linkedin_provider_id || p.linkedin_url),
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

    // Insert into campaign_prospects ONE BY ONE to prevent batch failures
    // CRITICAL FIX (Dec 18): Batch inserts fail ALL records if ANY has a constraint violation
    // One-by-one inserts allow partial success and proper error tracking
    const inserted: { id: string; master_prospect_id: string | null }[] = [];
    const insertErrors: string[] = [];

    for (const prospect of campaignProspects) {
      try {
        // Use INSERT ... ON CONFLICT for upsert behavior
        const insertResult = await pool.query(
          `INSERT INTO campaign_prospects (
            campaign_id, workspace_id, master_prospect_id, first_name, last_name,
            email, company_name, title, location, phone, linkedin_url,
            linkedin_url_hash, linkedin_user_id, provider_id, connection_degree,
            status, personalization_data, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (campaign_id, linkedin_url) DO NOTHING
          RETURNING id, master_prospect_id`,
          [
            prospect.campaign_id, prospect.workspace_id, prospect.master_prospect_id,
            prospect.first_name, prospect.last_name, prospect.email, prospect.company_name,
            prospect.title, prospect.location, prospect.phone, prospect.linkedin_url,
            prospect.linkedin_url_hash, prospect.linkedin_user_id, prospect.provider_id,
            prospect.connection_degree, prospect.status, JSON.stringify(prospect.personalization_data),
            prospect.created_at
          ]
        );

        if (insertResult.rows.length > 0) {
          inserted.push(insertResult.rows[0]);
        }
      } catch (insertError: any) {
        insertErrors.push(`${prospect.first_name} ${prospect.last_name}: ${insertError.message}`);
        if (insertErrors.length <= 3) {
          console.warn(`⚠️ Failed to add prospect: ${insertError.message}`);
        }
      }
    }

    if (insertErrors.length > 0) {
      console.error(`❌ ${insertErrors.length} prospect inserts failed`);
    }

    const insertedCount = inserted.length;

    // Update workspace_prospects.active_campaign_id for successfully added prospects
    if (inserted && inserted.length > 0) {
      const masterProspectIds = inserted
        .map(i => i.master_prospect_id)
        .filter(Boolean);

      if (masterProspectIds.length > 0) {
        try {
          await pool.query(
            `UPDATE workspace_prospects SET active_campaign_id = $1, updated_at = $2 WHERE id = ANY($3)`,
            [campaignId, new Date().toISOString(), masterProspectIds]
          );
        } catch (updateError) {
          console.error('Error updating workspace_prospects.active_campaign_id:', updateError);
          // Don't fail - prospects are already in campaign
        }
      }
    }

    // Get final campaign prospect count
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM campaign_prospects WHERE campaign_id = $1',
      [campaignId]
    );
    const totalProspects = parseInt(countResult.rows[0].count, 10);

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
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
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
    const { userId, workspaceId: authWorkspaceId } = await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || authWorkspaceId;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    // If query workspaceId differs from auth, verify access
    if (workspaceId !== authWorkspaceId) {
      const memberCheck = await pool.query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
      );
      if (memberCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Get campaigns that can receive prospects (draft or active)
    const campaignsResult = await pool.query(
      `SELECT id, name, status, campaign_type, created_at
       FROM campaigns
       WHERE workspace_id = $1 AND status IN ('draft', 'active')
       ORDER BY created_at DESC`,
      [workspaceId]
    );

    const campaigns = campaignsResult.rows;

    // Enrich with prospect counts (batch query)
    const campaignIds = campaigns?.map(c => c.id) || [];
    let prospectCounts: Record<string, number> = {};

    if (campaignIds.length > 0) {
      const countsResult = await pool.query(
        'SELECT campaign_id FROM campaign_prospects WHERE campaign_id = ANY($1)',
        [campaignIds]
      );

      if (countsResult.rows) {
        prospectCounts = countsResult.rows.reduce((acc, row) => {
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
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Fetch campaigns error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
