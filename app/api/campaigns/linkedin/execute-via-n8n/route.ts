import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * LinkedIn Campaign Execution - SIMPLIFIED
 *
 * Supports TWO campaign types only:
 * - connector: Send connection request first (for 2nd/3rd degree)
 * - messenger: Direct message (for 1st degree connections)
 *
 * NO multi-channel, NO email, NO tiers, NO HITL complexity
 */

// Base N8N webhook URLs for different campaign types
const N8N_CONNECTOR_WEBHOOK = process.env.N8N_CONNECTOR_WEBHOOK_URL || 'https://workflows.innovareai.com/webhook/connector-campaign';
const N8N_MESSENGER_WEBHOOK = process.env.N8N_MESSENGER_WEBHOOK_URL || 'https://workflows.innovareai.com/webhook/messenger-campaign';

export async function POST(req: NextRequest) {
  try {
    console.log('🚀 ========== CAMPAIGN EXECUTE CALLED ==========');

    // 1. Authenticate user
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get request data
    const { campaignId, workspaceId } = await req.json();

    if (!campaignId || !workspaceId) {
      return NextResponse.json({
        error: 'Missing required fields',
        required: ['campaignId', 'workspaceId']
      }, { status: 400 });
    }

    // 3. Verify workspace access
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: member } = await supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
    }

    console.log(`🚀 LinkedIn Campaign Launch: ${campaignId}`);

    // 4. Get campaign with LinkedIn account
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select(`
        *,
        linkedin_account:workspace_accounts!linkedin_account_id (
          id,
          account_name,
          unipile_account_id,
          is_active
        )
      `)
      .eq('id', campaignId)
      .eq('workspace_id', workspaceId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({
        error: 'Campaign not found',
        details: campaignError?.message
      }, { status: 404 });
    }

    // 5. Get campaign prospects separately (RLS bypass for service role)
    const { data: prospects, error: prospectsError } = await supabaseAdmin
      .from('campaign_prospects')
      .select('id, first_name, last_name, email, company_name, title, linkedin_url, linkedin_user_id, status')
      .eq('campaign_id', campaignId);

    if (prospectsError) {
      console.error('Error fetching prospects:', prospectsError);
    }

    // Attach prospects to campaign object
    campaign.campaign_prospects = prospects || [];

    // 6. Validate LinkedIn account
    if (!campaign.linkedin_account?.unipile_account_id) {
      return NextResponse.json({
        error: 'No LinkedIn account connected',
        message: 'Please connect a LinkedIn account to this campaign'
      }, { status: 400 });
    }

    if (!campaign.linkedin_account.is_active) {
      return NextResponse.json({
        error: 'LinkedIn account inactive',
        message: 'Please reconnect your LinkedIn account'
      }, { status: 400 });
    }

    // 7. Get prospects ready to contact
    const pendingProspects = campaign.campaign_prospects.filter(
      (p: any) => ['pending', 'approved', 'ready_to_message', 'queued_in_n8n'].includes(p.status) && p.linkedin_url
    );

    if (pendingProspects.length === 0) {
      return NextResponse.json({
        message: 'No prospects ready to contact',
        processed: 0
      });
    }

    console.log(`📋 Processing ${pendingProspects.length} prospects`);

    // 8. Determine campaign type
    // connector = send CR first (default)
    // messenger = direct message only
    const campaignType = campaign.campaign_type || 'connector';
    console.log(`📋 Campaign Type from DB: "${campaign.campaign_type}" → Using: "${campaignType}"`);

    if (!['connector', 'messenger'].includes(campaignType)) {
      return NextResponse.json({
        error: 'Invalid campaign type',
        message: 'Only "connector" and "messenger" campaigns are supported',
        received: campaignType
      }, { status: 400 });
    }

    // 9. Build N8N payload
    const n8nPayload = {
      workspace_id: workspaceId,
      campaign_id: campaignId,
      channel: 'linkedin',
      campaign_type: campaignType,
      unipile_account_id: campaign.linkedin_account.unipile_account_id,
      prospects: pendingProspects.map((p: any) => ({
        id: p.id,
        prospect_id: p.id,
        campaign_id: campaignId,
        first_name: p.first_name,
        last_name: p.last_name,
        linkedin_url: p.linkedin_url,
        linkedin_user_id: p.linkedin_user_id,
        company_name: p.company_name,
        title: p.title
      })),
      messages: campaignType === 'messenger' ? {
        // Messenger campaigns: array of messages to send in sequence
        message_sequence: [
          campaign.message_templates?.connection_request || '',
          ...(campaign.message_templates?.follow_up_messages || [])
        ].filter(msg => msg && msg.trim() !== '')
      } : {
        // Connector campaigns: connection request only
        connection_request: campaign.connection_message || campaign.message_templates?.connection_request || ''
      },
      timing: {
        fu1_delay_days: 2,
        fu2_delay_days: 5,
        fu3_delay_days: 7,
        fu4_delay_days: 5,
        gb_delay_days: 7
      },
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
      unipile_dsn: `https://${process.env.UNIPILE_DSN}`,
      unipile_api_key: process.env.UNIPILE_API_KEY
    };

    console.log(`📦 Sending to N8N:`, {
      campaign_type: campaignType,
      prospect_count: pendingProspects.length,
      linkedin_account: campaign.linkedin_account.account_name
    });

    console.log(`📋 FULL N8N PAYLOAD:`, JSON.stringify(n8nPayload, null, 2));

    // 10. Determine which N8N webhook to call based on campaign type
    const N8N_WEBHOOK_URL = campaignType === 'messenger' ? N8N_MESSENGER_WEBHOOK : N8N_CONNECTOR_WEBHOOK;

    console.log(`🎯 Calling ${campaignType} workflow: ${N8N_WEBHOOK_URL}`);

    // 11. Call N8N webhook
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n8nPayload)
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error(`❌ N8N failed:`, errorText);
      throw new Error(`N8N webhook failed: ${n8nResponse.status}`);
    }

    const n8nResult = await n8nResponse.json();
    console.log(`✅ N8N accepted campaign`);

    // 11. Update prospect statuses
    for (const prospect of pendingProspects) {
      await supabaseAdmin
        .from('campaign_prospects')
        .update({ status: 'queued_in_n8n' })
        .eq('id', prospect.id);
    }

    // 12. Update campaign
    await supabaseAdmin
      .from('campaigns')
      .update({
        status: 'active',
        last_executed_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    return NextResponse.json({
      success: true,
      message: `LinkedIn ${campaignType} campaign launched`,
      prospects_queued: pendingProspects.length,
      campaign_type: campaignType
    });

  } catch (error: any) {
    console.error('❌ Campaign execution error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json({
      error: 'Campaign launch failed',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
