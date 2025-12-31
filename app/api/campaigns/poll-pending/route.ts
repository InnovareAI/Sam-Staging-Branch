import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/auth';

/**
 * N8N Polling Endpoint - Returns pending prospects that need CRs sent
 * Called by N8N Schedule Trigger every 5 minutes
 */
export async function GET(request: NextRequest) {
  try {
    // Verify internal trigger
    const trigger = request.headers.get('x-internal-trigger');
    if (trigger !== 'n8n-polling') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get pending prospects (limit to 10 per poll to avoid overwhelming)
    const prospectsResult = await pool.query(
      `SELECT
        cp.id,
        cp.campaign_id,
        cp.first_name,
        cp.last_name,
        cp.linkedin_url,
        cp.status,
        cp.company_name,
        cp.title,
        c.id as campaign_id,
        c.name as campaign_name,
        c.workspace_id,
        c.connection_message,
        c.message_templates
       FROM campaign_prospects cp
       JOIN campaigns c ON cp.campaign_id = c.id
       WHERE cp.status IN ('pending', 'approved', 'ready_to_message')
         AND cp.linkedin_url IS NOT NULL
         AND cp.contacted_at IS NULL
       ORDER BY cp.created_at ASC
       LIMIT 10`
    );

    const prospects = prospectsResult.rows;

    if (!prospects || prospects.length === 0) {
      return NextResponse.json({
        prospects: [],
        count: 0,
        message: 'No pending prospects'
      });
    }

    // Group prospects by campaign to batch process
    const campaignMap = new Map();

    for (const prospect of prospects) {
      const campaignId = prospect.campaign_id;

      if (!campaignMap.has(campaignId)) {
        // Get LinkedIn account for this campaign's workspace
        const accountResult = await pool.query(
          `SELECT unipile_account_id
           FROM workspace_accounts
           WHERE workspace_id = $1
             AND account_type = 'linkedin'
             AND is_active = true
           LIMIT 1`,
          [prospect.workspace_id]
        );

        if (accountResult.rows.length === 0) {
          console.error(`No active LinkedIn account for workspace ${prospect.workspace_id}`);
          continue;
        }

        const account = accountResult.rows[0];

        campaignMap.set(campaignId, {
          campaign_id: campaignId,
          campaign_name: prospect.campaign_name,
          workspace_id: prospect.workspace_id,
          unipile_dsn: `https://${process.env.UNIPILE_DSN}` || '',
          unipile_api_key: process.env.UNIPILE_API_KEY || '',
          unipile_account_id: account.unipile_account_id,
          prospects: []
        });
      }

      // Personalize message (same logic as execute-live)
      const crMessage = prospect.connection_message || prospect.message_templates?.connection_request || '';
      const personalizedMessage = crMessage
        .replace(/\{first_name\}/gi, prospect.first_name || '')
        .replace(/\{last_name\}/gi, prospect.last_name || '')
        .replace(/\{company\}/gi, prospect.company_name || '')
        .replace(/\{title\}/gi, prospect.title || '');

      campaignMap.get(campaignId).prospects.push({
        id: prospect.id,
        first_name: prospect.first_name,
        last_name: prospect.last_name,
        linkedin_url: prospect.linkedin_url,
        campaign_id: campaignId,
        personalized_message: personalizedMessage
      });
    }

    // Return first campaign with prospects (N8N will process one campaign per poll)
    const firstCampaign = Array.from(campaignMap.values())[0];

    if (!firstCampaign) {
      return NextResponse.json({
        prospects: [],
        count: 0,
        message: 'No valid campaigns with active LinkedIn accounts'
      });
    }

    console.log(`Returning ${firstCampaign.prospects.length} prospects from campaign: ${firstCampaign.campaign_name}`);

    return NextResponse.json({
      ...firstCampaign,
      count: firstCampaign.prospects.length
    });

  } catch (error: any) {
    console.error('Error in poll-pending:', error);
    return NextResponse.json({
      error: error.message,
      prospects: [],
      count: 0
    }, { status: 500 });
  }
}
