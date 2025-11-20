/**
 * Campaign Cron Job
 *
 * Runs every 2 hours to check for active connector campaigns
 * with pending prospects and triggers campaign execution.
 *
 * Schedule: Every 2 hours (cron: "0 star-slash-2 star star star")
 */

import { inngest } from "@/lib/inngest/client";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const checkActiveCampaigns = inngest.createFunction(
  {
    id: "check-active-campaigns",
    name: "Check Active Connector Campaigns (Cron)",
    retries: 2
  },
  { cron: "0 */2 * * *" }, // Every 2 hours
  async ({ step }) => {
    console.log('🔍 Checking for active campaigns...');

    // Find active connector campaigns with pending prospects
    const { data: campaigns, error } = await step.run("fetch-active-campaigns", async () => {
      return await supabase
        .from('campaigns')
        .select(`
          id,
          workspace_id,
          campaign_name,
          campaign_type,
          linkedin_account_id,
          message_templates,
          schedule_settings,
          linkedin_account:workspace_accounts!linkedin_account_id (
            unipile_account_id,
            is_active
          )
        `)
        .eq('status', 'active')
        .eq('campaign_type', 'connector')
        .not('linkedin_account_id', 'is', null);
    });

    if (error) {
      console.error('❌ Error fetching campaigns:', error);
      throw error;
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('✅ No active campaigns found');
      return { triggered: 0, campaigns: [] };
    }

    console.log(`📋 Found ${campaigns.length} active campaigns`);

    const triggered = [];

    // For each campaign, check if it has pending prospects
    for (const campaign of campaigns) {
      const { data: pendingProspects } = await step.run(`check-prospects-${campaign.id}`, async () => {
        return await supabase
          .from('campaign_prospects')
          .select('id, first_name, last_name, email, company_name, title, linkedin_url, linkedin_user_id, status')
          .eq('campaign_id', campaign.id)
          .in('status', ['pending', 'approved', 'ready_to_message', 'queued_in_n8n'])
          .not('linkedin_url', 'is', null);
      });

      if (!pendingProspects || pendingProspects.length === 0) {
        console.log(`⏭️  Campaign ${campaign.campaign_name}: No pending prospects`);
        continue;
      }

      // Check if LinkedIn account is active
      if (!campaign.linkedin_account?.is_active) {
        console.log(`⚠️  Campaign ${campaign.campaign_name}: LinkedIn account inactive, skipping`);
        continue;
      }

      console.log(`✅ Campaign ${campaign.campaign_name}: ${pendingProspects.length} pending prospects`);

      // Trigger connector workflow
      await step.run(`trigger-${campaign.id}`, async () => {
        await inngest.send({
          name: "campaign/connector/execute",
          data: {
            campaignId: campaign.id,
            workspaceId: campaign.workspace_id,
            accountId: campaign.linkedin_account.unipile_account_id,
            prospects: pendingProspects,
            messages: {
              connection_request: campaign.message_templates?.connection_request || '',
              follow_up_messages: campaign.message_templates?.follow_up_messages || []
            },
            settings: campaign.schedule_settings || {
              timezone: 'America/Los_Angeles',
              working_hours_start: 5,
              working_hours_end: 18,
              skip_weekends: true,
              skip_holidays: true
            }
          }
        });

        console.log(`🚀 Triggered campaign: ${campaign.campaign_name}`);
      });

      triggered.push({
        campaignId: campaign.id,
        campaignName: campaign.campaign_name,
        prospectCount: pendingProspects.length
      });
    }

    console.log(`\n📊 Triggered ${triggered.length} campaigns`);

    return {
      triggered: triggered.length,
      campaigns: triggered
    };
  }
);
