import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { mcpRegistry } from '@/lib/mcp/mcp-registry';

/**
 * Direct Unipile LinkedIn Campaign Execution (bypasses N8N)
 *
 * For fast testing - sends messages directly via Unipile MCP tools
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Authenticate
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { campaignId, workspaceId } = await req.json();

    if (!campaignId || !workspaceId) {
      return NextResponse.json({
        error: 'campaignId and workspaceId required'
      }, { status: 400 });
    }

    console.log('🚀 Direct Unipile execution:', { campaignId, workspaceId });

    // Verify workspace access
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*, message_templates')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({
        error: 'Campaign not found'
      }, { status: 404 });
    }

    // Get prospects with LinkedIn IDs
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaignId)
      .not('linkedin_user_id', 'is', null);

    if (prospectsError) {
      return NextResponse.json({
        error: 'Failed to fetch prospects'
      }, { status: 500 });
    }

    if (!prospects || prospects.length === 0) {
      // Check if there are ANY prospects at all
      const { count: totalProspects } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId);

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

    console.log(`📊 Found ${prospects.length} prospects with LinkedIn IDs`);

    // CRITICAL: Get user's OWN LinkedIn accounts only (LinkedIn ToS compliance)
    const { data: userAccounts, error: accountsError } = await supabase
      .from('user_unipile_accounts')
      .select('unipile_account_id, account_name')
      .eq('user_id', user.id)
      .eq('platform', 'LINKEDIN')
      .eq('connection_status', 'active');

    if (accountsError || !userAccounts || userAccounts.length === 0) {
      return NextResponse.json({
        error: 'No LinkedIn account connected. Please connect your LinkedIn account in Settings.',
        hint: 'You can only use your own LinkedIn account to send campaigns.'
      }, { status: 400 });
    }

    const userAccountIds = userAccounts.map(a => a.unipile_account_id);
    console.log(`✅ User has ${userAccountIds.length} LinkedIn account(s)`);

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
      console.log('✅ Using user LinkedIn account:', linkedinAccountId);

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

        console.log(`📤 Sending to ${prospect.first_name} ${prospect.last_name} (${prospect.linkedin_user_id})`);

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

        console.log(`✅ Sent to ${prospect.first_name} ${prospect.last_name}`);
        results.sent++;

        // Update prospect status
        await supabase
          .from('campaign_prospects')
          .update({
            status: 'messaged',
            last_contacted_at: new Date().toISOString()
          })
          .eq('id', prospect.id);

        // Rate limiting - wait 3 seconds between messages
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (error) {
        console.error(`❌ Failed to send to ${prospect.first_name}:`, error);
        results.failed++;
        results.errors.push(`${prospect.first_name} ${prospect.last_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Update campaign status
    await supabase
      .from('campaigns')
      .update({
        status: 'active',
        started_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    return NextResponse.json({
      success: true,
      message: `Campaign executed: ${results.sent} sent, ${results.failed} failed`,
      stats: results
    });

  } catch (error) {
    console.error('Direct execution error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
