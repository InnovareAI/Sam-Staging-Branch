import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';
import { apiError, handleApiError, apiSuccess } from '@/lib/api-error-handler';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';
import { extractLinkedInSlug } from '@/lib/linkedin-utils';
import { v4 as uuidv4 } from 'uuid';

/**
 * Normalizes LinkedIn URL to hash (vanity name only)
 */
function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  if (match) return match[1].toLowerCase().trim();
  return url.replace(/^\/+|\/+$/g, '').toLowerCase().trim();
}

/**
 * GET /api/campaigns
 * Lists campaigns for a workspace with statistics
 */
export async function GET(req: NextRequest) {
  try {
    const { userId, userEmail } = await verifyAuth(req);
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) throw apiError.validation('Workspace ID required');

    // Verify membership using PG Pool
    const membershipResult = await pool.query(
      "SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'",
      [workspaceId, userId]
    );

    if (membershipResult.rowCount === 0) {
      throw apiError.forbidden('Not a member of this workspace');
    }

    // 1. Fetch campaigns
    const campaignsResult = await pool.query(`
      SELECT 
        id, name, description, campaign_type, type, status, launched_at, created_at, updated_at,
        message_templates::json, execution_preferences::json, 
        connection_message, alternative_message, follow_up_messages::json
      FROM campaigns
      WHERE workspace_id = $1
      ORDER BY created_at DESC
    `, [workspaceId]);

    const campaigns = campaignsResult.rows;

    if (campaigns.length === 0) {
      return apiSuccess({ campaigns: [] });
    }

    const campaignIds = campaigns.map(c => c.id);

    // 2. Fetch statistics (Optimized using GROUP BY)
    // We aggregate stats in SQL instead of fetching all prospect rows
    const statsResult = await pool.query(`
      SELECT 
        campaign_id,
        count(*) as total_prospects,
        count(case when status IN ('processing', 'cr_sent', 'connection_request_sent', 'fu1_sent', 'fu2_sent', 'fu3_sent', 'fu4_sent', 'fu5_sent', 'completed', 'connection_requested', 'contacted', 'connected', 'messaging', 'replied', 'follow_up_sent') then 1 end) as sent,
        count(case when status IN ('connected', 'messaging', 'replied', 'follow_up_sent') then 1 end) as connected,
        count(case when status = 'replied' OR responded_at IS NOT NULL then 1 end) as replied,
        count(case when status IN ('failed', 'error', 'already_invited', 'invitation_declined', 'rate_limited', 'rate_limited_cr', 'rate_limited_message', 'bounced') then 1 end) as failed
      FROM campaign_prospects
      WHERE campaign_id = ANY($1::uuid[])
      GROUP BY campaign_id
    `, [campaignIds]);

    const statsMap = new Map(statsResult.rows.map(row => [row.campaign_id, row]));

    // 3. Enrich campaigns
    const enrichedCampaigns = campaigns.map((campaign) => {
      const stats = statsMap.get(campaign.id) || {
        total_prospects: 0, sent: 0, connected: 0, replied: 0, failed: 0
      };

      const sent = parseInt(stats.sent);
      const replied = parseInt(stats.replied);
      const responseRate = sent > 0 ? Math.round((replied / sent) * 100) : 0;

      return {
        ...campaign,
        type: campaign.campaign_type || campaign.type,
        prospects: parseInt(stats.total_prospects),
        sent,
        opened: 0,
        replied,
        connections: parseInt(stats.connected),
        replies: replied,
        failed: parseInt(stats.failed),
        response_rate: responseRate,
        ab_stats: null // A/B stats deferred for now (complexity reduction)
      };
    });

    return apiSuccess({ campaigns: enrichedCampaigns });

  } catch (error) {
    return handleApiError(error, 'campaigns_get');
  }
}

