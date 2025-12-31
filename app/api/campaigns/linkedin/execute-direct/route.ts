import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { mcpRegistry } from '@/lib/mcp/mcp-registry';

/**
 * Direct Unipile LinkedIn Campaign Execution (bypasses N8N)
 *
 * For fast testing - sends messages directly via Unipile MCP tools
 */
export async function POST(req: NextRequest) {
  try {
    // Firebase authentication
    const { userId, workspaceId } = await verifyAuth(req);

    const { campaignId, workspaceId: requestWorkspaceId } = await req.json();

    // Use the workspace from auth, but allow override from request for flexibility
    const targetWorkspaceId = requestWorkspaceId || workspaceId;

    if (!campaignId) {
      return NextResponse.json({
        error: 'campaignId is required'
      }, { status: 400 });
    }

    console.log('Direct Unipile execution:', { campaignId, workspaceId: targetWorkspaceId });

    // Verify workspace access (already verified by verifyAuth, but double-check if different workspace)
    if (targetWorkspaceId !== workspaceId) {
      const memberResult = await pool.query(
        `SELECT role FROM workspace_members
         WHERE workspace_id = $1 AND user_id = $2`,
        [targetWorkspaceId, userId]
      );

      if (memberResult.rows.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Get campaign
    const campaignResult = await pool.query(
      `SELECT *, message_templates FROM campaigns WHERE id = $1`,
      [campaignId]
    );

    if (campaignResult.rows.length === 0) {
      return NextResponse.json({
        error: 'Campaign not found'
      }, { status: 404 });
    }

    const campaign = campaignResult.rows[0];

    // Get prospects with LinkedIn IDs
    const prospectsResult = await pool.query(
      `SELECT * FROM campaign_prospects
       WHERE campaign_id = $1
         AND linkedin_user_id IS NOT NULL`,
      [campaignId]
    );

    const prospects = prospectsResult.rows;

    if (!prospects || prospects.length === 0) {
      // Check if there are ANY prospects at all
      const countResult = await pool.query(
        `SELECT COUNT(*) as count FROM campaign_prospects WHERE campaign_id = $1`,
        [campaignId]
      );
      const totalProspects = parseInt(countResult.rows[0].count);

      return NextResponse.json({
        error: 'No prospects with LinkedIn IDs found',
        details: {
          totalProspects: totalProspects || 0,
          prospectsWithLinkedInIds: 0,
          message: totalProspects === 0
            ? 'No prospects found in campaign. Please add prospects first.'
            : 'Prospects exist but no LinkedIn IDs found. LinkedIn IDs must be resolved before sending messages.'
        }
      }, { status: 400 });
    }

    console.log(`Found ${prospects.length} prospects with LinkedIn IDs`);

    // CRITICAL: Get user's OWN LinkedIn accounts only (LinkedIn ToS compliance)
    const userAccountsResult = await pool.query(
      `SELECT unipile_account_id, account_name
       FROM user_unipile_accounts
       WHERE user_id = $1
         AND platform = 'LINKEDIN'
         AND connection_status = 'active'`,
      [userId]
    );

    if (userAccountsResult.rows.length === 0) {
      return NextResponse.json({
        error: 'No LinkedIn account connected. Please connect your LinkedIn account in Settings.',
        hint: 'You can only use your own LinkedIn account to send campaigns.'
      }, { status: 400 });
    }

    const userAccountIds = userAccountsResult.rows.map((a: any) => a.unipile_account_id);
    console.log(`User has ${userAccountIds.length} LinkedIn account(s)`);

    // Get Unipile LinkedIn account
    let linkedinAccountId: string | null = null;

    try {
      const accountsResponse = await mcpRegistry.callTool({
        method: 'tools/call',
        params: { name: 'unipile_get_accounts' }
      });

      const accountsData = JSON.parse(accountsResponse.content[0]?.text || '{}');
      const linkedinAccounts = accountsData.accounts?.filter(
        (acc: any) =>
          acc.provider === 'LINKEDIN' &&
          userAccountIds.includes(acc.id) // CRITICAL: Only user's own accounts
      ) || [];

      if (linkedinAccounts.length === 0) {
        return NextResponse.json({
          error: 'No LinkedIn account connected or accessible',
          hint: 'Please connect your own LinkedIn account in Settings.'
        }, { status: 400 });
      }

      linkedinAccountId = linkedinAccounts[0].id;
      console.log('Using user LinkedIn account:', linkedinAccountId);

    } catch (error) {
      console.error('Error getting Unipile accounts:', error);
      return NextResponse.json({
        error: 'Failed to connect to Unipile'
      }, { status: 500 });
    }

    // Send messages to prospects
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[]
    };

    const messageTemplate = campaign.message_templates?.connection_request
      || campaign.message_templates?.alternative_message
      || 'Hi {{first_name}}, I would like to connect!';

    for (const prospect of prospects) {
      try {
        // Personalize message
        const message = messageTemplate
          .replace(/\{\{first_name\}\}/g, prospect.first_name || 'there')
          .replace(/\{\{last_name\}\}/g, prospect.last_name || '')
          .replace(/\{\{company\}\}/g, prospect.company || '')
          .replace(/\{\{title\}\}/g, prospect.title || '');

        console.log(`Sending to ${prospect.first_name} ${prospect.last_name} (${prospect.linkedin_user_id})`);

        // Send via Unipile MCP
        const sendResponse = await mcpRegistry.callTool({
          method: 'tools/call',
          params: {
            name: 'send_linkedin_message',
            arguments: {
              account_id: linkedinAccountId,
              recipient_id: prospect.linkedin_user_id,
              message: message
            }
          }
        });

        console.log(`Sent to ${prospect.first_name} ${prospect.last_name}`);
        results.sent++;

        // Update prospect status
        await pool.query(
          `UPDATE campaign_prospects
           SET status = 'messaged', last_contacted_at = $1
           WHERE id = $2`,
          [new Date().toISOString(), prospect.id]
        );

        // Rate limiting - wait 3 seconds between messages
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (error) {
        console.error(`Failed to send to ${prospect.first_name}:`, error);
        results.failed++;
        results.errors.push(`${prospect.first_name} ${prospect.last_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Update campaign status
    await pool.query(
      `UPDATE campaigns
       SET status = 'active', started_at = $1
       WHERE id = $2`,
      [new Date().toISOString(), campaignId]
    );

    return NextResponse.json({
      success: true,
      message: `Campaign executed: ${results.sent} sent, ${results.failed} failed`,
      stats: results
    });

  } catch (error) {
    // Handle AuthError
    if (error && typeof error === 'object' && 'code' in error && 'statusCode' in error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Direct execution error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
