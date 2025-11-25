/**
 * Cron Job: Send Follow-Up Messages
 *
 * Sends scheduled follow-up messages to connected prospects
 * Progresses through campaign's follow-up sequence
 *
 * COMPLIANCE:
 * - Business hours: 9 AM - 5 PM
 * - No weekends
 * - No US public holidays
 * - Rate limited: 10 follow-ups per run with 3-5 second delays
 *
 * Schedule: Every 30 minutes via Netlify scheduled function
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import moment from 'moment-timezone';

export const maxDuration = 120; // 2 minutes

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

// Public holidays (US holidays 2025-2026)
const PUBLIC_HOLIDAYS = [
  '2025-01-01', '2025-01-20', '2025-02-17', '2025-05-26',
  '2025-06-19', '2025-07-04', '2025-09-01', '2025-11-11',
  '2025-11-27', '2025-12-25', '2026-01-01', '2026-01-19'
];

// Check if we can send now (business hours, not weekend/holiday)
function canSendNow(timezone = 'America/New_York'): boolean {
  const now = moment().tz(timezone);

  // Check weekend
  const day = now.day(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) {
    console.log(`⏸️  Weekend - no follow-ups sent (${now.format('llll')})`);
    return false;
  }

  // Check business hours (9 AM - 5 PM)
  const hour = now.hour();
  if (hour < 9 || hour >= 17) {
    console.log(`⏸️  Outside business hours (${hour}:00) - no follow-ups sent`);
    return false;
  }

  // Check holidays
  const dateStr = now.format('YYYY-MM-DD');
  if (PUBLIC_HOLIDAYS.includes(dateStr)) {
    console.log(`🎉 Holiday (${dateStr}) - no follow-ups sent`);
    return false;
  }

  return true;
}

/**
 * Resolve LinkedIn URL or vanity to provider_id
 * If already a provider_id (starts with ACo), return as-is
 * Otherwise, extract vanity from URL and lookup via Unipile
 */
