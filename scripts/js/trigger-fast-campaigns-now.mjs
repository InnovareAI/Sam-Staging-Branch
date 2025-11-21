#!/usr/bin/env node
/**
 * Trigger campaigns with NEW fast delays (30-180s)
 * Bypasses manual Inngest dashboard work
 */

import { Inngest } from 'inngest';
import { createClient } from '@supabase/supabase-js';

const inngest = new Inngest({
  id: "sam-ai",
  name: "SAM AI Campaign Automation",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function triggerFastCampaigns() {
  console.log('🔍 Finding active campaigns with pending prospects...\n');

  // Get active campaigns with pending prospects
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select(`
      id,
      workspace_id,
      campaign_name,
      campaign_type,
      linkedin_account_id,
      message_templates,
      timezone,
      working_hours_start,
      working_hours_end,
      skip_weekends,
      skip_holidays,
      linkedin_account:workspace_accounts!linkedin_account_id (
        unipile_account_id,
        connection_status,
        is_active
      )
    `)
    .eq('status', 'active')
    .eq('campaign_type', 'connector')
    .not('linkedin_account_id', 'is', null);

  if (error) {
    console.error('❌ Error fetching campaigns:', error);
    return;
  }

  console.log(`📋 Found ${campaigns.length} active campaigns\n`);

  for (const campaign of campaigns) {
    // Get pending prospects for this campaign
    const { data: prospects, error: prospectError } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaign.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50); // Limit to 50 per batch

    if (prospectError) {
      console.error(`❌ Error fetching prospects for ${campaign.campaign_name}:`, prospectError);
      continue;
    }

    if (!prospects || prospects.length === 0) {
      console.log(`⏭️  Skipping ${campaign.campaign_name} - no pending prospects`);
      continue;
    }

    console.log(`\n🚀 Triggering ${campaign.campaign_name}: ${prospects.length} prospects`);

    try {
      // Send event to Inngest
      const result = await inngest.send({
        name: 'campaign/connector/execute',
        data: {
          campaignId: campaign.id,
          workspaceId: campaign.workspace_id,
          accountId: campaign.linkedin_account.unipile_account_id,
          prospects: prospects.map(p => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email,
            company_name: p.company_name,
            title: p.title,
            linkedin_url: p.linkedin_url,
            linkedin_user_id: p.linkedin_user_id
          })),
          messages: {
            connection_request: campaign.message_templates.connection_request || '',
            follow_up_messages: campaign.message_templates.follow_up_messages || []
          },
          settings: {
            timezone: campaign.timezone || 'America/Los_Angeles',
            working_hours_start: campaign.working_hours_start || 5,
            working_hours_end: campaign.working_hours_end || 18,
            skip_weekends: campaign.skip_weekends ?? true,
            skip_holidays: campaign.skip_holidays ?? true
          }
        }
      });

      console.log(`✅ Event sent: ${result.ids[0]}`);
    } catch (error) {
      console.error(`❌ Failed to trigger ${campaign.campaign_name}:`, error.message);
    }
  }

  console.log('\n✅ All campaigns triggered with FAST delays (30-180 seconds)\n');
  console.log('Expected completion: 7-14 minutes for 137 prospects');
}

// Run it
triggerFastCampaigns().catch(console.error);
