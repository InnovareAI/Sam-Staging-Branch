import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { MESSAGE_HARD_LIMITS } from '@/lib/anti-detection/message-variance';
import { personalizeMessage } from '@/lib/personalization';
import { resolveToProviderId, extractLinkedInSlug } from '@/lib/resolve-linkedin-id';

/**
 * POST /api/prospect-approval/bulk-approve
 * Bulk approve/reject prospects across all pages
 * Supports filtering by status for "approve all pending" scenarios
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await verifyAuth(request);

    const body = await request.json();
    const { session_id, operation, status_filter, prospect_ids } = body;

    if (!session_id) {
      return NextResponse.json({
        success: false,
        error: 'Session ID required'
      }, { status: 400 });
    }

    if (!operation || !['approve', 'reject'].includes(operation)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid operation. Must be "approve" or "reject"'
      }, { status: 400 });
    }

    // Verify session belongs to workspace
    const sessionResult = await pool.query(
      'SELECT workspace_id FROM prospect_approval_sessions WHERE id = $1',
      [session_id]
    );

    if (sessionResult.rows.length === 0 || sessionResult.rows[0].workspace_id !== workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    const decision = operation === 'approve' ? 'approved' : 'rejected';

    // If specific prospect IDs provided, use those
    if (prospect_ids && Array.isArray(prospect_ids) && prospect_ids.length > 0) {
      // Bulk decision for specific prospects - insert with ON CONFLICT UPDATE
      for (const prospect_id of prospect_ids) {
        await pool.query(
          `INSERT INTO prospect_approval_decisions (session_id, prospect_id, decision, decided_by, decided_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (session_id, prospect_id)
           DO UPDATE SET decision = $3, decided_by = $4, decided_at = $5`,
          [session_id, prospect_id, decision, userId, new Date().toISOString()]
        );
      }

      return NextResponse.json({
        success: true,
        count: prospect_ids.length,
        operation: decision
      });
    }

    // Otherwise, bulk approve/reject all (with optional status filter)
    // First, get all prospect IDs that match the criteria
    let query = 'SELECT prospect_id FROM prospect_approval_data WHERE session_id = $1';
    const params: any[] = [session_id];

    // Apply status filter if provided (e.g., only pending)
    if (status_filter && status_filter !== 'all') {
      query += ' AND approval_status = $2';
      params.push(status_filter);
    }

    const prospectsResult = await pool.query(query, params);
    const prospects = prospectsResult.rows;

    if (!prospects || prospects.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        operation: decision,
        message: 'No prospects found matching criteria'
      });
    }

    // Create decision records for all prospects in batches
    const BATCH_SIZE = 100;
    let processedCount = 0;
    const decidedAt = new Date().toISOString();

    for (let i = 0; i < prospects.length; i += BATCH_SIZE) {
      const batch = prospects.slice(i, i + BATCH_SIZE);

      for (const p of batch) {
        await pool.query(
          `INSERT INTO prospect_approval_decisions (session_id, prospect_id, decision, decided_by, decided_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (session_id, prospect_id)
           DO UPDATE SET decision = $3, decided_by = $4, decided_at = $5`,
          [session_id, p.prospect_id, decision, userId, decidedAt]
        );
        processedCount++;
      }
    }

    // Update session counts
    const approvedCountResult = await pool.query(
      `SELECT COUNT(*) as count FROM prospect_approval_decisions WHERE session_id = $1 AND decision = 'approved'`,
      [session_id]
    );
    const rejectedCountResult = await pool.query(
      `SELECT COUNT(*) as count FROM prospect_approval_decisions WHERE session_id = $1 AND decision = 'rejected'`,
      [session_id]
    );

    const approved = parseInt(approvedCountResult.rows[0].count);
    const rejected = parseInt(rejectedCountResult.rows[0].count);
    const totalProspects = prospects.length;
    const pending = totalProspects - approved - rejected;

    await pool.query(
      `UPDATE prospect_approval_sessions SET approved_count = $1, rejected_count = $2, pending_count = $3 WHERE id = $4`,
      [approved, rejected, pending, session_id]
    );

    console.log(`✅ Bulk ${operation}: ${processedCount} prospects in session ${session_id}`);

    // AUTO-TRANSFER: If approving and session has a campaign_id, transfer to campaign_prospects
    let transferredCount = 0;
    let queuedCount = 0;

    if (operation === 'approve') {
      // Get session details including campaign_id
      const sessionDataResult = await pool.query(
        'SELECT campaign_id, workspace_id FROM prospect_approval_sessions WHERE id = $1',
        [session_id]
      );
      const sessionData = sessionDataResult.rows[0];

      if (sessionData?.campaign_id) {
        console.log(`📦 Auto-transferring approved prospects to campaign ${sessionData.campaign_id}`);

        // Get all approved prospect data for this session
        const approvedProspectIds = prospects.map(p => p.prospect_id);
        const prospectDataResult = await pool.query(
          'SELECT * FROM prospect_approval_data WHERE prospect_id = ANY($1)',
          [approvedProspectIds]
        );
        const prospectData = prospectDataResult.rows;

        // Get existing prospects in campaign to avoid duplicates
        const existingResult = await pool.query(
          'SELECT linkedin_url FROM campaign_prospects WHERE campaign_id = $1',
          [sessionData.campaign_id]
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
            campaign_id: sessionData.campaign_id,
            workspace_id: sessionData.workspace_id,
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

          // AUTO-QUEUE: Get campaign template and add to send_queue
          const campaignResult = await pool.query(
            'SELECT message_templates, status, linkedin_account_id FROM campaigns WHERE id = $1',
            [sessionData.campaign_id]
          );
          const campaign = campaignResult.rows[0];

          if (campaign?.status === 'active' && campaign?.linkedin_account_id) {
            const connectionMessage = campaign.message_templates?.connection_request || '';

            if (connectionMessage) {
              // Get newly inserted prospects
              const insertedProspectsResult = await pool.query(
                `SELECT id, first_name, company_name, title, linkedin_url, linkedin_user_id
                 FROM campaign_prospects WHERE campaign_id = $1 AND status = 'approved'`,
                [sessionData.campaign_id]
              );
              const insertedProspects = insertedProspectsResult.rows;

              // Get existing queue to avoid duplicates
              const existingQueueResult = await pool.query(
                'SELECT prospect_id FROM send_queue WHERE campaign_id = $1',
                [sessionData.campaign_id]
              );

              const queuedProspectIds = new Set((existingQueueResult.rows || []).map(q => q.prospect_id));
              const prospectsToQueue = (insertedProspects || []).filter(p => !queuedProspectIds.has(p.id));

              if (prospectsToQueue.length > 0) {
                let currentTime = new Date();
                currentTime.setMinutes(currentTime.getMinutes() + 30);

                const gapMinutes = MESSAGE_HARD_LIMITS.MIN_CR_GAP_MINUTES;

                for (let idx = 0; idx < prospectsToQueue.length; idx++) {
                  const p = prospectsToQueue[idx];
                  const message = personalizeMessage(connectionMessage, {
                    first_name: p.first_name,
                    company_name: p.company_name,
                    title: p.title
                  });

                  const scheduledFor = new Date(currentTime.getTime() + idx * gapMinutes * 60 * 1000);
                  let linkedinId = extractLinkedInSlug(p.linkedin_user_id || p.linkedin_url);

                  // Resolve vanity to provider_id before insertion
                  if (!linkedinId.startsWith('ACo') && !linkedinId.startsWith('ACw')) {
                    try {
                      linkedinId = await resolveToProviderId(linkedinId, campaign.linkedin_account_id);
                    } catch (err) {
                      console.warn(`⚠️ Could not resolve provider_id for ${p.first_name}: ${err}`);
                    }
                  }

                  try {
                    await pool.query(
                      `INSERT INTO send_queue (campaign_id, prospect_id, linkedin_user_id, message, scheduled_for, status, message_type)
                       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                      [sessionData.campaign_id, p.id, linkedinId, message, scheduledFor.toISOString(), 'pending', 'connection_request']
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
      count: processedCount,
      operation: decision,
      counts: {
        approved,
        rejected,
        pending
      },
      transferred: transferredCount,
      queued: queuedCount
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Bulk approve error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
