import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Helper to normalize LinkedIn URL to hash (vanity name only)
function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  if (match) {
    return match[1].toLowerCase().trim();
  }
  return url.replace(/^\/+|\/+$/g, '').toLowerCase().trim();
}

/**
 * POST /api/campaigns/draft
 * Save or update a campaign draft
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId: authWorkspaceId } = await verifyAuth(request);

    const body = await request.json();
    const {
      draftId, // If updating existing draft
      workspaceId,
      name,
      campaignType,
      currentStep,
      connectionMessage,
      alternativeMessage,
      followUpMessages,
      csvData, // Prospect data
    } = body;

    if (!workspaceId || !name) {
      return NextResponse.json(
        { error: 'workspaceId and name are required' },
        { status: 400 }
      );
    }

    // Verify workspace membership
    const memberResult = await pool.query(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // CRITICAL FIX: No longer store csvData in draft_data
    // Prospects go directly into campaign_prospects table
    const draftData = {};

    if (draftId) {
      // Update existing draft
      const updateResult = await pool.query(
        `UPDATE campaigns SET
          name = $1,
          campaign_type = $2,
          current_step = $3,
          connection_message = $4,
          alternative_message = $5,
          follow_up_messages = $6,
          draft_data = $7,
          updated_at = $8
        WHERE id = $9 AND workspace_id = $10 AND status = 'draft'
        RETURNING *`,
        [
          name,
          campaignType,
          currentStep,
          connectionMessage,
          alternativeMessage,
          JSON.stringify(followUpMessages || []),
          JSON.stringify(draftData),
          new Date().toISOString(),
          draftId,
          workspaceId
        ]
      );

      if (updateResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Failed to update draft' },
          { status: 500 }
        );
      }

      const campaign = updateResult.rows[0];

      // DATABASE-FIRST: Upsert to workspace_prospects then campaign_prospects
      console.log('💾 [DRAFT] Received csvData:', csvData?.length || 0, 'prospects');
      console.log('💾 [DRAFT] Sample prospect:', JSON.stringify(csvData?.[0], null, 2));

      if (csvData && csvData.length > 0) {
        // Map to track linkedin_url_hash -> master_prospect_id
        const masterProspectIds: Map<string, string> = new Map();

        // STEP 1: Upsert to workspace_prospects (master table)
        for (const p of csvData) {
          const linkedinUrl = p.linkedin_url || p.linkedinUrl || p.contact?.linkedin_url;
          const email = p.email || p.contact?.email;

          console.log(`💾 [PROSPECT] Processing: ${p.name}, LinkedIn: "${linkedinUrl || 'none'}", Email: "${email || 'none'}"`);

          // Skip only if prospect has NEITHER LinkedIn URL nor email
          if (!linkedinUrl && !email) {
            console.log(`⚠️  [SKIP] No LinkedIn URL OR email for: ${p.name}`);
            continue;
          }

          const linkedinUrlHash = linkedinUrl ? normalizeLinkedInUrl(linkedinUrl) : null;
          const firstName = p.firstName || p.first_name || p.name?.split(' ')[0] || 'Unknown';
          const lastName = p.lastName || p.last_name || p.name?.split(' ').slice(1).join(' ') || '';

          try {
            const upsertResult = await pool.query(
              `INSERT INTO workspace_prospects (
                workspace_id, linkedin_url, linkedin_url_hash, email, first_name, last_name,
                company, title, source, approval_status, active_campaign_id, linkedin_provider_id,
                created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
              ON CONFLICT (workspace_id, linkedin_url_hash)
              DO UPDATE SET
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                email = COALESCE(EXCLUDED.email, workspace_prospects.email),
                updated_at = EXCLUDED.updated_at
              RETURNING id`,
              [
                workspaceId,
                linkedinUrl || null,
                linkedinUrlHash,
                email || null,
                firstName,
                lastName,
                p.company || p.organization || null,
                p.title || p.job_title || null,
                'csv_upload',
                'pending',
                draftId,
                p.provider_id || p.providerId || null,
                new Date().toISOString(),
                new Date().toISOString()
              ]
            );

            if (upsertResult.rows.length > 0) {
              const lookupKey = linkedinUrlHash || email;
              if (lookupKey) {
                masterProspectIds.set(lookupKey, upsertResult.rows[0].id);
              }
            }
          } catch (upsertError: any) {
            console.warn(`⚠️ Upsert warning: ${upsertError.message}`);
          }
        }

        // STEP 2: Insert to campaign_prospects WITH master_prospect_id
        for (const p of csvData) {
          const linkedinUrl = p.linkedin_url || p.linkedinUrl || p.contact?.linkedin_url;
          const email = p.email || p.contact?.email;

          if (!linkedinUrl && !email) continue;

          const linkedinUrlHash = linkedinUrl ? normalizeLinkedInUrl(linkedinUrl) : null;
          const lookupKey = linkedinUrlHash || email;

          try {
            await pool.query(
              `INSERT INTO campaign_prospects (
                campaign_id, workspace_id, master_prospect_id, first_name, last_name,
                linkedin_url, email, company_name, title, status, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              ON CONFLICT (campaign_id, linkedin_url) DO NOTHING`,
              [
                draftId,
                workspaceId,
                lookupKey ? masterProspectIds.get(lookupKey) : null,
                p.firstName || p.first_name || p.name?.split(' ')[0] || 'Unknown',
                p.lastName || p.last_name || p.name?.split(' ').slice(1).join(' ') || '',
                linkedinUrl || null,
                email || null,
                p.company || p.companyName || p.company_name || p.contact?.company || null,
                p.title || p.jobTitle || p.job_title || p.contact?.title || null,
                'pending',
                new Date().toISOString()
              ]
            );
          } catch (insertError: any) {
            console.warn(`⚠️ Insert warning: ${insertError.message}`);
          }
        }
      }

      return NextResponse.json({
        success: true,
        draftId: campaign.id,
        message: 'Draft updated successfully',
      });
    } else {
      // Create new draft
      const insertResult = await pool.query(
        `INSERT INTO campaigns (
          workspace_id, name, campaign_type, status, current_step,
          connection_message, alternative_message, follow_up_messages, draft_data,
          timezone, country_code, working_hours_start, working_hours_end,
          skip_weekends, skip_holidays, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *`,
        [
          workspaceId,
          name,
          campaignType,
          'draft',
          currentStep || 1,
          connectionMessage,
          alternativeMessage,
          JSON.stringify(followUpMessages || []),
          JSON.stringify(draftData),
          'America/Los_Angeles',
          'US',
          7,
          18,
          true,
          true,
          new Date().toISOString(),
          new Date().toISOString()
        ]
      );

      if (insertResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Failed to create draft' },
          { status: 500 }
        );
      }

      const campaign = insertResult.rows[0];

      // DATABASE-FIRST: Upsert to workspace_prospects then campaign_prospects
      console.log('💾 [DRAFT] Received csvData:', csvData?.length || 0, 'prospects');
      console.log('💾 [DRAFT] Sample prospect:', JSON.stringify(csvData?.[0], null, 2));

      if (csvData && csvData.length > 0) {
        // Map to track linkedin_url_hash -> master_prospect_id
        const masterProspectIds: Map<string, string> = new Map();

        // STEP 1: Upsert to workspace_prospects (master table)
        for (const p of csvData) {
          const linkedinUrl = p.linkedin_url || p.linkedinUrl || p.contact?.linkedin_url;
          const email = p.email || p.contact?.email;

          console.log(`💾 [PROSPECT] Processing: ${p.name}, LinkedIn: "${linkedinUrl || 'none'}", Email: "${email || 'none'}"`);

          // Skip only if prospect has NEITHER LinkedIn URL nor email
          if (!linkedinUrl && !email) {
            console.log(`⚠️  [SKIP] No LinkedIn URL OR email for: ${p.name}`);
            continue;
          }

          const linkedinUrlHash = linkedinUrl ? normalizeLinkedInUrl(linkedinUrl) : null;
          const firstName = p.firstName || p.first_name || p.name?.split(' ')[0] || 'Unknown';
          const lastName = p.lastName || p.last_name || p.name?.split(' ').slice(1).join(' ') || '';

          try {
            const upsertResult = await pool.query(
              `INSERT INTO workspace_prospects (
                workspace_id, linkedin_url, linkedin_url_hash, email, first_name, last_name,
                company, title, source, approval_status, active_campaign_id, linkedin_provider_id,
                created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
              ON CONFLICT (workspace_id, linkedin_url_hash)
              DO UPDATE SET
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                email = COALESCE(EXCLUDED.email, workspace_prospects.email),
                updated_at = EXCLUDED.updated_at
              RETURNING id`,
              [
                workspaceId,
                linkedinUrl || null,
                linkedinUrlHash,
                email || null,
                firstName,
                lastName,
                p.company || p.organization || null,
                p.title || p.job_title || null,
                'csv_upload',
                'pending',
                campaign.id,
                p.provider_id || p.providerId || null,
                new Date().toISOString(),
                new Date().toISOString()
              ]
            );

            if (upsertResult.rows.length > 0) {
              const lookupKey = linkedinUrlHash || email;
              if (lookupKey) {
                masterProspectIds.set(lookupKey, upsertResult.rows[0].id);
              }
            }
          } catch (upsertError: any) {
            console.warn(`⚠️ Upsert warning: ${upsertError.message}`);
          }
        }

        // STEP 2: Insert to campaign_prospects WITH master_prospect_id
        let insertedCount = 0;
        for (const p of csvData) {
          const linkedinUrl = p.linkedin_url || p.linkedinUrl || p.contact?.linkedin_url;
          const email = p.email || p.contact?.email;

          if (!linkedinUrl && !email) continue;

          const linkedinUrlHash = linkedinUrl ? normalizeLinkedInUrl(linkedinUrl) : null;
          const lookupKey = linkedinUrlHash || email;

          try {
            const insertResult = await pool.query(
              `INSERT INTO campaign_prospects (
                campaign_id, workspace_id, master_prospect_id, first_name, last_name,
                linkedin_url, email, company_name, title, status, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              RETURNING id`,
              [
                campaign.id,
                workspaceId,
                lookupKey ? masterProspectIds.get(lookupKey) : null,
                p.firstName || p.first_name || p.name?.split(' ')[0] || 'Unknown',
                p.lastName || p.last_name || p.name?.split(' ').slice(1).join(' ') || '',
                linkedinUrl || null,
                email || null,
                p.company || p.companyName || p.company_name || p.contact?.company || null,
                p.title || p.jobTitle || p.job_title || p.contact?.title || null,
                'pending',
                new Date().toISOString()
              ]
            );
            if (insertResult.rows.length > 0) insertedCount++;
          } catch (insertError: any) {
            console.warn(`⚠️ Insert warning: ${insertError.message}`);
          }
        }

        console.log(`✅ [SUCCESS] Inserted ${insertedCount} prospects successfully`);

        // Verify insertion
        const countResult = await pool.query(
          `SELECT COUNT(*) as count FROM campaign_prospects WHERE campaign_id = $1`,
          [campaign.id]
        );
        console.log(`✅ [VERIFY] Campaign ${campaign.id} now has ${countResult.rows[0].count} prospects in database`);
      }

      // Return prospect count in response
      const finalCountResult = await pool.query(
        `SELECT COUNT(*) as count FROM campaign_prospects WHERE campaign_id = $1`,
        [campaign.id]
      );

      return NextResponse.json({
        success: true,
        draftId: campaign.id,
        message: 'Draft created successfully',
        prospectCount: parseInt(finalCountResult.rows[0].count) || 0
      });
    }
  } catch (error: any) {
    if ((error as AuthError).statusCode) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Draft save error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/campaigns/draft?workspaceId=xxx
 * Get all draft campaigns for a workspace
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId: authWorkspaceId } = await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const draftId = searchParams.get('draftId');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    // Verify workspace membership
    const memberResult = await pool.query(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (draftId) {
      // Get specific draft
      const draftResult = await pool.query(
        `SELECT * FROM campaigns WHERE id = $1 AND workspace_id = $2 AND status = 'draft'`,
        [draftId, workspaceId]
      );

      if (draftResult.rows.length === 0) {
        return NextResponse.json({ drafts: [] });
      }

      const draft = draftResult.rows[0];

      // Enrich single draft with prospects from campaign_prospects table
      const prospectsResult = await pool.query(
        `SELECT * FROM campaign_prospects WHERE campaign_id = $1`,
        [draft.id]
      );

      const countResult = await pool.query(
        `SELECT COUNT(*) as count FROM campaign_prospects WHERE campaign_id = $1`,
        [draft.id]
      );

      const enrichedDraft = {
        ...draft,
        prospect_count: parseInt(countResult.rows[0]?.count || '0') || draft.draft_data?.csvData?.length || 0,
        prospects: prospectsResult.rows || []
      };

      console.log(`✅ [GET DRAFT] Loaded draft ${draftId} with ${prospectsResult.rows?.length || 0} prospects`);

      return NextResponse.json({ draft: enrichedDraft });
    } else {
      // Get all drafts for workspace
      const draftsResult = await pool.query(
        `SELECT * FROM campaigns WHERE workspace_id = $1 AND status = 'draft' ORDER BY updated_at DESC`,
        [workspaceId]
      );

      // Enrich drafts with prospect count AND prospects from campaign_prospects table
      const enrichedDrafts = await Promise.all(
        (draftsResult.rows || []).map(async (draft) => {
          const prospectsResult = await pool.query(
            `SELECT * FROM campaign_prospects WHERE campaign_id = $1`,
            [draft.id]
          );

          const countResult = await pool.query(
            `SELECT COUNT(*) as count FROM campaign_prospects WHERE campaign_id = $1`,
            [draft.id]
          );

          return {
            ...draft,
            prospect_count: parseInt(countResult.rows[0]?.count || '0') || draft.draft_data?.csvData?.length || 0,
            prospects: prospectsResult.rows || []
          };
        })
      );

      return NextResponse.json({ drafts: enrichedDrafts });
    }
  } catch (error: any) {
    if ((error as AuthError).statusCode) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Draft fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/campaigns/draft?draftId=xxx&workspaceId=xxx
 * Delete a draft campaign
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId, workspaceId: authWorkspaceId } = await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get('draftId');
    const workspaceId = searchParams.get('workspaceId');

    if (!draftId || !workspaceId) {
      return NextResponse.json(
        { error: 'draftId and workspaceId are required' },
        { status: 400 }
      );
    }

    // Verify workspace membership
    const memberResult = await pool.query(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete draft
    const deleteResult = await pool.query(
      `DELETE FROM campaigns WHERE id = $1 AND workspace_id = $2 AND status = 'draft'`,
      [draftId, workspaceId]
    );

    if (deleteResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Failed to delete draft' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Draft deleted successfully',
    });
  } catch (error: any) {
    if ((error as AuthError).statusCode) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Draft delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
