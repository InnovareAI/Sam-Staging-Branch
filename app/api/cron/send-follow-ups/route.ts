/**
 * Cron Job: Send Follow-Up Messages
 *
 * Sends scheduled follow-up messages to connected prospects
 * Progresses through campaign's follow-up sequence
 *
 * COMPLIANCE:
 * - Business hours: 7 AM - 6 PM
 * - No weekends
 * - No US public holidays
 * - MAX 1 follow-up per prospect per day (prevents spam)
 * - Skips prospects who already received follow-up today
 *
 * Schedule: Every 30 minutes via Netlify scheduled function
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  canSendNow as canSendNowCheck,
  DEFAULT_TIMEZONE,
  FOLLOW_UP_HOURS
} from '@/lib/scheduling-config';
import { airtableService } from '@/lib/airtable';

// Type definitions for Supabase joined queries
interface WorkspaceAccount {
  id: string;
  unipile_account_id: string;
  account_name: string;
}

interface CampaignWithAccount {
  id: string;
  campaign_name: string;
  workspace_id: string;
  linkedin_account_id: string;
  message_templates: {
    follow_up_messages?: string[];
    [key: string]: unknown;
  };
  workspace_accounts: WorkspaceAccount | null;
}

export const maxDuration = 120; // 2 minutes

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

// Use centralized scheduling config
function canSendNow(timezone = DEFAULT_TIMEZONE): boolean {
  const result = canSendNowCheck(timezone, FOLLOW_UP_HOURS);
  if (!result.canSend && result.reason) {
    console.log(`⏸️  ${result.reason}`);
  }
  return result.canSend;
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
// IMPORTANT: Unipile requires multipart/form-data, NOT application/json
// And the text must be included when creating a new chat
async function sendFollowUpMessage(params: {
  account_id: string;
  attendee_provider_id: string;
  text: string;
}): Promise<{ success: boolean; message_id?: string; chat_id?: string; error?: string }> {
  try {
    // Create FormData for multipart/form-data request
    const formData = new FormData();
    formData.append('account_id', params.account_id);
    formData.append('attendees_ids', params.attendee_provider_id);
    formData.append('text', params.text);

    console.log(`📤 Sending follow-up via Unipile:`, {
      account_id: params.account_id,
      attendee_provider_id: params.attendee_provider_id,
      text_length: params.text.length
    });

    // Start new chat with message (single API call)
    const response = await fetch(`${UNIPILE_BASE_URL}/api/v1/chats`, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
        // Note: Don't set Content-Type - fetch will set it automatically for FormData
      },
      body: formData
    });

    const responseText = await response.text();
    console.log(`📥 Unipile response status: ${response.status}`);

    if (!response.ok) {
      let error;
      try {
        error = JSON.parse(responseText);
      } catch {
        error = { message: responseText };
      }
      console.error(`❌ Unipile error:`, error);
      return {
        success: false,
        error: `Failed to send message: ${error.message || error.title || error.detail || response.status}`
      };
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = {};
    }

    console.log(`✅ Message sent successfully:`, {
      chat_id: data.chat_id || data.id,
      message_id: data.message_id
    });

    return {
      success: true,
      chat_id: data.chat_id || data.id,
      message_id: data.message_id
    };

  } catch (error) {
    console.error(`❌ Network error sending follow-up:`, error);
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

    // Calculate start of today (midnight) for same-day check
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartISO = todayStart.toISOString();

    // Get prospects due for follow-up (status = 'connected', follow_up_due_at <= now)
    // CRITICAL: Exclude prospects who already received a follow-up TODAY (prevents spam)
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
        last_follow_up_at,
        status,
        responded_at,
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
      .or(`last_follow_up_at.is.null,last_follow_up_at.lt.${todayStartISO}`)
      .order('follow_up_due_at', { ascending: true });

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
      skipped: 0,
      errors: [] as Array<{ prospect: string; error: string }>
    };

    for (const prospect of prospects) {
      try {
        const campaign = prospect.campaigns as CampaignWithAccount | null;
        const linkedinAccount = campaign?.workspace_accounts;
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

        // CRITICAL: Double-check last_follow_up_at to prevent same-day spam
        // This is a safety net in case the query filter didn't work
        if (prospect.last_follow_up_at) {
          const lastFollowUp = new Date(prospect.last_follow_up_at);
          const now = new Date();
          if (lastFollowUp.toDateString() === now.toDateString()) {
            console.log(`⏸️  ${prospectName} already received follow-up today - SKIPPING`);
            continue;
          }
        }

        // CRITICAL: Check if prospect has replied - stop messaging immediately
        if (prospect.responded_at || prospect.status === 'replied') {
          console.log(`⏹️  ${prospectName} has replied - stopping follow-up sequence`);

          // Mark sequence as stopped due to reply
          await supabase
            .from('campaign_prospects')
            .update({
              status: 'replied',
              follow_up_due_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          results.skipped++;
          continue;
        }

        // Get follow-up messages from campaign
        const followUpMessages = campaign.message_templates?.follow_up_messages || [];
        const currentIndex = prospect.follow_up_sequence_index || 0;

        console.log(`   Current index: ${currentIndex}, Total follow-ups: ${followUpMessages.length}`);

        // Check if all follow-ups have been sent
        if (currentIndex >= followUpMessages.length) {
          console.log(`✅ All follow-ups completed for ${prospectName} - marking as Went Silent`);

          // Mark as sequence complete
          await supabase
            .from('campaign_prospects')
            .update({
              status: 'follow_up_complete',
              follow_up_due_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          // Sync to Airtable as "Went Silent" - no response after all follow-ups
          try {
            await airtableService.syncLinkedInLead({
              profileUrl: prospect.linkedin_url,
              name: prospectName,
              jobTitle: prospect.title,
              companyName: prospect.company_name,
              linkedInAccount: campaign?.campaign_name,
              intent: 'went_silent',
            });
            console.log(`📊 Updated Airtable status to "Went Silent" for ${prospectName}`);
          } catch (airtableErr) {
            console.error(`⚠️ Airtable sync failed for ${prospectName}:`, airtableErr);
          }

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
            last_follow_up_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', prospect.id);

        // Store message in campaign_messages for tracking
        try {
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
            });
        } catch (err) {
          console.warn('⚠️ Failed to store message:', err);
        }

        results.sent++;

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
/**
 * Get delay until next follow-up based on the NEW sequence index
 *
 * Schedule: 1 day (first FU after connection), then 3, 5, 5, 3, 3 days between subsequent FUs
 *
 * After FU1 sent (nextIndex = 1): wait 3 days for FU2
 * After FU2 sent (nextIndex = 2): wait 5 days for FU3
 * After FU3 sent (nextIndex = 3): wait 5 days for FU4
 * After FU4 sent (nextIndex = 4): wait 3 days for FU5
 * After FU5 sent (nextIndex = 5): wait 3 days for FU6 (goodbye)
 * After FU6 sent (nextIndex = 6): null (sequence complete)
 */
function getFollowUpDelay(nextIndex: number): number | null {
  const delays: Record<number, number> = {
    1: 3 * 24 * 60 * 60 * 1000,   // 3 days until FU2
    2: 5 * 24 * 60 * 60 * 1000,   // 5 days until FU3
    3: 5 * 24 * 60 * 60 * 1000,   // 5 days until FU4
    4: 3 * 24 * 60 * 60 * 1000,   // 3 days until FU5
    5: 3 * 24 * 60 * 60 * 1000,   // 3 days until FU6 (goodbye)
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
      rate_limit: 'max 1 follow-up per prospect per day'
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
