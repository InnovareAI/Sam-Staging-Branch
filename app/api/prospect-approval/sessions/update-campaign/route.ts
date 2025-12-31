import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { MESSAGE_HARD_LIMITS } from '@/lib/anti-detection/message-variance';
import { personalizeMessage } from '@/lib/personalization';

/**
 * Extract LinkedIn slug from URL or return as-is if already a slug
 */
function extractLinkedInSlug(urlOrSlug: string): string {
  if (!urlOrSlug) return '';
  if (!urlOrSlug.includes('/') && !urlOrSlug.includes('http')) return urlOrSlug;
  const match = urlOrSlug.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  return match ? match[1] : urlOrSlug;
}

/**
 * PATCH /api/prospect-approval/sessions/update-campaign
 * Update campaign for an approval session
 *
 * IMPORTANT: When campaign_id is set and session has approved prospects,
 * this endpoint will transfer those prospects to campaign_prospects table.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId, workspaceId } = await verifyAuth(request);

    const { session_id, campaign_name, campaign_id } = await request.json();

    if (!session_id) {
      return NextResponse.json({
        success: false,
        error: 'Session ID required'
      }, { status: 400 });
    }

    if (!campaign_name && !campaign_id) {
      return NextResponse.json({
        success: false,
        error: 'Campaign name or campaign ID required'
      }, { status: 400 });
    }

    // Verify session belongs to user's workspace
    const sessionResult = await pool.query(
      'SELECT workspace_id FROM prospect_approval_sessions WHERE id = $1',
      [session_id]
    );

    if (sessionResult.rows.length === 0 || sessionResult.rows[0].workspace_id !== workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'Session not found or access denied'
      }, { status: 403 });
    }

    // Build update query
    let updateParts: string[] = [];
    let params: any[] = [];
    let paramCount = 0;

    if (campaign_name) {
      paramCount++;
      updateParts.push(`campaign_name = $${paramCount}`);
      params.push(campaign_name);
    }
    if (campaign_id) {
      paramCount++;
      updateParts.push(`campaign_id = $${paramCount}`);
      params.push(campaign_id);
    }

    paramCount++;
    params.push(session_id);

    // Update session
    await pool.query(
      `UPDATE prospect_approval_sessions SET ${updateParts.join(', ')} WHERE id = $${paramCount}`,
      params
    );

    console.log(`✅ Updated session ${session_id}:`, { campaign_name, campaign_id });

    // AUTO-TRANSFER: If campaign_id was just set, transfer any already-approved prospects
    let transferredCount = 0;
    let queuedCount = 0;

    if (campaign_id) {
      console.log(`📦 Checking for approved prospects to transfer to campaign ${campaign_id}`);

      // Get all approved decisions for this session
      const approvedDecisionsResult = await pool.query(
        `SELECT prospect_id FROM prospect_approval_decisions WHERE session_id = $1 AND decision = 'approved'`,
        [session_id]
      );
      const approvedDecisions = approvedDecisionsResult.rows;

      if (approvedDecisions && approvedDecisions.length > 0) {
        const approvedProspectIds = approvedDecisions.map(d => d.prospect_id);
        console.log(`📦 Found ${approvedProspectIds.length} approved prospects to transfer`);

        // Get the prospect data
        const prospectDataResult = await pool.query(
          'SELECT * FROM prospect_approval_data WHERE prospect_id = ANY($1)',
          [approvedProspectIds]
        );
        const prospectData = prospectDataResult.rows;

        // Get existing prospects in campaign to avoid duplicates
        const existingResult = await pool.query(
          'SELECT linkedin_url FROM campaign_prospects WHERE campaign_id = $1',
          [campaign_id]
        );

        const existingUrls = new Set(
          (existingResult.rows || [])
            .map(p => p.linkedin_url?.toLowerCase())
            .filter(Boolean)
        );

        // Prepare new campaign prospects
        const newCampaignProspects = [];
        for (const p of prospectData || []) {
          const linkedinUrl = p.contact?.linkedin_url;
          if (!linkedinUrl) continue;
          if (existingUrls.has(linkedinUrl.toLowerCase())) continue;

          const nameParts = (p.name || '').split(' ');
          newCampaignProspects.push({
            campaign_id: campaign_id,
            workspace_id: workspaceId,
            first_name: nameParts[0] || 'Unknown',
            last_name: nameParts.slice(1).join(' ') || '',
            title: p.title || '',
            company_name: p.company?.name || '',
            linkedin_url: linkedinUrl,
            linkedin_user_id: extractLinkedInSlug(linkedinUrl),
            email: p.contact?.email || null,
            status: 'approved'
          });
        }

        // Insert prospects one by one to avoid losing data on constraint violations
        if (newCampaignProspects.length > 0) {
          let insertFailures: string[] = [];

          for (const prospect of newCampaignProspects) {
            try {
              await pool.query(
                `INSERT INTO campaign_prospects (campaign_id, workspace_id, first_name, last_name, title, company_name, linkedin_url, linkedin_user_id, email, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [prospect.campaign_id, prospect.workspace_id, prospect.first_name, prospect.last_name,
                 prospect.title, prospect.company_name, prospect.linkedin_url, prospect.linkedin_user_id,
                 prospect.email, prospect.status]
              );
              transferredCount++;
            } catch (insertError: any) {
              insertFailures.push(`${prospect.first_name} ${prospect.last_name}: ${insertError.message}`);
              console.warn(`⚠️ Failed to insert prospect ${prospect.first_name} ${prospect.last_name}:`, insertError.message);
            }
          }

          if (insertFailures.length > 0) {
            console.error(`⚠️ ${insertFailures.length} prospects failed to insert:`, insertFailures.slice(0, 5));
          }
          console.log(`✅ Transferred ${transferredCount}/${newCampaignProspects.length} prospects to campaign_prospects`);

          // AUTO-QUEUE: Get campaign template and add to send_queue if campaign is active
          const campaignResult = await pool.query(
            'SELECT message_templates, status, linkedin_account_id FROM campaigns WHERE id = $1',
            [campaign_id]
          );
          const campaign = campaignResult.rows[0];

          if (campaign?.status === 'active' && campaign?.linkedin_account_id) {
            const connectionMessage = campaign.message_templates?.connection_request || '';

            if (connectionMessage) {
              // Get newly inserted prospects
              const insertedProspectsResult = await pool.query(
                `SELECT id, first_name, company_name, title, linkedin_url, linkedin_user_id
                 FROM campaign_prospects WHERE campaign_id = $1 AND status = 'approved'`,
                [campaign_id]
              );
              const insertedProspects = insertedProspectsResult.rows;

              // Get existing queue to avoid duplicates
              const existingQueueResult = await pool.query(
                'SELECT prospect_id FROM send_queue WHERE campaign_id = $1',
                [campaign_id]
              );

              const queuedProspectIds = new Set((existingQueueResult.rows || []).map(q => q.prospect_id));
              const prospectsToQueue = (insertedProspects || []).filter(p => !queuedProspectIds.has(p.id));

              if (prospectsToQueue.length > 0) {
                let currentTime = new Date();
                currentTime.setMinutes(currentTime.getMinutes() + 30);

                const gapMinutes = MESSAGE_HARD_LIMITS.MIN_CR_GAP_MINUTES;

                for (let idx = 0; idx < prospectsToQueue.length; idx++) {
                  const p = prospectsToQueue[idx];
                  // Use universal personalization (handles company name normalization)
                  const message = personalizeMessage(connectionMessage, {
                    first_name: p.first_name,
                    company_name: p.company_name,
                    title: p.title
                  });

                  const scheduledFor = new Date(currentTime.getTime() + idx * gapMinutes * 60 * 1000);

                  // Extract slug from URL for linkedin_user_id (not full URL)
                  const linkedinId = extractLinkedInSlug(p.linkedin_user_id || p.linkedin_url);

                  try {
                    await pool.query(
                      `INSERT INTO send_queue (campaign_id, prospect_id, linkedin_user_id, message, scheduled_for, status, message_type)
                       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                      [campaign_id, p.id, linkedinId, message, scheduledFor.toISOString(), 'pending', 'connection_request']
                    );
                    queuedCount++;
                  } catch (queueError: any) {
                    console.warn(`⚠️ Failed to queue prospect ${p.id}:`, queueError.message);
                  }
                }
                console.log(`✅ Queued ${queuedCount}/${prospectsToQueue.length} prospects for sending`);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      campaign_name,
      campaign_id,
      transferred: transferredCount,
      queued: queuedCount
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Update campaign name error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
