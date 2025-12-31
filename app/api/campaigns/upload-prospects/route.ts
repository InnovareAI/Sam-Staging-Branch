import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { enrichProspectName } from '@/lib/enrich-prospect-name';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';
import { extractLinkedInSlug } from '@/lib/linkedin-utils';

// Increase timeout for large prospect uploads (default 10s is too short)
export const maxDuration = 60; // 60 seconds

// Helper to normalize LinkedIn URL to hash (vanity name only)
function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  if (match) return match[1].toLowerCase().trim();
  return url.replace(/^\/+|\/+$/g, '').toLowerCase().trim();
}

// Simple JSON-based prospect upload for campaigns
// Used by CampaignHub when prospects are already in memory (not from CSV upload)
// IMPORTANT: Automatically enriches missing names from LinkedIn via Unipile
// DATABASE-FIRST: Upserts to workspace_prospects first, then campaign_prospects with master_prospect_id FK

export async function POST(req: NextRequest) {
  try {
    const { userId, workspaceId } = await verifyAuth(req);

    const body = await req.json();
    const { campaign_id, prospects } = body;

    console.log('📥 Upload prospects request:', {
      campaign_id,
      prospect_count: prospects?.length,
      user_id: userId
    });

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 });
    }

    if (!prospects || !Array.isArray(prospects) || prospects.length === 0) {
      return NextResponse.json({ error: 'prospects array is required and must not be empty' }, { status: 400 });
    }

    // Verify campaign exists and user has access
    console.log('🔍 Checking campaign access:', { campaign_id, user_id: userId });
    const campaignResult = await pool.query(
      `SELECT id, name, workspace_id, created_by FROM campaigns WHERE id = $1`,
      [campaign_id]
    );

    if (campaignResult.rows.length === 0) {
      console.error('❌ Campaign not found:', { campaign_id, user_id: userId });
      return NextResponse.json({
        error: 'Campaign not found or access denied',
        details: 'Campaign not found'
      }, { status: 404 });
    }

    const campaign = campaignResult.rows[0];
    console.log('📊 Campaign found:', { id: campaign.id, name: campaign.name, workspace_id: campaign.workspace_id });

    // Verify user has access to this workspace
    const memberResult = await pool.query(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [campaign.workspace_id, userId]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
    }

    // Get the campaign creator's LinkedIn account for name enrichment
    const linkedInAccountResult = await pool.query(
      `SELECT unipile_account_id FROM workspace_accounts
       WHERE workspace_id = $1 AND user_id = $2 AND account_type = 'linkedin'
         AND connection_status = ANY($3)
       LIMIT 1`,
      [campaign.workspace_id, campaign.created_by, VALID_CONNECTION_STATUSES]
    );

    const unipileAccountId = linkedInAccountResult.rows[0]?.unipile_account_id || null;

    let inserted_count = 0;
    let updated_count = 0;
    let error_count = 0;
    const errors: { index: number; error: string }[] = [];
    const failedUploads: { row: number; error: string; data: any }[] = [];

    // Process each prospect
    for (let i = 0; i < prospects.length; i++) {
      try {
        const prospect = prospects[i];

        // DEBUG: Log what we received (ENHANCED FOR DEBUGGING)
        console.log(`\n🔍 ===== PROSPECT ${i + 1} RAW DATA =====`);
        console.log('Full prospect object:', JSON.stringify(prospect, null, 2));
        console.log('Key fields:');
        console.log('  - name:', prospect.name);
        console.log('  - first_name:', prospect.first_name);
        console.log('  - linkedin_url (direct):', prospect.linkedin_url);
        console.log('  - linkedin_profile_url:', prospect.linkedin_profile_url);
        console.log('  - contact object:', JSON.stringify(prospect.contact, null, 2));
        console.log('  - contact.linkedin_url:', prospect.contact?.linkedin_url);
        console.log('  - company.name:', prospect.company?.name);
        console.log('==========================================\n');

        // Prepare prospect data with automatic name enrichment
        // CRITICAL: Handle both direct fields and nested JSONB fields (contact, company)

        // Extract names from SAM data first
        let firstName = prospect.first_name?.trim() || (prospect.name ? prospect.name.split(' ')[0]?.trim() : '');
        let lastName = prospect.last_name?.trim() || (prospect.name ? prospect.name.split(' ').slice(1).join(' ')?.trim() : '');

        // MANDATORY ENRICHMENT: If names missing or empty, fetch from LinkedIn
        if (!firstName || !lastName || firstName === '' || lastName === '') {
          const linkedinUrl = prospect.linkedin_url || prospect.linkedin_profile_url || prospect.contact?.linkedin_url || null;

          if (linkedinUrl && unipileAccountId) {
            console.log(`⚠️ Missing name for prospect ${i + 1}, ENRICHING from LinkedIn (REQUIRED)`);

            const enriched = await enrichProspectName(
              linkedinUrl,
              firstName,
              lastName,
              unipileAccountId
            );

            firstName = enriched.firstName;
            lastName = enriched.lastName;

            if (enriched.enriched) {
              console.log(`✅ Successfully enriched name: ${firstName} ${lastName}`);
            }
          }

          // CRITICAL: Reject prospects without names
          if (!firstName || !lastName || firstName === '' || lastName === '') {
            console.error(`❌ REJECTING prospect ${i + 1}: Missing name even after enrichment`);
            failedUploads.push({
              row: i + 1,
              error: 'Missing required field: first_name or last_name',
              data: prospect
            });
            continue; // Skip this prospect
          }
        }

        const linkedinUrl = prospect.linkedin_url || prospect.linkedin_profile_url || prospect.contact?.linkedin_url || null;

        const prospectData = {
          campaign_id: campaign_id,
          workspace_id: campaign.workspace_id,
          first_name: firstName,
          last_name: lastName,
          email: prospect.email || prospect.email_address || prospect.contact?.email || null,
          company_name: prospect.company_name || prospect.company?.name || prospect.company || '',
          title: prospect.title || prospect.job_title || '',
          linkedin_url: linkedinUrl,
          // CRITICAL FIX (Dec 18): Extract slug from URL to prevent "User ID does not match format" errors
          linkedin_user_id: extractLinkedInSlug(prospect.linkedin_user_id || linkedinUrl),
          phone: prospect.phone || prospect.contact?.phone || null,
          location: prospect.location || '',
          industry: prospect.industry || prospect.company?.industry?.[0] || prospect.company?.industry || null,
          status: 'pending',
          notes: prospect.notes || null,
          personalization_data: JSON.stringify({
            ...(prospect.personalization_data || {}),
            campaign_name: campaign.name,  // ALWAYS include campaign name
            source: 'upload_prospects',
            uploaded_at: new Date().toISOString()
          }),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        console.log('💾 PREPARED DATA TO STORE:');
        console.log('  - first_name:', prospectData.first_name);
        console.log('  - last_name:', prospectData.last_name);
        console.log('  - linkedin_url:', prospectData.linkedin_url);
        console.log('  - company_name:', prospectData.company_name);
        console.log('  - email:', prospectData.email);

        // DATABASE-FIRST: Upsert to workspace_prospects master table
        const linkedinHash = normalizeLinkedInUrl(prospectData.linkedin_url);
        let masterProspectId: string | null = null;

        if (linkedinHash) {
          try {
            const masterResult = await pool.query(
              `INSERT INTO workspace_prospects (
                workspace_id, linkedin_url, linkedin_url_hash, first_name, last_name,
                email, company, title, location, linkedin_provider_id, source,
                active_campaign_id, approval_status, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
              ON CONFLICT (workspace_id, linkedin_url_hash)
              DO UPDATE SET
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                email = COALESCE(EXCLUDED.email, workspace_prospects.email),
                updated_at = EXCLUDED.updated_at
              RETURNING id`,
              [
                campaign.workspace_id,
                prospectData.linkedin_url,
                linkedinHash,
                prospectData.first_name,
                prospectData.last_name,
                prospectData.email,
                prospectData.company_name,
                prospectData.title,
                prospectData.location,
                prospectData.linkedin_user_id,
                'campaign_upload',
                campaign_id,
                'approved',
                prospectData.created_at,
                prospectData.updated_at
              ]
            );

            if (masterResult.rows.length > 0) {
              masterProspectId = masterResult.rows[0].id;
              console.log(`✅ Upserted to workspace_prospects: ${masterProspectId}`);
            }
          } catch (masterError: any) {
            console.warn(`⚠️ Master prospect upsert warning for ${linkedinHash}:`, masterError.message);
            // Try to get existing record
            const existingResult = await pool.query(
              `SELECT id FROM workspace_prospects WHERE workspace_id = $1 AND linkedin_url_hash = $2`,
              [campaign.workspace_id, linkedinHash]
            );
            masterProspectId = existingResult.rows[0]?.id || null;
          }
        }

        // Check if prospect already exists for this campaign (by email OR linkedin_url)
        // FIX: Previously only checked email, causing duplicates for LinkedIn-only prospects
        let existingId: string | null = null;

        // Check by email first (if not empty)
        if (prospectData.email && prospectData.email.trim() !== '') {
          const emailResult = await pool.query(
            `SELECT id FROM campaign_prospects WHERE campaign_id = $1 AND email = $2`,
            [campaign_id, prospectData.email]
          );
          existingId = emailResult.rows[0]?.id || null;
        }

        // Check by linkedin_url if not found by email
        if (!existingId && prospectData.linkedin_url && prospectData.linkedin_url.trim() !== '') {
          const linkedinResult = await pool.query(
            `SELECT id FROM campaign_prospects WHERE campaign_id = $1 AND linkedin_url = $2`,
            [campaign_id, prospectData.linkedin_url]
          );
          existingId = linkedinResult.rows[0]?.id || null;
        }

        if (existingId) {
          // Update existing prospect with master_prospect_id
          try {
            await pool.query(
              `UPDATE campaign_prospects SET
                first_name = $1, last_name = $2, email = $3, company_name = $4, title = $5,
                linkedin_url = $6, linkedin_user_id = $7, phone = $8, location = $9,
                industry = $10, notes = $11, personalization_data = $12,
                master_prospect_id = $13, updated_at = $14
              WHERE id = $15`,
              [
                prospectData.first_name,
                prospectData.last_name,
                prospectData.email,
                prospectData.company_name,
                prospectData.title,
                prospectData.linkedin_url,
                prospectData.linkedin_user_id,
                prospectData.phone,
                prospectData.location,
                prospectData.industry,
                prospectData.notes,
                prospectData.personalization_data,
                masterProspectId,
                new Date().toISOString(),
                existingId
              ]
            );
            updated_count++;
          } catch (updateError: any) {
            error_count++;
            errors.push({ index: i, error: updateError.message });
          }
        } else {
          // Insert new prospect with master_prospect_id FK
          try {
            const insertResult = await pool.query(
              `INSERT INTO campaign_prospects (
                campaign_id, workspace_id, master_prospect_id, first_name, last_name,
                email, company_name, title, linkedin_url, linkedin_user_id, phone,
                location, industry, status, notes, personalization_data, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
              RETURNING id`,
              [
                prospectData.campaign_id,
                prospectData.workspace_id,
                masterProspectId,
                prospectData.first_name,
                prospectData.last_name,
                prospectData.email,
                prospectData.company_name,
                prospectData.title,
                prospectData.linkedin_url,
                prospectData.linkedin_user_id,
                prospectData.phone,
                prospectData.location,
                prospectData.industry,
                prospectData.status,
                prospectData.notes,
                prospectData.personalization_data,
                prospectData.created_at,
                prospectData.updated_at
              ]
            );

            if (insertResult.rows.length > 0) {
              inserted_count++;
            }
          } catch (insertError: any) {
            error_count++;
            errors.push({ index: i, error: insertError.message });
          }
        }
      } catch (error: any) {
        error_count++;
        errors.push({ index: i, error: error.message });
      }
    }

    // Count prospects with LinkedIn IDs
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM campaign_prospects
       WHERE campaign_id = $1 AND linkedin_user_id IS NOT NULL`,
      [campaign_id]
    );
    const prospects_with_linkedin_ids = parseInt(countResult.rows[0]?.count || '0');

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
      prospects_with_linkedin_ids,
      error_details: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    if ((error as AuthError).statusCode) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Prospect upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload prospects', details: error.message },
      { status: 500 }
    );
  }
}
