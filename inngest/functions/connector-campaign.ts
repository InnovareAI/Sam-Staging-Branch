/**
 * Connector Campaign Workflow
 *
 * Executes LinkedIn connector campaigns:
 * 1. Send connection request (CR)
 * 2. Wait 2 days for acceptance
 * 3. Send follow-up message 1
 * 4. Wait 5 days
 * 5. Send follow-up message 2
 * 6. Wait 7 days
 * 7. Send follow-up message 3
 * 8. Wait 5 days
 * 9. Send follow-up message 4
 * 10. Wait 7 days
 * 11. Send follow-up message 5 (goodbye)
 *
 * Features:
 * - Human-like randomization (variable delays)
 * - Working hours enforcement (5 AM - 6 PM PT)
 * - Weekend skipping (M-F only)
 * - Daily message limits per account
 * - Automatic retries on errors
 * - Type-safe Unipile SDK integration
 */

import { inngest } from "@/lib/inngest/client";
import { createClient } from "@supabase/supabase-js";
import {
  calculateSmartDelay,
  calculateSmartSleep,
  incrementAccountMessageCount,
  personalizeMessage,
  DelaySettings
} from "@/lib/campaign-randomizer";

// Initialize Unipile SDK
import { UnipileClient } from "unipile-node-sdk";

