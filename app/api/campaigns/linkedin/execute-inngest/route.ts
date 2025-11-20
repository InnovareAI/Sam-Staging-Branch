/**
 * Manual Campaign Trigger (Inngest)
 *
 * Replaces the old N8N webhook execution with Inngest event trigger.
 * This endpoint allows users to manually trigger campaigns from the UI.
 *
 * Usage: POST /api/campaigns/linkedin/execute-inngest
 * Body: { campaignId: string, workspaceId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { inngest } from '@/lib/inngest/client';

export async function POST(req: NextRequest) {
  try {
    console.log('🚀 ========== INNGEST CAMPAIGN EXECUTE CALLED ==========');

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

    console.log(`🚀 Inngest Campaign Launch: ${campaignId}`);

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

    // 5. Get campaign prospects
    const { data: prospects, error: prospectsError } = await supabaseAdmin
      .from('campaign_prospects')
      .select('id, first_name, last_name, email, company_name, title, linkedin_url, linkedin_user_id, status')
      .eq('campaign_id', campaignId);

    if (prospectsError) {
      console.error('Error fetching prospects:', prospectsError);
    }

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
    const pendingProspects = (prospects || []).filter(
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
    const campaignType = campaign.campaign_type || 'connector';
    console.log(`📋 Campaign Type: "${campaignType}"`);

    if (!['connector', 'messenger'].includes(campaignType)) {
      return NextResponse.json({
        error: 'Invalid campaign type',
        message: 'Only "connector" and "messenger" campaigns are supported',
        received: campaignType
      }, { status: 400 });
    }

    // 9. Update prospect statuses to queued
    const prospectIds = pendingProspects.map((p: any) => p.id);
    await supabaseAdmin
      .from('campaign_prospects')
      .update({ status: 'queued_in_n8n' })
      .in('id', prospectIds);

    // 10. Update campaign status
    await supabaseAdmin
      .from('campaigns')
      .update({
        status: 'active',
        last_executed_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    // 11. Trigger Inngest workflow
    const eventData = {
      campaignId,
      workspaceId,
      accountId: campaign.linkedin_account.unipile_account_id,
      prospects: pendingProspects.map((p: any) => ({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        company_name: p.company_name,
        title: p.title,
        linkedin_url: p.linkedin_url,
        linkedin_user_id: p.linkedin_user_id
      })),
      messages: campaignType === 'messenger' ? {
        message_sequence: [
          campaign.message_templates?.connection_request || '',
          ...(campaign.message_templates?.follow_up_messages || [])
        ].filter((msg: string) => msg && msg.trim() !== '')
      } : {
        connection_request: campaign.message_templates?.connection_request || campaign.connection_message || '',
        follow_up_messages: campaign.message_templates?.follow_up_messages || []
      },
      settings: campaign.schedule_settings || {
        timezone: 'America/Los_Angeles',
        working_hours_start: 5,
        working_hours_end: 18,
        skip_weekends: true,
        skip_holidays: true
      }
    };

    await inngest.send({
      name: `campaign/${campaignType}/execute` as any,
      data: eventData
    });

    console.log(`✅ Campaign queued in Inngest - processing asynchronously`);

    return NextResponse.json({
      success: true,
      message: `LinkedIn ${campaignType} campaign launched via Inngest`,
      prospects_queued: pendingProspects.length,
      campaign_type: campaignType,
      execution_engine: 'inngest'
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
