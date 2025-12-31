import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool, AuthError } from '@/lib/auth'
import { enrichProspectName, normalizeFullName } from '@/lib/enrich-prospect-name'
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

// Helper to normalize LinkedIn URL to vanity name (for deduplication)
function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  if (match) {
    return match[1].toLowerCase().trim();
  }
  return url.replace(/^\/+|\/+$/g, '').toLowerCase().trim();
}

/**
 * POST /api/campaigns/add-approved-prospects
 * Add approved prospects to a campaign
 * IMPORTANT: Automatically enriches missing names from LinkedIn via Unipile
 *
 * DATABASE-FIRST ARCHITECTURE (Dec 2025):
 * 1. Upsert prospects to workspace_prospects (master table)
 * 2. Insert to campaign_prospects WITH master_prospect_id FK
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await verifyAuth(request);

    const body = await request.json()
    const { campaign_id, workspace_id, prospect_ids } = body

    if (!campaign_id || !workspace_id || !prospect_ids || !Array.isArray(prospect_ids)) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: campaign_id, workspace_id, prospect_ids'
      }, { status: 400 })
    }

    // Verify workspace access
    const memberResult = await pool.query(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspace_id, userId]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Not a member of this workspace'
      }, { status: 403 })
    }

    // CRITICAL FIX (Dec 4): approval_status is in prospect_approval_decisions, NOT prospect_approval_data
    // First get approved decisions, then fetch the prospect data
    const approvedDecisionsResult = await pool.query(
      `SELECT prospect_id, session_id FROM prospect_approval_decisions
       WHERE prospect_id = ANY($1) AND decision = 'approved'`,
      [prospect_ids]
    );

    const approvedDecisions = approvedDecisionsResult.rows;
    const approvedProspectIds = (approvedDecisions || []).map(d => d.prospect_id)

    if (approvedProspectIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No approved prospects found with provided IDs'
      }, { status: 404 })
    }

    // Get approved prospect data (with session info for workspace validation)
    const prospectsResult = await pool.query(
      `SELECT pad.*, pas.workspace_id as session_workspace_id, pas.campaign_name, pas.campaign_tag
       FROM prospect_approval_data pad
       JOIN prospect_approval_sessions pas ON pad.session_id = pas.id
       WHERE pad.prospect_id = ANY($1)`,
      [approvedProspectIds]
    );

    // Filter prospects that match workspace_id
    const validProspects = (prospectsResult.rows || []).filter(
      p => p.session_workspace_id === workspace_id
    )

    if (!validProspects || validProspects.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No approved prospects found with provided IDs for this workspace'
      }, { status: 404 })
    }

    // CRITICAL: Check if any prospects are already in active campaigns
    // This prevents the same person from receiving conflicting messages from multiple campaigns
    const linkedinUrls = validProspects
      .map(p => p.contact?.linkedin_url || p.linkedin_url)
      .filter(Boolean)
      .map(url => url.toLowerCase().trim().replace(/\/$/, ''))

    const emails = validProspects
      .map(p => p.contact?.email)
      .filter(Boolean)
      .map(email => email.toLowerCase().trim())

    // Find prospects already in active campaigns (sequence not completed)
    if (linkedinUrls.length > 0 || emails.length > 0) {
      const existingProspectsResult = await pool.query(
        `SELECT cp.id, cp.first_name, cp.last_name, cp.linkedin_url, cp.email, cp.status,
                cp.campaign_id, c.name as campaign_name, c.status as campaign_status
         FROM campaign_prospects cp
         JOIN campaigns c ON cp.campaign_id = c.id
         WHERE cp.workspace_id = $1
           AND cp.campaign_id != $2
           AND cp.status IN ('pending', 'approved', 'processing', 'cr_sent', 'fu1_sent', 'fu2_sent', 'fu3_sent', 'fu4_sent', 'fu5_sent', 'connection_requested', 'connected', 'messaging', 'completed')
           AND (cp.linkedin_url = ANY($3) OR cp.email = ANY($4))`,
        [workspace_id, campaign_id, linkedinUrls, emails]
      );

      const conflictingProspects = (existingProspectsResult.rows || []).filter(p =>
        p.campaign_status === 'active' || p.campaign_status === 'draft'
      )

      if (conflictingProspects.length > 0) {
        const conflictDetails = conflictingProspects.map(p => ({
          name: `${p.first_name} ${p.last_name}`,
          linkedin_url: p.linkedin_url,
          current_campaign: p.campaign_name || 'Unknown',
          status: p.status
        }))

        console.warn('Campaign conflict detected:', {
          count: conflictingProspects.length,
          conflicts: conflictDetails
        })

        return NextResponse.json({
          success: false,
          error: 'campaign_conflict',
          message: `${conflictingProspects.length} prospect(s) are already in active campaigns. Remove them from existing campaigns before adding to this one.`,
          conflicts: conflictDetails
        }, { status: 409 })
      }
    }

    // Get campaign and its LinkedIn account to set prospect ownership
    const campaignResult = await pool.query(
      `SELECT id, created_by, workspace_id FROM campaigns WHERE id = $1`,
      [campaign_id]
    );

    const campaign = campaignResult.rows[0];

    // Get the campaign creator's LinkedIn account (Unipile)
    const linkedInAccountResult = await pool.query(
      `SELECT unipile_account_id FROM workspace_accounts
       WHERE workspace_id = $1 AND user_id = $2 AND account_type = 'linkedin'
         AND connection_status = ANY($3)
       LIMIT 1`,
      [workspace_id, campaign?.created_by, VALID_CONNECTION_STATUSES]
    );

    const unipileAccountId = linkedInAccountResult.rows[0]?.unipile_account_id || null

    // =========================================================================
    // DATABASE-FIRST ARCHITECTURE (Dec 2025)
    // Step 1: Upsert to workspace_prospects (master table)
    // Step 2: Insert to campaign_prospects WITH master_prospect_id FK
    // =========================================================================

    // Transform and enrich prospects, then upsert to workspace_prospects
    const processedProspects = await Promise.all(validProspects.map(async prospect => {
      // Normalize and extract name parts from SAM data
      const normalized = normalizeFullName(prospect.name || '')
      let firstName = normalized.firstName
      let lastName = normalized.lastName

      // AUTOMATIC ENRICHMENT: If names are missing, fetch from LinkedIn
      if (!firstName || !lastName) {
        console.log('Missing name for prospect, attempting enrichment:', {
          prospect_id: prospect.prospect_id,
          linkedin_url: prospect.contact?.linkedin_url
        });

        const enriched = await enrichProspectName(
          prospect.contact?.linkedin_url || null,
          firstName,
          lastName,
          unipileAccountId
        );

        firstName = enriched.firstName;
        lastName = enriched.lastName;

        if (enriched.enriched) {
          console.log('Successfully enriched name:', {
            prospect_id: prospect.prospect_id,
            name: `${firstName} ${lastName}`
          });
        }
      }

      // Extract LinkedIn URL and provider_id
      let linkedinUrl = prospect.contact?.linkedin_url || prospect.linkedin_url || null;
      const linkedinUserId = prospect.contact?.linkedin_provider_id || null;

      // Clean LinkedIn URL: Remove query parameters
      if (linkedinUrl) {
        try {
          const match = linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
          if (match) {
            linkedinUrl = `https://www.linkedin.com/in/${match[1]}`;
          }
        } catch (error) {
          console.error('Error cleaning LinkedIn URL:', linkedinUrl, error);
        }
      }

      const linkedinUrlHash = normalizeLinkedInUrl(linkedinUrl);
      const email = prospect.contact?.email || null;
      const emailHash = email ? email.toLowerCase().trim() : null;
      // Dec 5: Extract company website (optional field from CSV upload)
      const companyWebsite = prospect.contact?.website || null;

      return {
        // Data for workspace_prospects
        workspace_id,
        first_name: firstName,
        last_name: lastName,
        linkedin_url: linkedinUrl,
        linkedin_url_hash: linkedinUrlHash,
        linkedin_profile_url: linkedinUrl, // Keep old column in sync
        email,
        email_hash: emailHash,
        company: prospect.company?.name || '',
        company_name: prospect.company?.name || '', // Keep old column in sync
        title: prospect.title || '',
        job_title: prospect.title || '', // Keep old column in sync
        location: prospect.location || null,
        linkedin_provider_id: linkedinUserId,
        connection_degree: prospect.connection_degree,
        company_website: companyWebsite, // Dec 5: Optional company website from CSV
        source: 'approval_workflow',
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        active_campaign_id: campaign_id,
        enrichment_data: JSON.stringify({
          campaign_name: prospect.campaign_name,
          campaign_tag: prospect.campaign_tag,
          industry: prospect.company?.industry?.[0] || null
        }),
        // Extra data needed for campaign_prospects
        _campaign_data: {
          linkedin_user_id: linkedinUserId,
          industry: prospect.company?.industry?.[0] || 'Not specified',
          unipile_account_id: unipileAccountId,
          personalization_data: {
            source: 'approved_prospects',
            campaign_name: prospect.campaign_name,
            campaign_tag: prospect.campaign_tag,
            approved_at: new Date().toISOString(),
            connection_degree: prospect.connection_degree
          }
        }
      };
    }));

    // STEP 1: Upsert to workspace_prospects (master table)
    console.log('DATABASE-FIRST: Upserting', processedProspects.length, 'prospects to workspace_prospects');
    const masterProspectIds: Map<string, string> = new Map(); // linkedinUrlHash -> workspace_prospect.id

    for (const prospect of processedProspects) {
      if (!prospect.linkedin_url_hash) continue;

      try {
        const upsertResult = await pool.query(
          `INSERT INTO workspace_prospects (
            workspace_id, first_name, last_name, linkedin_url, linkedin_url_hash,
            linkedin_profile_url, email, company, company_name, title, job_title,
            location, linkedin_provider_id, connection_degree, company_website,
            source, approval_status, approved_at, active_campaign_id, enrichment_data,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
          ON CONFLICT (workspace_id, linkedin_url_hash)
          DO UPDATE SET
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            email = COALESCE(EXCLUDED.email, workspace_prospects.email),
            approval_status = EXCLUDED.approval_status,
            active_campaign_id = EXCLUDED.active_campaign_id,
            updated_at = EXCLUDED.updated_at
          RETURNING id`,
          [
            prospect.workspace_id,
            prospect.first_name,
            prospect.last_name,
            prospect.linkedin_url,
            prospect.linkedin_url_hash,
            prospect.linkedin_profile_url,
            prospect.email,
            prospect.company,
            prospect.company_name,
            prospect.title,
            prospect.job_title,
            prospect.location,
            prospect.linkedin_provider_id,
            prospect.connection_degree,
            prospect.company_website,
            prospect.source,
            prospect.approval_status,
            prospect.approved_at,
            prospect.active_campaign_id,
            prospect.enrichment_data,
            new Date().toISOString(),
            new Date().toISOString()
          ]
        );

        if (upsertResult.rows.length > 0) {
          masterProspectIds.set(prospect.linkedin_url_hash, upsertResult.rows[0].id);
        }
      } catch (upsertError: any) {
        if (upsertError.code === '23505') {
          // Duplicate - try to fetch existing
          const existingResult = await pool.query(
            `SELECT id FROM workspace_prospects WHERE workspace_id = $1 AND linkedin_url_hash = $2`,
            [workspace_id, prospect.linkedin_url_hash]
          );
          if (existingResult.rows.length > 0) {
            masterProspectIds.set(prospect.linkedin_url_hash, existingResult.rows[0].id);
            // Update active_campaign_id
            await pool.query(
              `UPDATE workspace_prospects SET active_campaign_id = $1, approval_status = 'approved' WHERE id = $2`,
              [campaign_id, existingResult.rows[0].id]
            );
          }
        } else {
          console.error('Error upserting workspace_prospect:', upsertError);
        }
      }
    }

    console.log('DATABASE-FIRST: Created/found', masterProspectIds.size, 'workspace_prospects records');

    // STEP 2: Transform for campaign_prospects WITH master_prospect_id
    let insertedCount = 0;
    const insertErrors: string[] = [];

    for (const prospect of processedProspects) {
      try {
        await pool.query(
          `INSERT INTO campaign_prospects (
            campaign_id, workspace_id, master_prospect_id, first_name, last_name,
            email, company_name, linkedin_url, linkedin_url_hash, linkedin_user_id,
            title, location, industry, company_website, status, notes,
            added_by_unipile_account, personalization_data, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
          [
            campaign_id,
            workspace_id,
            prospect.linkedin_url_hash ? masterProspectIds.get(prospect.linkedin_url_hash) : null,
            prospect.first_name,
            prospect.last_name,
            prospect.email,
            prospect.company_name,
            prospect.linkedin_url,
            prospect.linkedin_url_hash,
            prospect._campaign_data.linkedin_user_id,
            prospect.title,
            prospect.location,
            prospect._campaign_data.industry,
            prospect.company_website,
            'approved',
            null,
            prospect._campaign_data.unipile_account_id,
            JSON.stringify(prospect._campaign_data.personalization_data),
            new Date().toISOString()
          ]
        );
        insertedCount++;
      } catch (insertError: any) {
        insertErrors.push(`${prospect.first_name} ${prospect.last_name}: ${insertError.message}`);
        if (insertErrors.length <= 3) {
          console.warn('Failed to insert campaign prospect:', insertError.message);
        }
      }
    }

    if (insertErrors.length > 0) {
      console.error(`${insertErrors.length} prospect inserts failed`);
    }

    console.log('DATABASE-FIRST: Inserted', insertedCount, 'campaign_prospects with master_prospect_id');

    // Log what was inserted
    const prospectsWithLinkedIn = processedProspects.filter(p => p.linkedin_url);
    const prospectsWithoutLinkedIn = processedProspects.filter(p => !p.linkedin_url);

    console.log(`Inserted ${insertedCount} prospects to campaign`);
    console.log(`With LinkedIn URL: ${prospectsWithLinkedIn.length}`);
    console.log(`Without LinkedIn URL: ${prospectsWithoutLinkedIn.length}`);

    // CRITICAL: Mark prospects as 'added_to_campaign' in prospect_approval_data
    // This prevents them from showing up in future "approved prospects" lists
    if (prospect_ids && prospect_ids.length > 0) {
      await pool.query(
        `UPDATE prospect_approval_data SET approval_status = 'added_to_campaign' WHERE prospect_id = ANY($1)`,
        [prospect_ids]
      );
      console.log(`Marked ${prospect_ids.length} prospects as 'added_to_campaign'`);
    }

    if (prospectsWithoutLinkedIn.length > 0) {
      console.warn('Prospects missing LinkedIn URL:', prospectsWithoutLinkedIn.map(p => ({
        name: `${p.first_name} ${p.last_name}`
      })));
    }

    // AUTO-ENRICHMENT: Enrich prospects with missing company/location data via BrightData
    // (Trigger async in background - don't block response)
    const needsEnrichmentResult = await pool.query(
      `SELECT id, linkedin_url FROM campaign_prospects
       WHERE campaign_id = $1
         AND linkedin_url IS NOT NULL
         AND (company_name IS NULL OR company_name = 'unavailable'
              OR location IS NULL OR location = 'unavailable')`,
      [campaign_id]
    );

    const needsEnrichment = needsEnrichmentResult.rows;

    if (needsEnrichment.length > 0) {
      console.log(`Auto-enriching ${needsEnrichment.length} prospects with BrightData...`);

      // Call enrichment API asynchronously (don't block the response)
      fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/api/prospects/enrich`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': request.headers.get('cookie') || ''
        },
        body: JSON.stringify({
          prospectIds: needsEnrichment.map(p => p.id),
          autoEnrich: true
        })
      })
      .then(async (res) => {
        if (res.ok) {
          const enrichmentData = await res.json();
          console.log(`Auto-enrichment completed: ${enrichmentData.enriched_count} prospects enriched`);
        } else {
          console.error('Auto-enrichment failed:', res.status);
        }
      })
      .catch((err) => {
        console.error('Auto-enrichment error:', err.message);
        // Non-fatal - prospects are already added, enrichment is bonus
      });
    }

    return NextResponse.json({
      success: true,
      message: `Added ${insertedCount} prospects to campaign`,
      added_count: insertedCount,
      with_linkedin: prospectsWithLinkedIn.length,
      without_linkedin: prospectsWithoutLinkedIn.length,
      auto_enrichment_triggered: needsEnrichment.length > 0,
      prospects_to_enrich: needsEnrichment.length
    })

  } catch (error: any) {
    if ((error as AuthError).statusCode) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Add approved prospects error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
