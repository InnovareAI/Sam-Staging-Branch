/**
 * Cron Job: Send Follow-Up Messages
 *
 * Sends scheduled follow-up messages to connected prospects
 * Progresses through campaign's follow-up sequence
 *
 * Run: Every 1 hour
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    console.log('⏰ Cron: Sending follow-up messages...');

    // Verify cron secret
    const cronSecret = req.headers.get('x-cron-secret');
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      console.error('❌ Invalid cron secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get prospects due for follow-up
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select(`
        id,
        first_name,
        last_name,
        company_name,
        industry,
        title,
        job_title,
        linkedin_url,
        follow_up_sequence_index,
        personalization_data,
        campaign_id,
        campaigns (
          id,
          name,
          workspace_id,
          created_by,
          message_templates,
          follow_up_messages
        )
      `)
      .eq('status', 'connected')
      .lte('follow_up_due_at', new Date().toISOString())
      .limit(10); // Send 10 follow-ups per run

    if (prospectsError || !prospects || prospects.length === 0) {
      console.log('✅ No follow-ups due');
      return NextResponse.json({
        success: true,
        message: 'No follow-ups due',
        checked_at: new Date().toISOString()
      });
    }

    console.log(`📊 Sending ${prospects.length} follow-up messages...`);

    const results = {
      sent: 0,
      failed: 0,
      errors: []
    };

    for (const prospect of prospects) {
      try {
        const campaign = prospect.campaigns;
        const prospectName = `${prospect.first_name || 'there'} ${prospect.last_name || ''}`.trim();
        console.log(`\n📤 Sending follow-up to: ${prospectName}`);

        // Get follow-up messages from campaign
        const followUpMsgs = campaign.follow_up_messages || campaign.message_templates?.follow_up_messages || [];

        // Get current follow-up index (default 0 for first follow-up)
        const currentIndex = prospect.follow_up_sequence_index || 0;

        if (currentIndex >= followUpMsgs.length) {
          console.log(`⏭️  All follow-ups sent for ${prospectName}`);

          // Mark as sequence complete
          await supabase
            .from('campaign_prospects')
            .update({
              status: 'follow_up_complete',
              follow_up_due_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          continue;
        }

        // Get follow-up message template
        const followUpTemplate = followUpMsgs[currentIndex];

        // Personalize message
        const personalizedMsg = followUpTemplate
          .replace(/\{first_name\}/gi, prospect.first_name || 'there')
          .replace(/\{last_name\}/gi, prospect.last_name || '')
          .replace(/\{company\}/gi, prospect.company_name || '')
          .replace(/\{company_name\}/gi, prospect.company_name || '')
          .replace(/\{industry\}/gi, prospect.industry || '')
          .replace(/\{title\}/gi, prospect.job_title || prospect.title || '');

        // Get LinkedIn account for campaign creator
        const { data: linkedInAccount } = await supabase
          .from('workspace_accounts')
          .select('*')
          .eq('workspace_id', campaign.workspace_id)
          .eq('user_id', campaign.created_by)
          .eq('account_type', 'linkedin')
          .eq('connection_status', 'connected')
          .single();

        if (!linkedInAccount) {
          console.error(`❌ No LinkedIn account for campaign creator`);
          results.failed++;
          results.errors.push({
            prospect: prospectName,
            error: 'No LinkedIn account'
          });
          continue;
        }

        // Get provider_id from personalization_data
        const providerId = prospect.personalization_data?.provider_id;

        if (!providerId) {
          console.error(`❌ No provider_id for ${prospectName}`);
          results.failed++;
          results.errors.push({
            prospect: prospectName,
            error: 'Missing provider_id'
          });
          continue;
        }

        // Send follow-up message via Unipile
        const sendMessageUrl = `https://${process.env.UNIPILE_DSN}/api/v1/chats/messages`;

        const sendResponse = await fetch(sendMessageUrl, {
          method: 'POST',
          headers: {
            'X-API-KEY': process.env.UNIPILE_API_KEY || '',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            account_id: linkedInAccount.unipile_account_id,
            provider_id: providerId,
            text: personalizedMsg
          })
        });

        if (!sendResponse.ok) {
          const errorText = await sendResponse.text();
          console.error(`❌ Failed to send to ${prospectName}: ${errorText}`);
          results.failed++;
          results.errors.push({
            prospect: prospectName,
            error: `API error: ${sendResponse.status}`
          });
          continue;
        }

        const sendData = await sendResponse.json();
        console.log(`✅ Follow-up sent to ${prospectName}`);

        // Calculate next follow-up delay (3 days default)
        const nextFollowUpDelay = getFollowUpDelay(currentIndex + 1);
        const nextFollowUpDue = nextFollowUpDelay
          ? new Date(Date.now() + nextFollowUpDelay).toISOString()
          : null;

        // Update prospect
        await supabase
          .from('campaign_prospects')
          .update({
            follow_up_sequence_index: currentIndex + 1,
            follow_up_due_at: nextFollowUpDue,
            last_follow_up_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            personalization_data: {
              ...prospect.personalization_data,
              last_message_id: sendData.id || sendData.object?.id
            }
          })
          .eq('id', prospect.id);

        results.sent++;

        // Rate limiting: wait 2 seconds between messages
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (prospectError) {
        console.error(`❌ Error sending follow-up:`, prospectError);
        results.failed++;
        results.errors.push({
          prospect: `${prospect.first_name} ${prospect.last_name}`,
          error: prospectError instanceof Error ? prospectError.message : 'Unknown error'
        });
      }
    }

    console.log(`\n🎉 Follow-up sending completed:`);
    console.log(`   Sent: ${results.sent}`);
    console.log(`   Failed: ${results.failed}`);

    return NextResponse.json({
      success: true,
      message: `Sent ${results.sent} follow-ups, ${results.failed} failed`,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Cron error:', error);
    return NextResponse.json({
      error: 'Cron execution failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Calculate follow-up delay based on sequence index
function getFollowUpDelay(index: number): number | null {
  const delays = [
    24 * 60 * 60 * 1000,       // Follow-up 1: 24 hours after connection
    3 * 24 * 60 * 60 * 1000,   // Follow-up 2: 3 days after follow-up 1
    5 * 24 * 60 * 60 * 1000,   // Follow-up 3: 5 days after follow-up 2
    7 * 24 * 60 * 60 * 1000,   // Follow-up 4: 7 days after follow-up 3
    14 * 24 * 60 * 60 * 1000   // Follow-up 5: 14 days after follow-up 4
  ];

  return delays[index] || null; // null means no more follow-ups
}

// Allow GET for testing
export async function GET(req: NextRequest) {
  return NextResponse.json({
    name: 'Send Follow-Up Messages Cron',
    description: 'Sends scheduled follow-up messages to connected prospects',
    schedule: 'Every 1 hour',
    endpoint: '/api/cron/send-follow-ups',
    method: 'POST'
  });
}