const unipile = new UnipileClient(
  `https://${process.env.UNIPILE_DSN}`,
  process.env.UNIPILE_API_KEY!
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const executeConnectorCampaign = inngest.createFunction(
  {
    id: "connector-campaign",
    name: "Execute Connector Campaign (CR + 5 FUs)",
    retries: 3,
    throttle: {
      limit: 15, // Max 15 messages per LinkedIn account per day (safe buffer under 20)
      period: "24h",
      key: "event.data.accountId" // Throttle per LinkedIn account, not globally
    },
    concurrency: {
      limit: 5, // Max 5 concurrent campaigns running at once
      key: "event.data.accountId" // One campaign per account at a time
    }
  },
  { event: "campaign/connector/execute" },
  async ({ event, step }) => {
    const { campaignId, workspaceId, accountId, prospects, messages, settings } = event.data;

    console.log(`🚀 Starting connector campaign ${campaignId} with ${prospects.length} prospects`);

    // Get campaign details
    const { data: campaign } = await step.run("get-campaign-details", async () => {
      return await supabase
        .from('campaigns')
        .select(`
          id,
          campaign_name,
          linkedin_account_id,
          message_templates
        `)
        .eq('id', campaignId)
        .single();
    });

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    // Process each prospect sequentially
    const results = [];

    for (const [index, prospect] of prospects.entries()) {
      console.log(`\n👤 Processing prospect ${index + 1}/${prospects.length}: ${prospect.first_name} ${prospect.last_name}`);

      // Calculate delay before this prospect
      const delay = await step.run(`calculate-delay-${prospect.id}`, async () => {
        return await calculateSmartDelay({
          accountId,
          prospectIndex: index,
          totalProspects: prospects.length,
          settings: settings || {
            timezone: 'America/Los_Angeles',
            working_hours_start: 5,
            working_hours_end: 18,
            skip_weekends: true,
            skip_holidays: true
          }
        });
      });

      // Wait with human-like randomization
      if (delay > 0) {
        console.log(`⏳ Waiting ${delay} minutes before processing ${prospect.first_name}...`);
        await step.sleep(`human-delay-${prospect.id}`, `${delay}m`);
      }

      try {
        // === CHECK DAILY LIMIT BEFORE SENDING ===
        const canSend = await step.run(`check-daily-limit-${prospect.id}`, async () => {
          const { data: account } = await supabase
            .from('workspace_accounts')
            .select('daily_message_limit, messages_sent_today, last_message_date')
            .eq('unipile_account_id', accountId)
            .single();

          const dailyLimit = account?.daily_message_limit || 20;
          const sentToday = account?.messages_sent_today || 0;
          const lastMessageDate = account?.last_message_date;

          // Reset counter if it's a new day
          const today = new Date().toISOString().split('T')[0];
          const isNewDay = !lastMessageDate || lastMessageDate.split('T')[0] !== today;
          const actualSentToday = isNewDay ? 0 : sentToday;

          if (actualSentToday >= dailyLimit) {
            console.log(`⚠️  Daily limit reached (${actualSentToday}/${dailyLimit})`);
            return false;
          }

          return true;
        });

        if (!canSend) {
          // Mark prospect as waiting for daily limit reset
          await step.run(`mark-limit-exceeded-${prospect.id}`, async () => {
            await supabase
              .from('campaign_prospects')
              .update({
                status: 'daily_limit_exceeded',
                error_message: 'Daily messaging limit reached - will retry tomorrow'
              })
              .eq('id', prospect.id);
          });

          // Sleep until next day (wait 24 hours)
          console.log(`⏸️  Sleeping 24 hours until daily limit resets...`);
          await step.sleep(`wait-daily-limit-${prospect.id}`, '24h');

          // Retry this prospect after the sleep
          console.log(`🔄 Retrying ${prospect.first_name} after daily limit reset`);
        }

        // === STEP 1: SEND CONNECTION REQUEST ===
        const crResult = await step.run(`send-cr-${prospect.id}`, async () => {
          console.log(`📤 Sending connection request to ${prospect.first_name}...`);

          try {
            // Get provider_id from LinkedIn URL if not stored
            let providerId = prospect.linkedin_user_id;

            if (!providerId) {
              console.log(`📝 Getting provider_id for ${prospect.first_name}...`);
              const profile = await unipile.users.getProfile({
                account_id: accountId,
                identifier: prospect.linkedin_url
              });
              providerId = profile.provider_id;

              // Store provider_id for future use
              await supabase
                .from('campaign_prospects')
                .update({ linkedin_user_id: providerId })
                .eq('id', prospect.id);
            }

            // Send CR via Unipile SDK
            const result = await unipile.users.sendInvitation({
              account_id: accountId,
              provider_id: providerId,
              message: personalizeMessage(messages.connection_request, prospect)
            });

            console.log(`✅ CR sent to ${prospect.first_name}`);

            // Update prospect status
            await supabase
              .from('campaign_prospects')
              .update({
                status: 'cr_sent',
                sent_at: new Date().toISOString(),
                last_message_at: new Date().toISOString()
              })
              .eq('id', prospect.id);

            // Update account message counter
            await incrementAccountMessageCount(accountId);

            return result;

          } catch (error: any) {
            console.error(`❌ Failed to send CR to ${prospect.first_name}:`, error);

            // Handle Unipile-specific errors
            if (error.code === 'RATE_LIMIT' || error.message?.includes('rate limit') || error.message?.includes('weekly limit')) {
              // Check if it's a weekly limit (LinkedIn typically says "weekly" in error)
              const isWeeklyLimit = error.message?.toLowerCase().includes('week');

              if (isWeeklyLimit) {
                console.log(`⏸️  Weekly limit exceeded, will retry Monday...`);
                // Mark as weekly limit exceeded and wait until Monday
                await supabase
                  .from('campaign_prospects')
                  .update({ status: 'weekly_limit_exceeded' })
                  .eq('id', prospect.id);

                // Calculate days until next Monday (weekly limit resets)
                const now = new Date();
                const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
                const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
                const hoursUntilMonday = daysUntilMonday * 24;

                console.log(`⏰ Sleeping ${hoursUntilMonday} hours until Monday...`);
                await step.sleep(`wait-weekly-limit-${prospect.id}`, `${hoursUntilMonday}h`);

                // Retry after weekly limit resets
                throw error;
              } else {
                // Daily limit - handled by throttling, just sleep briefly
                console.log(`⏸️  Daily rate limited, Inngest throttling will handle retry...`);
                await step.sleep(`rate-limit-backoff-${prospect.id}`, "1h");
                throw error; // Retry this step
              }
            }

            if (error.code === 'ACCOUNT_DISCONNECTED') {
              console.error(`🔴 LinkedIn account disconnected!`);
              await supabase
                .from('workspace_accounts')
                .update({ is_active: false, connection_status: 'disconnected' })
                .eq('unipile_account_id', accountId);
              throw new Error('LinkedIn account disconnected - campaign paused');
            }

            // Mark prospect as failed (non-recoverable error)
            await supabase
              .from('campaign_prospects')
              .update({ status: 'failed' })
              .eq('id', prospect.id);

            // Don't throw - continue to next prospect
            console.error(`⏭️  Skipping ${prospect.first_name} due to error`);
          }
        });

        // === STEP 2: WAIT 2 DAYS FOR ACCEPTANCE ===
        const waitTime = calculateSmartSleep("2 days", settings || {});
        console.log(`⏰ Waiting ${waitTime} for ${prospect.first_name} to accept CR...`);
        await step.sleep(`wait-cr-acceptance-${prospect.id}`, waitTime);

        // Check if connection was accepted
        const accepted = await step.run(`check-acceptance-${prospect.id}`, async () => {
          console.log(`🔍 Checking if ${prospect.first_name} accepted connection...`);

          // Check database for acceptance status (updated via N8N webhook or cron)
          const { data } = await supabase
            .from('campaign_prospects')
            .select('connection_status')
            .eq('id', prospect.id)
            .single();

          const isAccepted = data?.connection_status === 'accepted';
          console.log(`${isAccepted ? '✅' : '❌'} ${prospect.first_name} ${isAccepted ? 'accepted' : 'did not accept'} connection`);

          return isAccepted;
        });

        if (!accepted) {
          console.log(`⏭️  Skipping follow-ups for ${prospect.first_name} (CR not accepted)`);
          await supabase
            .from('campaign_prospects')
            .update({ status: 'cr_not_accepted' })
            .eq('id', prospect.id);
          continue; // Skip to next prospect
        }

        // Get chat_id for follow-up messages
        const chatId = await step.run(`get-chat-id-${prospect.id}`, async () => {
          console.log(`📋 Getting chat ID for ${prospect.first_name}...`);

          const providerId = prospect.linkedin_user_id || crResult.provider_id;

          // Get all chats and find the one with this prospect
          const chats = await unipile.messaging.getAllChats({ account_id: accountId });

          const chat = chats.items.find((c: any) =>
            c.attendees?.some((a: any) => a.provider_id === providerId)
          );

          if (chat) {
            console.log(`✅ Found chat ID for ${prospect.first_name}`);
            return chat.id;
          }

          throw new Error(`Chat not found for ${prospect.first_name} - connection may not be established yet`);
        });

        // === STEP 3: SEND FOLLOW-UP 1 ===
        await step.run(`send-fu1-${prospect.id}`, async () => {
          console.log(`📤 Sending follow-up 1 to ${prospect.first_name}...`);
          await sendFollowUp(
            accountId,
            chatId,
            prospect,
            messages.follow_up_messages[0],
            'fu1_sent'
          );
        });

        // === STEP 4: WAIT 5 DAYS, SEND FOLLOW-UP 2 ===
        await step.sleep(`wait-fu2-${prospect.id}`, calculateSmartSleep("5 days", settings || {}));

        await step.run(`send-fu2-${prospect.id}`, async () => {
          console.log(`📤 Sending follow-up 2 to ${prospect.first_name}...`);
          await sendFollowUp(
            accountId,
            chatId,
            prospect,
            messages.follow_up_messages[1],
            'fu2_sent'
          );
        });

        // === STEP 5: WAIT 7 DAYS, SEND FOLLOW-UP 3 ===
        await step.sleep(`wait-fu3-${prospect.id}`, calculateSmartSleep("7 days", settings || {}));

        await step.run(`send-fu3-${prospect.id}`, async () => {
          console.log(`📤 Sending follow-up 3 to ${prospect.first_name}...`);
          await sendFollowUp(
            accountId,
            chatId,
            prospect,
            messages.follow_up_messages[2],
            'fu3_sent'
          );
        });

        // === STEP 6: WAIT 5 DAYS, SEND FOLLOW-UP 4 ===
        await step.sleep(`wait-fu4-${prospect.id}`, calculateSmartSleep("5 days", settings || {}));

        await step.run(`send-fu4-${prospect.id}`, async () => {
          console.log(`📤 Sending follow-up 4 to ${prospect.first_name}...`);
          await sendFollowUp(
            accountId,
            chatId,
            prospect,
            messages.follow_up_messages[3],
            'fu4_sent'
          );
        });

        // === STEP 7: WAIT 7 DAYS, SEND FOLLOW-UP 5 (GOODBYE) ===
        await step.sleep(`wait-fu5-${prospect.id}`, calculateSmartSleep("7 days", settings || {}));

        await step.run(`send-fu5-${prospect.id}`, async () => {
          console.log(`📤 Sending follow-up 5 (goodbye) to ${prospect.first_name}...`);
          await sendFollowUp(
            accountId,
            chatId,
            prospect,
            messages.follow_up_messages[4],
            'fu5_sent'
          );
        });

        // Mark prospect as completed
        await step.run(`complete-prospect-${prospect.id}`, async () => {
          console.log(`✅ Completed full sequence for ${prospect.first_name}`);
          await supabase
            .from('campaign_prospects')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', prospect.id);
        });

        results.push({
          prospectId: prospect.id,
          status: 'completed',
          name: `${prospect.first_name} ${prospect.last_name}`
        });

      } catch (error: any) {
        console.error(`❌ Error processing ${prospect.first_name}:`, error);
        results.push({
          prospectId: prospect.id,
          status: 'failed',
          error: error.message,
          name: `${prospect.first_name} ${prospect.last_name}`
        });
      }
    }

    // Update campaign status
    await step.run("update-campaign-status", async () => {
      const completedCount = results.filter(r => r.status === 'completed').length;
      const failedCount = results.filter(r => r.status === 'failed').length;

      await supabase
        .from('campaigns')
        .update({
          last_executed_at: new Date().toISOString(),
          status: failedCount === prospects.length ? 'failed' : 'active'
        })
        .eq('id', campaignId);

      console.log(`\n📊 Campaign ${campaignId} finished: ${completedCount} completed, ${failedCount} failed`);
    });

    return {
      campaignId,
      workspaceId,
      processed: prospects.length,
      results,
      status: 'completed'
    };
  }
);

// === HELPER FUNCTION ===

async function sendFollowUp(
  accountId: string,
  chatId: string,
  prospect: any,
  message: string,
  status: string
): Promise<void> {
  if (!message || message.trim() === '') {
    console.log(`⚠️  Skipping empty message for ${prospect.first_name}`);
    return;
  }

  try {
    await unipile.messaging.sendMessage({
      chat_id: chatId,
      text: personalizeMessage(message, prospect)
    });

    console.log(`✅ Sent ${status} to ${prospect.first_name}`);

    await supabase
      .from('campaign_prospects')
      .update({
        status,
        last_message_at: new Date().toISOString()
      })
      .eq('id', prospect.id);

    await incrementAccountMessageCount(accountId);

  } catch (error: any) {
    console.error(`❌ Failed to send ${status} to ${prospect.first_name}:`, error);

    // Mark as failed but don't throw (allow campaign to continue)
    await supabase
      .from('campaign_prospects')
      .update({
        status: 'failed',
        error_message: `${status}: ${error.message}`
      })
      .eq('id', prospect.id);

    throw error;
  }
}
