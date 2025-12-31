import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';
import { extractLinkedInSlug } from '@/lib/linkedin-utils';

// Helper to normalize LinkedIn URL to hash (vanity name only)
function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  if (match) return match[1].toLowerCase().trim();
  return url.replace(/^\/+|\/+$/g, '').toLowerCase().trim();
}

/**
 * Transfer approved prospects from prospect_approval_data to campaign_prospects
 * POST /api/campaigns/transfer-prospects
 * Body: { campaign_id: string, session_id?: string, campaign_name?: string }
 *
 * DATABASE-FIRST: Upserts to workspace_prospects first, then campaign_prospects with master_prospect_id FK
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, workspaceId } = await verifyAuth(req);

    const body = await req.json();
    const { campaign_id, session_id, campaign_name } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    // Find campaign
    let campaign;
    if (campaign_id) {
      const result = await pool.query(
        `SELECT * FROM campaigns WHERE workspace_id = $1 AND id = $2`,
        [workspaceId, campaign_id]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({
          error: 'Campaign not found',
          details: 'Campaign not found in this workspace'
        }, { status: 404 });
      }
      campaign = result.rows[0];
    } else if (campaign_name) {
      const result = await pool.query(
        `SELECT * FROM campaigns WHERE workspace_id = $1 AND name ILIKE $2 LIMIT 1`,
        [workspaceId, `%${campaign_name}%`]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({
          error: 'Campaign not found by name',
          searched_name: campaign_name
        }, { status: 404 });
      }
      campaign = result.rows[0];
    } else {
      return NextResponse.json({
        error: 'Either campaign_id or campaign_name required'
      }, { status: 400 });
    }

    // Dec 8 FIX: REQUIRE session_id to prevent loading old/unrelated prospects
    // The campaign_name fallback was pulling data from sessions with similar names
    if (!session_id) {
      return NextResponse.json({
        error: 'session_id is required to transfer prospects',
        message: 'Must specify which approval session to transfer from to prevent data leakage'
      }, { status: 400 });
    }

    // Get approved prospects from the specific session only
    const approvedResult = await pool.query(
      `SELECT * FROM prospect_approval_data
       WHERE approval_status = 'approved' AND session_id = $1`,
      [session_id]
    );

    const approvedProspects = approvedResult.rows;

    if (!approvedProspects || approvedProspects.length === 0) {
      return NextResponse.json({
        error: 'No approved prospects found',
        campaign_name: campaign.name,
        session_id: session_id || null
      }, { status: 404 });
    }

    // Get LinkedIn account for prospect ownership
    const linkedInAccountResult = await pool.query(
      `SELECT unipile_account_id FROM workspace_accounts
       WHERE workspace_id = $1 AND user_id = $2 AND account_type = 'linkedin'
         AND connection_status = ANY($3)
       LIMIT 1`,
      [workspaceId, userId, VALID_CONNECTION_STATUSES]
    );

    const unipileAccountId = linkedInAccountResult.rows[0]?.unipile_account_id || null;

    // DATABASE-FIRST: Upsert all prospects to workspace_prospects master table first
    console.log(`💾 Step 1: Upserting ${approvedProspects.length} prospects to workspace_prospects`);

    // Prepare master prospects data and upsert
    let masterIdMap: Record<string, string> = {};

    for (const prospect of approvedProspects) {
      const contact = prospect.contact || {};
      const linkedinUrl = contact.linkedin_url || contact.linkedinUrl || prospect.linkedin_url || null;
      const fullName = prospect.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();

      let firstName = 'Unknown';
      let lastName = '';
      if (fullName && fullName.trim() !== '') {
        const nameParts = fullName.trim().split(/\s+/);
        if (nameParts.length >= 2) {
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ');
        } else if (nameParts.length === 1) {
          firstName = nameParts[0];
        }
      }

      const linkedinUrlHash = normalizeLinkedInUrl(linkedinUrl);

      if (linkedinUrlHash) {
        try {
          const upsertResult = await pool.query(
            `INSERT INTO workspace_prospects (
              workspace_id, linkedin_url, linkedin_url_hash, first_name, last_name,
              email, company, title, location, linkedin_provider_id, source,
              created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (workspace_id, linkedin_url_hash)
            DO UPDATE SET
              first_name = EXCLUDED.first_name,
              last_name = EXCLUDED.last_name,
              email = COALESCE(EXCLUDED.email, workspace_prospects.email),
              updated_at = EXCLUDED.updated_at
            RETURNING id`,
            [
              workspaceId,
              linkedinUrl,
              linkedinUrlHash,
              firstName,
              lastName,
              contact.email || null,
              prospect.company?.name || contact.company || contact.companyName || '',
              prospect.title || contact.title || contact.headline || '',
              prospect.location || contact.location || null,
              contact.linkedin_provider_id || null,
              'transfer',
              new Date().toISOString(),
              new Date().toISOString()
            ]
          );

          if (upsertResult.rows.length > 0) {
            masterIdMap[linkedinUrlHash] = upsertResult.rows[0].id;
          }
        } catch (err) {
          console.warn(`⚠️ Master prospect upsert warning for ${linkedinUrlHash}:`, err);
        }
      }
    }

    console.log(`✅ Upserted ${Object.keys(masterIdMap).length} prospects to workspace_prospects`);

    // Transform and insert prospects with master_prospect_id
    console.log(`💾 Step 2: Inserting ${approvedProspects.length} prospects to campaign_prospects`);

    let insertedCount = 0;
    const insertErrors: string[] = [];

    for (const prospect of approvedProspects) {
      const contact = prospect.contact || {};
      const linkedinUrl = contact.linkedin_url || contact.linkedinUrl || prospect.linkedin_url || null;
      const linkedinHash = normalizeLinkedInUrl(linkedinUrl);

      // FIXED: Use prospect.name field and parse it properly
      // prospect_approval_data has "name" field, NOT contact.firstName/lastName
      const fullName = prospect.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();

      // Parse the full name properly (remove titles, credentials, etc.)
      let firstName = 'Unknown';
      let lastName = 'User';

      if (fullName && fullName.trim() !== '') {
        // Split on first space: "Hyelim Kim" -> firstName: "Hyelim", lastName: "Kim"
        const nameParts = fullName.trim().split(/\s+/);
        if (nameParts.length >= 2) {
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ');
        } else if (nameParts.length === 1) {
          firstName = nameParts[0];
          lastName = '';
        }
      }

      try {
        await pool.query(
          `INSERT INTO campaign_prospects (
            campaign_id, workspace_id, master_prospect_id, first_name, last_name,
            email, company_name, linkedin_url, linkedin_user_id, title, location,
            industry, status, notes, added_by_unipile_account, personalization_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            campaign.id,
            workspaceId,
            linkedinHash ? masterIdMap[linkedinHash] || null : null,
            firstName,
            lastName,
            contact.email || null,
            prospect.company?.name || contact.company || contact.companyName || '',
            linkedinUrl,
            extractLinkedInSlug(contact.linkedin_provider_id || linkedinUrl),
            prospect.title || contact.title || contact.headline || '',
            prospect.location || contact.location || null,
            prospect.company?.industry?.[0] || 'Not specified',
            'approved',
            null,
            unipileAccountId,
            JSON.stringify({
              source: 'manual_transfer',
              session_id: session_id || null,
              approval_data_id: prospect.id,
              transferred_at: new Date().toISOString()
            })
          ]
        );
        insertedCount++;
      } catch (insertError: any) {
        insertErrors.push(`${firstName} ${lastName}: ${insertError.message}`);
        if (insertErrors.length <= 3) {
          console.warn(`⚠️ Failed to insert prospect: ${insertError.message}`);
        }
      }
    }

    if (insertErrors.length > 0) {
      console.error(`❌ ${insertErrors.length} prospect inserts failed`);
    }

    console.log(`✅ Transferred ${insertedCount}/${approvedProspects.length} prospects`);

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name
      },
      prospects_transferred: insertedCount,
      failed: insertErrors.length,
      details: {
        from_session: session_id || 'all approved',
        linkedin_account: unipileAccountId || 'none'
      }
    });

  } catch (error: any) {
    if ((error as AuthError).statusCode) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Transfer prospects error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
