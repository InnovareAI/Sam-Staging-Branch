import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { UnipileClient } from 'unipile-node-sdk';

/**
 * Direct Campaign Execution - Process Follow-Ups
 *
 * Called by cron-job.org every hour:
 * 1. Find prospects where follow_up_due_at <= NOW
 * 2. Check if connection accepted
 * 3. Send next follow-up message
 * 4. Update follow_up_due_at for next message
 *
 * POST /api/campaigns/direct/process-follow-ups
 * Header: x-cron-secret (for security)
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

// Follow-up intervals (in days)
const FOLLOW_UP_INTERVALS = [5, 7, 5, 7]; // FU1: +5d, FU2: +7d, FU3: +5d, FU4: +7d

export async function POST(req: NextRequest) {
  try {
    // Security check - verify cron secret
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      console.warn('⚠️  Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🕐 Processing follow-ups...');

    // 1. Find prospects due for follow-up
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select(`
        *,
        campaigns!inner (
          id,
          campaign_name,
          message_templates,
          linkedin_account_id,
          workspace_accounts!linkedin_account_id (
            unipile_account_id,
            account_name
          )
        )
      `)
      .eq('status', 'connection_request_sent')
      .not('follow_up_due_at', 'is', null)
      .lte('follow_up_due_at', new Date().toISOString())
      .order('follow_up_due_at', { ascending: true })
      .limit(50); // Process 50 at a time

    if (prospectsError) {
      console.error('Error fetching prospects:', prospectsError);
      return NextResponse.json({ error: 'Failed to fetch prospects' }, { status: 500 });
    }

    if (!prospects || prospects.length === 0) {
      console.log('✅ No prospects due for follow-up');
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No prospects due'
      });
    }

    console.log(`📊 Found ${prospects.length} prospects due for follow-up`);

    const results = [];

    for (const prospect of prospects) {
      try {
        console.log(`\n👤 Processing: ${prospect.first_name} ${prospect.last_name}`);
        console.log(`📍 Follow-up index: ${prospect.follow_up_sequence_index}`);

        const campaign = prospect.campaigns as any;
        const linkedinAccount = campaign.workspace_accounts as any;
        const unipileAccountId = linkedinAccount.unipile_account_id;

        // Check if connection was accepted
        console.log(`🔍 Checking connection status...`);

        // Get all chats to find this prospect
        const chats = await unipile.messaging.getAllChats({
          account_id: unipileAccountId
        });

        const chat = chats.items.find((c: any) =>
          c.attendees?.some((a: any) => a.provider_id === prospect.linkedin_user_id)
        );

        if (!chat) {
          console.log(`⏸️  Connection not accepted yet, will retry later`);

          // Push back the follow_up_due_at by 1 day
          const newDueAt = new Date(prospect.follow_up_due_at);
          newDueAt.setDate(newDueAt.getDate() + 1);

          await supabase
            .from('campaign_prospects')
            .update({
              follow_up_due_at: newDueAt.toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          results.push({
            prospectId: prospect.id,
            name: `${prospect.first_name} ${prospect.last_name}`,
            status: 'pending_acceptance',
            nextCheck: newDueAt.toISOString()
          });

          continue;
        }

        console.log(`✅ Connection accepted, sending follow-up ${prospect.follow_up_sequence_index + 1}`);

        // Get the follow-up message
        const followUpMessages = campaign.message_templates?.follow_up_messages || [];
        const messageIndex = prospect.follow_up_sequence_index;

        if (messageIndex >= followUpMessages.length) {
          console.log(`✅ All follow-ups sent, marking as completed`);

          await supabase
            .from('campaign_prospects')
            .update({
              status: 'messaging',
              follow_up_due_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          results.push({
            prospectId: prospect.id,
            name: `${prospect.first_name} ${prospect.last_name}`,
            status: 'completed'
          });

          continue;
        }

        // Personalize message
        const message = followUpMessages[messageIndex]
          .replace(/{first_name}/g, prospect.first_name)
          .replace(/{last_name}/g, prospect.last_name)
          .replace(/{company_name}/g, prospect.company_name || '')
          .replace(/{title}/g, prospect.title || '');

        // Send message
        console.log(`📤 Sending follow-up message...`);
        await unipile.messaging.sendMessage({
          chat_id: chat.id,
          text: message
        });

        // Calculate next follow-up time
        const nextInterval = FOLLOW_UP_INTERVALS[messageIndex];
        const nextDueAt = nextInterval ? new Date() : null;
        if (nextDueAt) {
          nextDueAt.setDate(nextDueAt.getDate() + nextInterval);
        }

        // Update database
        await supabase
          .from('campaign_prospects')
          .update({
            follow_up_sequence_index: messageIndex + 1,
            last_follow_up_at: new Date().toISOString(),
            follow_up_due_at: nextDueAt?.toISOString() || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', prospect.id);

        console.log(`✅ Follow-up ${messageIndex + 1} sent to ${prospect.first_name}`);
        if (nextDueAt) {
          console.log(`⏰ Next follow-up scheduled for: ${nextDueAt.toISOString()}`);
        }

        results.push({
          prospectId: prospect.id,
          name: `${prospect.first_name} ${prospect.last_name}`,
          status: 'sent',
          followUpIndex: messageIndex + 1,
          nextDueAt: nextDueAt?.toISOString()
        });

        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));

      } catch (error: any) {
        // Capture full error details (Unipile errors have status, type, title)
        const errorDetails = {
          message: error.message || 'Unknown error',
          status: error.status || error.statusCode,
          type: error.type,
          title: error.title,
          response: error.response?.data,
          stack: error.stack
        };

        console.error(`❌ Failed to process ${prospect.first_name}:`, JSON.stringify(errorDetails, null, 2));

        const errorMessage = error.title || error.message || 'Unknown error';

        results.push({
          prospectId: prospect.id,
          name: `${prospect.first_name} ${prospect.last_name}`,
          status: 'failed',
          error: errorMessage,
          errorDetails: errorDetails
        });

        // Don't update DB on error - will retry next hour
      }
    }

    const sentCount = results.filter(r => r.status === 'sent').length;
    const pendingCount = results.filter(r => r.status === 'pending_acceptance').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const completedCount = results.filter(r => r.status === 'completed').length;

    console.log(`\n📊 Summary:`);
    console.log(`   - Sent: ${sentCount}`);
    console.log(`   - Pending acceptance: ${pendingCount}`);
    console.log(`   - Completed: ${completedCount}`);
    console.log(`   - Failed: ${failedCount}`);

    return NextResponse.json({
      success: true,
      processed: prospects.length,
      sent: sentCount,
      pending: pendingCount,
      completed: completedCount,
      failed: failedCount,
      results
    });

  } catch (error: any) {
    const errorDetails = {
      message: error.message || 'Unknown error',
      status: error.status || error.statusCode,
      type: error.type,
      title: error.title,
      response: error.response?.data,
      stack: error.stack
    };

    console.error('❌ Follow-up processing error:', JSON.stringify(errorDetails, null, 2));

    return NextResponse.json({
      error: error.title || error.message || 'Internal server error',
      details: errorDetails
    }, { status: 500 });
  }
}