async function resolveToProviderId(linkedinUserIdOrUrl: string, accountId: string): Promise<string> {
  // Already a provider_id (ACo format)
  if (linkedinUserIdOrUrl.startsWith('ACo')) {
    return linkedinUserIdOrUrl;
  }

  // Extract vanity from URL
  let vanity = linkedinUserIdOrUrl;
  if (linkedinUserIdOrUrl.includes('linkedin.com')) {
    const match = linkedinUserIdOrUrl.match(/linkedin\.com\/in\/([^\/\?#]+)/);
    if (match) {
      vanity = match[1];
    }
  }

  console.log(`🔍 Resolving vanity "${vanity}" to provider_id...`);

  // Use legacy endpoint (NOT /api/v1/users/profile?identifier= which is broken for vanities with numbers)
  const response = await fetch(
    `${UNIPILE_BASE_URL}/api/v1/users/${encodeURIComponent(vanity)}?account_id=${accountId}`,
    {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.title || error.message || `HTTP ${response.status}`);
  }

  const profile = await response.json();

  if (!profile.provider_id) {
    throw new Error(`Could not resolve provider_id for: ${vanity}`);
  }

  console.log(`✅ Resolved to provider_id: ${profile.provider_id}`);
  return profile.provider_id;
}

// Send message via Unipile chat API
async function sendFollowUpMessage(params: {
  account_id: string;
  attendee_provider_id: string;
  text: string;
}): Promise<{ success: boolean; message_id?: string; error?: string }> {
  try {
    // First, try to find existing chat or create new one
    // Unipile requires a chat_id to send messages

    // Step 1: Get or create chat with this attendee
    const chatResponse = await fetch(`${UNIPILE_BASE_URL}/api/v1/chats`, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        account_id: params.account_id,
        attendees_ids: [params.attendee_provider_id]
      })
    });

    if (!chatResponse.ok) {
      const error = await chatResponse.json().catch(() => ({ message: 'Unknown error' }));
      return {
        success: false,
        error: `Failed to get/create chat: ${error.message || error.title || chatResponse.status}`
      };
    }

    const chatData = await chatResponse.json();
    const chatId = chatData.id || chatData.chat_id;

    if (!chatId) {
      return {
        success: false,
        error: 'No chat_id returned from chat creation'
      };
    }

    // Step 2: Send message to the chat
    const messageResponse = await fetch(`${UNIPILE_BASE_URL}/api/v1/chats/${chatId}/messages`, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: params.text
      })
    });

    if (!messageResponse.ok) {
      const error = await messageResponse.json().catch(() => ({ message: 'Unknown error' }));
      return {
        success: false,
        error: `Failed to send message: ${error.message || error.title || messageResponse.status}`
      };
    }

    const messageData = await messageResponse.json();
    return {
      success: true,
      message_id: messageData.id || messageData.message_id
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('⏰ Cron: Processing follow-up messages...');

    // Verify cron secret
    const cronSecret = req.headers.get('x-cron-secret');
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      console.error('❌ Invalid cron secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if we can send now
    if (!canSendNow()) {
      return NextResponse.json({
        success: true,
        message: 'Outside business hours or weekend/holiday - no follow-ups sent',
        processed: 0
      });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get prospects due for follow-up (status = 'connected', follow_up_due_at <= now)
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select(`
        id,
        first_name,
        last_name,
        company_name,
        industry,
        title,
        linkedin_url,
        linkedin_user_id,
        follow_up_sequence_index,
        campaign_id,
        campaigns (
          id,
          campaign_name,
          workspace_id,
          linkedin_account_id,
          message_templates,
          workspace_accounts!linkedin_account_id (
            id,
            unipile_account_id,
            account_name
          )
        )
      `)
      .eq('status', 'connected')
      .lte('follow_up_due_at', new Date().toISOString())
      .not('linkedin_user_id', 'is', null)
      .order('follow_up_due_at', { ascending: true })
      .limit(10); // Process 10 per run

    if (prospectsError) {
      console.error('❌ Error fetching prospects:', prospectsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch prospects'
      }, { status: 500 });
    }

    if (!prospects || prospects.length === 0) {
      console.log('✅ No follow-ups due');
      return NextResponse.json({
        success: true,
        message: 'No follow-ups due',
        processed: 0,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`📊 Processing ${prospects.length} follow-up messages...`);

    const results = {
      sent: 0,
      completed: 0,
      failed: 0,
      errors: [] as Array<{ prospect: string; error: string }>
    };

    for (const prospect of prospects) {
      try {
        const campaign = prospect.campaigns as any;
        const linkedinAccount = campaign?.workspace_accounts as any;
        const prospectName = `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim() || 'Unknown';

        console.log(`\n📤 Processing follow-up for: ${prospectName}`);

        // Validate LinkedIn account
        if (!linkedinAccount?.unipile_account_id) {
          console.error(`❌ No LinkedIn account for campaign`);
          results.failed++;
          results.errors.push({ prospect: prospectName, error: 'No LinkedIn account configured' });
          continue;
        }

        // Validate provider_id
        if (!prospect.linkedin_user_id) {
          console.error(`❌ No linkedin_user_id for ${prospectName}`);
          results.failed++;
          results.errors.push({ prospect: prospectName, error: 'Missing linkedin_user_id' });
          continue;
        }

        // Get follow-up messages from campaign
        const followUpMessages = campaign.message_templates?.follow_up_messages || [];
        const currentIndex = prospect.follow_up_sequence_index || 0;

        console.log(`   Current index: ${currentIndex}, Total follow-ups: ${followUpMessages.length}`);

        // Check if all follow-ups have been sent
        if (currentIndex >= followUpMessages.length) {
          console.log(`✅ All follow-ups completed for ${prospectName}`);

          // Mark as sequence complete
          await supabase
            .from('campaign_prospects')
            .update({
              status: 'follow_up_complete',
              follow_up_due_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          results.completed++;
          continue;
        }

        // Get current follow-up message template
        const messageTemplate = followUpMessages[currentIndex];

        if (!messageTemplate) {
          console.error(`❌ No message template at index ${currentIndex}`);
          results.failed++;
          results.errors.push({ prospect: prospectName, error: `No message at index ${currentIndex}` });
          continue;
        }

        // Personalize message
        const personalizedMessage = messageTemplate
          .replace(/\{first_name\}/gi, prospect.first_name || '')
          .replace(/\{last_name\}/gi, prospect.last_name || '')
          .replace(/\{company\}/gi, prospect.company_name || '')
          .replace(/\{company_name\}/gi, prospect.company_name || '')
          .replace(/\{industry\}/gi, prospect.industry || '')
          .replace(/\{title\}/gi, prospect.title || '');

        console.log(`   Sending follow-up #${currentIndex + 1}: "${personalizedMessage.substring(0, 50)}..."`);

        // Resolve linkedin_user_id to provider_id if needed
        let providerId = prospect.linkedin_user_id;
        if (!providerId.startsWith('ACo')) {
          console.log(`🔄 Resolving URL/vanity to provider_id...`);
          try {
            providerId = await resolveToProviderId(providerId, linkedinAccount.unipile_account_id);

            // Update DB with resolved provider_id for future use
            await supabase
              .from('campaign_prospects')
              .update({ linkedin_user_id: providerId })
              .eq('id', prospect.id);
          } catch (resolveError) {
            console.error(`❌ Failed to resolve provider_id: ${resolveError}`);
            results.failed++;
            results.errors.push({ prospect: prospectName, error: `Failed to resolve provider_id: ${resolveError}` });
            continue;
          }
        }

        // Send follow-up message
        const sendResult = await sendFollowUpMessage({
          account_id: linkedinAccount.unipile_account_id,
          attendee_provider_id: providerId,
          text: personalizedMessage
        });

        if (!sendResult.success) {
          console.error(`❌ Failed to send: ${sendResult.error}`);
          results.failed++;
          results.errors.push({ prospect: prospectName, error: sendResult.error || 'Send failed' });

          // Update prospect with error (but don't block next attempt)
          await supabase
            .from('campaign_prospects')
            .update({
              notes: `Follow-up #${currentIndex + 1} failed: ${sendResult.error}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          continue;
        }

        console.log(`✅ Follow-up #${currentIndex + 1} sent to ${prospectName}`);

        // Calculate next follow-up time
        const nextFollowUpDelay = getFollowUpDelay(currentIndex + 1);
        const nextFollowUpDue = nextFollowUpDelay
          ? new Date(Date.now() + nextFollowUpDelay).toISOString()
          : null;

        // Determine next status
        const nextStatus = (currentIndex + 1 >= followUpMessages.length)
          ? 'follow_up_complete'
          : 'connected';

        // Update prospect record
        await supabase
          .from('campaign_prospects')
          .update({
            status: nextStatus,
            follow_up_sequence_index: currentIndex + 1,
            follow_up_due_at: nextFollowUpDue,
            updated_at: new Date().toISOString()
          })
          .eq('id', prospect.id);

        // Store message in campaign_messages for tracking
        await supabase
          .from('campaign_messages')
          .insert({
            campaign_id: prospect.campaign_id,
            workspace_id: campaign.workspace_id,
            platform: 'linkedin',
            platform_message_id: sendResult.message_id || `fu_${prospect.id}_${currentIndex}`,
            recipient_linkedin_profile: prospect.linkedin_url,
            recipient_name: prospectName,
            prospect_id: prospect.id,
            message_content: personalizedMessage,
            message_template_variant: `follow_up_${currentIndex + 1}`,
            sent_at: new Date().toISOString(),
            sent_via: 'cron_follow_up',
            sender_account: linkedinAccount.account_name,
            delivery_status: 'sent'
          })
          .catch(err => console.warn('⚠️ Failed to store message:', err));

        results.sent++;

        // Rate limiting: 3-5 seconds between messages
        const delay = 3000 + Math.random() * 2000;
        await new Promise(resolve => setTimeout(resolve, delay));

      } catch (error) {
        console.error(`❌ Error processing prospect:`, error);
        results.failed++;
        results.errors.push({
          prospect: `${prospect.first_name} ${prospect.last_name}`,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const duration = Date.now() - startTime;

    console.log(`\n📊 Follow-up Summary:`);
    console.log(`   Sent: ${results.sent}`);
    console.log(`   Completed: ${results.completed}`);
    console.log(`   Failed: ${results.failed}`);
    console.log(`   Duration: ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: `Processed ${prospects.length} prospects: ${results.sent} sent, ${results.completed} completed, ${results.failed} failed`,
      results,
      execution_time_ms: duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Cron error:', error);
    return NextResponse.json({
      success: false,
      error: 'Cron execution failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Calculate follow-up delay based on sequence index
 *
 * Schedule:
 * - Follow-up 1: 1 day after connection
 * - Follow-up 2: 3 days after follow-up 1
 * - Follow-up 3: 5 days after follow-up 2
 * - Follow-up 4: 5 days after follow-up 3
 * - Follow-up 5: 3 days after follow-up 4
 * - Goodbye: 3 days after follow-up 5
 */
function getFollowUpDelay(nextIndex: number): number | null {
  const delays: Record<number, number> = {
    1: 1 * 24 * 60 * 60 * 1000,   // 1 day
    2: 3 * 24 * 60 * 60 * 1000,   // 3 days
    3: 5 * 24 * 60 * 60 * 1000,   // 5 days
    4: 5 * 24 * 60 * 60 * 1000,   // 5 days
    5: 3 * 24 * 60 * 60 * 1000,   // 3 days
    6: 3 * 24 * 60 * 60 * 1000    // 3 days (goodbye)
  };

  return delays[nextIndex] || null;
}

// GET for testing/info
export async function GET() {
  return NextResponse.json({
    name: 'Send Follow-Up Messages',
    description: 'Sends scheduled follow-up messages to connected prospects',
    endpoint: '/api/cron/send-follow-ups',
    method: 'POST',
    schedule: 'Every 30 minutes via Netlify scheduled function',
    compliance: {
      business_hours: '9 AM - 5 PM',
      skips_weekends: true,
      skips_holidays: true,
      rate_limit: '10 prospects per run with 3-5s delays'
    },
    follow_up_schedule: {
      'follow_up_1': '1 day after connection',
      'follow_up_2': '3 days after FU1',
      'follow_up_3': '5 days after FU2',
      'follow_up_4': '5 days after FU3',
      'follow_up_5': '3 days after FU4',
      'goodbye': '3 days after FU5'
    }
  });
}