/**
 * POST /api/campaigns
 * Creates a new campaign and optionally imports prospects
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await verifyAuth(req);
    const body = await req.json();

    const {
      workspace_id, name, description, campaign_type = 'multi_channel',
      target_icp = {}, ab_test_variant, message_templates = {},
      status = 'draft', session_id,
      initial_subject, follow_up_subjects = [], use_threaded_replies = false,
      connection_message, alternative_message, follow_up_messages = [],
      ab_testing_enabled, connection_request_b, alternative_message_b, email_body_b, initial_subject_b
    } = body;

    if (!workspace_id || !name) throw apiError.validation('Workspace ID and name required');

    // Email validation
    if (campaign_type === 'email') {
      const emailBody = message_templates?.email_body || message_templates?.alternative_message;
      const emailSubject = initial_subject || message_templates?.initial_subject || message_templates?.email_subject;
      if (!emailBody?.trim()) throw apiError.validation('Email campaigns require an email body');
      if (!emailSubject?.trim()) throw apiError.validation('Email campaigns require a subject');
    }

    // Prepare templates
    const isEmail = campaign_type === 'email';
    const finalTemplates = {
      ...message_templates,
      connection_request: isEmail ? '' : (connection_message || message_templates.connection_request || ''),
      alternative_message: isEmail ? '' : (alternative_message || message_templates.alternative_message || ''),
      email_body: isEmail ? (message_templates.email_body || alternative_message || '') : '',
      follow_up_messages: follow_up_messages.length > 0 ? follow_up_messages : (message_templates.follow_up_messages || []),
      initial_subject: initial_subject || message_templates.initial_subject || '',
      follow_up_subjects: follow_up_subjects.length > 0 ? follow_up_subjects : (message_templates.follow_up_subjects || []),
      use_threaded_replies: use_threaded_replies ?? message_templates.use_threaded_replies ?? false,
      ab_testing_enabled: ab_testing_enabled || false,
      connection_request_b: isEmail ? '' : (connection_request_b || ''),
      alternative_message_b: isEmail ? '' : (alternative_message_b || ''),
      email_body_b: isEmail ? (email_body_b || '') : '',
      initial_subject_b: initial_subject_b || ''
    };

    // 1. Insert Campaign (Direct PG Insert instead of RPC)
    const newCampaignId = uuidv4();
    const now = new Date().toISOString();

    await pool.query(`
      INSERT INTO campaigns (
        id, workspace_id, name, description, campaign_type, 
        target_icp, ab_test_variant, message_templates, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
    `, [
      newCampaignId, workspace_id, name, description, campaign_type,
      JSON.stringify(target_icp), ab_test_variant, JSON.stringify(finalTemplates), status, now
    ]);

    // 2. Auto-assign Account
    let linkedinAccountId = null;
    let account = null;

    if (campaign_type === 'connector' || campaign_type === 'messenger') {
      const waResult = await pool.query(`
        SELECT id, account_name, unipile_account_id FROM workspace_accounts 
        WHERE workspace_id = $1 AND account_type = 'linkedin' AND connection_status = ANY($2::text[]) AND is_active = true LIMIT 1
      `, [workspace_id, VALID_CONNECTION_STATUSES]);

      account = waResult.rows[0];

      if (!account) {
        // Fallback to user_unipile_accounts
        const uaResult = await pool.query(`
          SELECT id, account_name, unipile_account_id, provider FROM user_unipile_accounts
          WHERE workspace_id = $1 AND provider = 'LINKEDIN' AND connection_status IN ('connected', 'active') LIMIT 1
        `, [workspace_id]);

        if (uaResult.rows[0]) {
          account = { id: uaResult.rows[0].id, account_name: uaResult.rows[0].account_name, unipile_account_id: uaResult.rows[0].unipile_account_id };
        }
      }

      if (!account) {
        // Rollback (delete campaign)
        await pool.query('DELETE FROM campaigns WHERE id = $1', [newCampaignId]);
        throw apiError.validation('LinkedIn account not configured');
      }
      linkedinAccountId = account.id;
    } else if (campaign_type === 'email') {
      const eaResult = await pool.query(`
        SELECT id, account_name FROM workspace_accounts 
        WHERE workspace_id = $1 AND account_type = 'email' AND connection_status = ANY($2::text[]) AND is_active = true LIMIT 1
      `, [workspace_id, VALID_CONNECTION_STATUSES]);

      if (!eaResult.rows[0]) {
        await pool.query('DELETE FROM campaigns WHERE id = $1', [newCampaignId]);
        throw apiError.validation('Email account not configured');
      }
      linkedinAccountId = eaResult.rows[0].id;
    }

    // 3. Update flow settings
    const flowSettings = {
      campaign_type: campaign_type === 'email' ? 'email' : 'linkedin_connection',
      connection_wait_hours: 36,
      followup_wait_days: 5,
      message_wait_days: 5,
      messages: {
        connection_request: finalTemplates.connection_request || null,
        follow_up_1: finalTemplates.follow_up_messages?.[0] || null,
        follow_up_2: finalTemplates.follow_up_messages?.[1] || null,
        follow_up_3: finalTemplates.follow_up_messages?.[2] || null,
        follow_up_4: finalTemplates.follow_up_messages?.[3] || null,
        follow_up_5: finalTemplates.follow_up_messages?.[4] || null,
        goodbye: finalTemplates.follow_up_messages?.[5] || null,
        alternative: finalTemplates.alternative_message || null
      },
      subjects: {
        initial: finalTemplates.initial_subject || null,
        follow_ups: finalTemplates.follow_up_subjects || [],
        use_threaded_replies: finalTemplates.use_threaded_replies || false
      }
    };

    await pool.query(`
      UPDATE campaigns SET 
        flow_settings = $1, linkedin_account_id = $2,
        timezone = 'America/Los_Angeles', country_code = 'US',
        working_hours_start = 7, working_hours_end = 18,
        skip_weekends = true, skip_holidays = true
      WHERE id = $3
    `, [JSON.stringify(flowSettings), linkedinAccountId, newCampaignId]);

    // 4. Auto-transfer prospects from session
    if (session_id) {
      console.log(`📦 Auto-transfer session ${session_id} to campaign ${newCampaignId}`);

      // Link session
      await pool.query('UPDATE prospect_approval_sessions SET campaign_id = $1 WHERE id = $2', [newCampaignId, session_id]);

      // Get approved prospects
      const decisionsResult = await pool.query(
        "SELECT prospect_id FROM prospect_approval_decisions WHERE session_id = $1 AND decision = 'approved'",
        [session_id]
      );

      const approvedIds = decisionsResult.rows.map(r => r.prospect_id);

      if (approvedIds.length > 0) {
        // Fetch prospect data
        const prospectsResult = await pool.query(
          'SELECT * FROM prospect_approval_data WHERE session_id = $1 AND prospect_id = ANY($2::text[])',
          [session_id, approvedIds]
        );
        const approvedProspects = prospectsResult.rows;

        // Use Unipile ID from assigned account
        const unipileAccountId = account?.unipile_account_id || null;

        // Upsert to workspace_prospects and campaign_prospects
        // We do this in a loop for simplicity given complexity of upsert logic, similar to original code
        for (const prospect of approvedProspects) {
          const contact = prospect.contact || {};
          const linkedinUrl = contact.linkedin_url || contact.linkedinUrl || prospect.linkedin_url || null;
          const hash = normalizeLinkedInUrl(linkedinUrl);

          if (!hash) continue; // Skip if no hashable URL

          const fullName = prospect.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
          const pData = {
            workspace_id,
            linkedin_url: linkedinUrl,
            linkedin_url_hash: hash,
            email: contact.email || null,
            first_name: fullName.split(' ')[0] || 'Unknown',
            last_name: fullName.split(' ').slice(1).join(' ') || '',
            company: prospect.company?.name || contact.company || '',
            title: prospect.title || contact.title || '',
            location: prospect.location || contact.location || null,
            source: 'approval_session',
            approval_status: 'approved',
            approved_by: userId,
            approved_at: now,
            active_campaign_id: newCampaignId
          };

          // Upsert Master
          const upsertResult = await pool.query(`
            INSERT INTO workspace_prospects (
              workspace_id, linkedin_url, linkedin_url_hash, email, first_name, last_name, 
              company, title, location, source, approval_status, approved_by, approved_at, active_campaign_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (workspace_id, linkedin_url_hash) DO UPDATE SET
              active_campaign_id = EXCLUDED.active_campaign_id,
              approval_status = 'approved'
            RETURNING id
          `, [
            pData.workspace_id, pData.linkedin_url, pData.linkedin_url_hash, pData.email, pData.first_name, pData.last_name,
            pData.company, pData.title, pData.location, pData.source, pData.approval_status, pData.approved_by, pData.approved_at, pData.active_campaign_id
          ]);

          const masterId = upsertResult.rows[0].id;

          // Insert Campaign Prospect
          await pool.query(`
            INSERT INTO campaign_prospects (
              campaign_id, workspace_id, master_prospect_id, first_name, last_name, email,
              company_name, linkedin_url, title, location, status, added_by_unipile_account
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'approved', $11)
          `, [
            newCampaignId, workspace_id, masterId, pData.first_name, pData.last_name, pData.email,
            pData.company, pData.linkedin_url, pData.title, pData.location, unipileAccountId
          ]);
        }

        // Update approval statuses
        await pool.query(`
          UPDATE prospect_approval_data SET 
            approval_status = 'transferred_to_campaign',
            transferred_at = $1,
            transferred_to_campaign_id = $2
          WHERE session_id = $3 AND prospect_id = ANY($4::text[])
        `, [now, newCampaignId, session_id, approvedIds]);
      }
    }

    // Fetch created campaign
    const finalCampaignResult = await pool.query('SELECT * FROM campaigns WHERE id = $1', [newCampaignId]);
    return apiSuccess({ campaign: finalCampaignResult.rows[0] });

  } catch (error) {
    return handleApiError(error, 'campaigns_create');
  }
}