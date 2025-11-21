import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { UnipileClient } from 'unipile-node-sdk';

/**
 * Direct Campaign Execution - Send Connection Requests
 *
 * Simple, no workflow engines:
 * 1. Fetch pending prospects
 * 2. Send CR via Unipile
 * 3. Update DB with next_action_at
 *
 * POST /api/campaigns/direct/send-connection-requests
 * Body: { campaignId: string }
 */

export const maxDuration = 300; // 5 minutes

const unipile = new UnipileClient(
  `https://${process.env.UNIPILE_DSN}`,
  process.env.UNIPILE_API_KEY!
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { campaignId } = await req.json();

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
    }

    console.log(`🚀 Starting direct campaign execution: ${campaignId}`);

    // 1. Fetch campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        id,
        campaign_name,
        message_templates,
        linkedin_account_id,
        workspace_accounts!linkedin_account_id (
          id,
          unipile_account_id,
          account_name
        )
      `)
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('Campaign not found:', campaignError);
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const linkedinAccount = campaign.workspace_accounts as any;
    const unipileAccountId = linkedinAccount.unipile_account_id;

    if (!unipileAccountId) {
      return NextResponse.json({ error: 'No LinkedIn account configured' }, { status: 400 });
    }

    console.log(`📋 Campaign: ${campaign.campaign_name}`);
    console.log(`👤 LinkedIn Account: ${linkedinAccount.account_name} (${unipileAccountId})`);

    // 2. Fetch pending prospects
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'approved'])
      .not('linkedin_url', 'is', null)
      .order('created_at', { ascending: true })
      .limit(20); // Process 20 at a time

    if (prospectsError) {
      console.error('Error fetching prospects:', prospectsError);
      return NextResponse.json({ error: 'Failed to fetch prospects' }, { status: 500 });
    }

    if (!prospects || prospects.length === 0) {
      console.log('✅ No pending prospects to process');
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No pending prospects'
      });
    }

    console.log(`📊 Found ${prospects.length} prospects to contact`);

    // 3. Process each prospect
    const results = [];
    const connectionRequestMessage = campaign.message_templates?.connection_request ||
      'Hi {first_name}, I\'d like to connect!';

    for (const prospect of prospects) {
      try {
        console.log(`\n👤 Processing: ${prospect.first_name} ${prospect.last_name}`);

        // Get LinkedIn profile to get provider_id
        let providerId = prospect.linkedin_user_id;

        if (!providerId) {
          console.log(`📝 Fetching LinkedIn profile...`);
          const profile = await unipile.users.getProfile({
            account_id: unipileAccountId,
            identifier: prospect.linkedin_url
          });
          providerId = profile.provider_id;
        }

        // Personalize message
        const personalizedMessage = connectionRequestMessage
          .replace(/{first_name}/g, prospect.first_name)
          .replace(/{last_name}/g, prospect.last_name)
          .replace(/{company_name}/g, prospect.company_name || '')
          .replace(/{title}/g, prospect.title || '');

        // Send connection request
        console.log(`📤 Sending connection request...`);
        await unipile.users.sendInvitation({
          account_id: unipileAccountId,
          provider_id: providerId,
          message: personalizedMessage
        });

        // Calculate next action time (2 days from now)
        const nextActionAt = new Date();
        nextActionAt.setDate(nextActionAt.getDate() + 2);

        // Update database
        await supabase
          .from('campaign_prospects')
          .update({
            status: 'connection_request_sent',
            contacted_at: new Date().toISOString(),
            linkedin_user_id: providerId,
            follow_up_due_at: nextActionAt.toISOString(),
            follow_up_sequence_index: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', prospect.id);

        console.log(`✅ Connection request sent to ${prospect.first_name}`);
        console.log(`⏰ Next action scheduled for: ${nextActionAt.toISOString()}`);

        results.push({
          prospectId: prospect.id,
          name: `${prospect.first_name} ${prospect.last_name}`,
          status: 'success',
          nextActionAt: nextActionAt.toISOString()
        });

        // Small delay between requests (human-like behavior)
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

      } catch (error: any) {
        console.error(`❌ Failed to process ${prospect.first_name}:`, error.message);

        // Mark as failed
        await supabase
          .from('campaign_prospects')
          .update({
            status: 'failed',
            notes: `CR failed: ${error.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', prospect.id);

        results.push({
          prospectId: prospect.id,
          name: `${prospect.first_name} ${prospect.last_name}`,
          status: 'failed',
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    console.log(`\n📊 Summary: ${successCount} sent, ${failedCount} failed`);

    return NextResponse.json({
      success: true,
      processed: prospects.length,
      sent: successCount,
      failed: failedCount,
      results
    });

  } catch (error: any) {
    console.error('❌ Campaign execution error:', error);
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
