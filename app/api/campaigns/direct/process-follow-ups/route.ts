import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeCompanyName } from '@/lib/prospect-normalization';
import {
  getRandomizedFollowUpInterval,
  getPreSendDelayMs,
  getComposingDelayMs,
  isMessageWarning
} from '@/lib/anti-detection/message-variance';

/**
 * Direct Campaign Execution - Process Follow-Ups
 *
 * Called by Netlify scheduled functions every hour:
 * 1. Find prospects where follow_up_due_at <= NOW
 * 2. Check if connection accepted
 * 3. Send next follow-up message
 * 4. Update follow_up_due_at for next message
 *
 * POST /api/campaigns/direct/process-follow-ups
 * Header: x-cron-secret (for security)
 */

export const maxDuration = 300; // 5 minutes

// Unipile REST API configuration - matching send-connection-requests route
const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

async function unipileRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${UNIPILE_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.title || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Follow-up intervals are now RANDOMIZED via getRandomizedFollowUpInterval()
// Base intervals: [5, 7, 5, 7] with +/- 2 days variance
// This creates human-like variation: FU1 might be 3-7 days, FU2 might be 5-9 days, etc.
const BASE_FOLLOW_UP_INTERVALS = [5, 7, 5, 7]; // Reference only - actual intervals are randomized

export async function POST(req: NextRequest) {
  try {
    // Security check - verify cron secret
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      console.warn('⚠️  Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🕐 Processing follow-ups...');

    // 1. Find prospects due for follow-up (exclude those who replied)
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
      // Bug fix Nov 27: Only send follow-ups to accepted connections
      // connection_request_sent should NOT receive follow-ups (they haven't accepted yet)
      .in('status', ['connected', 'messaging'])
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
    const processedProspectIds = new Set<string>(); // Track successfully processed prospects

    for (const prospect of prospects) {
      try {
        console.log(`\n👤 Processing: ${prospect.first_name} ${prospect.last_name}`);
        console.log(`📍 Follow-up index: ${prospect.follow_up_sequence_index}`);

        // Safety check: Skip if prospect has replied
        if (prospect.status === 'replied') {
          console.log(`✅ Prospect already replied, skipping follow-up`);
          results.push({
            prospectId: prospect.id,
            name: `${prospect.first_name} ${prospect.last_name}`,
            status: 'skipped_replied'
          });
          continue;
        }

        const campaign = prospect.campaigns as any;
        const linkedinAccount = campaign.workspace_accounts as any;
        const unipileAccountId = linkedinAccount.unipile_account_id;

        // Check if connection was accepted by checking network_distance
        console.log(`🔍 Checking connection status via profile...`);

        try {
          // Get the prospect's profile to check network_distance
          let profile: any;

          // CRITICAL FIX (Dec 8): ALWAYS use vanity endpoint - provider_id endpoint returns WRONG profiles!
          // Unipile bug: profile?provider_id= returns Jamshaid Ali when looking up Paul Dhaliwal
          const vanityMatch = prospect.linkedin_url?.match(/linkedin\.com\/in\/([^\/\?#]+)/);
          if (!vanityMatch) throw new Error(`Cannot extract LinkedIn vanity identifier from ${prospect.linkedin_url}`);

          const vanityId = vanityMatch[1];
          // ALWAYS use legacy /users/{vanity} endpoint - provider_id lookup is broken
          profile = await unipileRequest(`/api/v1/users/${vanityId}?account_id=${unipileAccountId}`);

          // Check if connection is accepted (1st degree connection)
          if (profile.network_distance !== 'FIRST_DEGREE') {
            console.log(`⏸️  Connection not accepted yet (distance: ${profile.network_distance}), will retry later`);

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
              networkDistance: profile.network_distance,
              nextCheck: newDueAt.toISOString()
            });

            continue;
          }

          // Connection is accepted! Update the database
          if (!prospect.connection_accepted_at) {
            await supabase
              .from('campaign_prospects')
              .update({
                status: 'connected',
                connection_accepted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', prospect.id);
          }

          // Now find or create the chat for messaging
          const chatsResponse = await unipileRequest(
            `/api/v1/chats?account_id=${unipileAccountId}`
          );

          let chat = chatsResponse.items?.find((c: any) =>
            c.attendees?.some((a: any) => a.provider_id === prospect.linkedin_user_id)
          );

          // If no chat exists, we may need to create one or wait for LinkedIn to create it
          if (!chat) {
            console.log(`⚠️  Connection accepted but no chat yet, will retry in next cycle`);

            // Push back by 2 hours to allow chat creation
            const newDueAt = new Date();
            newDueAt.setHours(newDueAt.getHours() + 2);

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
              status: 'waiting_for_chat',
              nextCheck: newDueAt.toISOString()
            });

            continue;
          }

        } catch (profileError: any) {
          // If we can't get the profile, skip this prospect for now
          console.error(`❌ Failed to check profile for ${prospect.first_name}:`, profileError.message);

          // Push back by 2 hours to retry
          const newDueAt = new Date();
          newDueAt.setHours(newDueAt.getHours() + 2);

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
            status: 'profile_check_failed',
            error: profileError.message,
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

        // Get the raw follow-up message
        const rawMessage = followUpMessages[messageIndex];

        // SPINTAX REMOVED (Dec 18, 2025) - Feature disabled due to bugs
        // Direct personalization only - no spintax processing
        const firstName = prospect.first_name || '';
        const lastName = prospect.last_name || '';
        const rawCompanyName = prospect.company_name || '';
        const companyName = normalizeCompanyName(rawCompanyName) || rawCompanyName;
        const title = prospect.title || '';

        // Personalize the message (replace {first_name}, {company_name}, etc.)
        const message = rawMessage
          .replace(/\{first_name\}/gi, firstName)
          .replace(/\{last_name\}/gi, lastName)
          .replace(/\{company_name\}/gi, companyName)
          .replace(/\{title\}/gi, title);

        // HUMAN-LIKE DELAYS (Anti-Detection)
        // Simulate: reading conversation history, composing thoughtful response
        const preSendDelay = getPreSendDelayMs();
        console.log(`⏳ Pre-send delay: ${Math.round(preSendDelay / 1000)}s (reading conversation)`);
        await new Promise(resolve => setTimeout(resolve, preSendDelay));

        const composingDelay = getComposingDelayMs(message.length);
        console.log(`⌨️  Composing delay: ${Math.round(composingDelay / 1000)}s (typing ${message.length} chars)`);
        await new Promise(resolve => setTimeout(resolve, composingDelay));

        // Send message using REST API
        console.log(`📤 Sending follow-up message...`);
        await unipileRequest(`/api/v1/chats/${chat.id}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            text: message
          })
        });

        // Mark as successfully processed (for rate limit tracking)
        processedProspectIds.add(prospect.id);

        // Calculate next follow-up time with RANDOMIZED interval
        // Uses getRandomizedFollowUpInterval() for human-like variance
        // Returns -1 if this follow-up should be skipped (5% probability for human hesitation)
        const nextMessageIndex = messageIndex + 1;
        let nextDueAt: Date | null = null;

        if (nextMessageIndex < followUpMessages.length) {
          const nextInterval = getRandomizedFollowUpInterval(nextMessageIndex);

          if (nextInterval === -1) {
            // Random skip (human hesitation) - skip this follow-up entirely
            console.log(`⏭️  Random skip triggered for FU${nextMessageIndex + 1} (human hesitation simulation)`);
            // Move to the NEXT follow-up after this one
            if (nextMessageIndex + 1 < followUpMessages.length) {
              const skipToInterval = getRandomizedFollowUpInterval(nextMessageIndex + 1);
              if (skipToInterval > 0) {
                nextDueAt = new Date();
                nextDueAt.setDate(nextDueAt.getDate() + skipToInterval);
              }
            }
          } else {
            nextDueAt = new Date();
            nextDueAt.setDate(nextDueAt.getDate() + nextInterval);
            console.log(`📅 Next FU interval: ${nextInterval} days (randomized from base ${BASE_FOLLOW_UP_INTERVALS[nextMessageIndex] || 7})`);
          }
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

        // Implement retry logic based on error type
        let retryDelay = 60; // Default: retry in 1 hour

        if (error.status === 429) {
          // Rate limited - STOP processing immediately to prevent duplicates
          retryDelay = 240;
          console.log(`⏸️  Rate limited at prospect #${processedProspectIds.size + 1}/${prospects.length}`);
          console.log(`⏸️  Successfully processed: ${processedProspectIds.size} prospects`);
          console.log(`⏸️  Will stop and retry unprocessed prospects in 4 hours`);

          // Update THIS prospect's retry time
          await supabase
            .from('campaign_prospects')
            .update({
              follow_up_due_at: new Date(Date.now() + retryDelay * 60 * 1000).toISOString(),
              notes: `Rate limited: ${errorMessage} (${new Date().toISOString()})`,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          results.push({
            prospectId: prospect.id,
            name: `${prospect.first_name} ${prospect.last_name}`,
            status: 'rate_limited',
            error: errorMessage,
            retryAt: new Date(Date.now() + retryDelay * 60 * 1000).toISOString()
          });

          // BREAK the loop - stop processing to avoid hitting already-processed prospects on retry
          break;
        } else {
          // Other errors (500, 404, etc.) - retry this specific prospect later
          if (error.status >= 500) {
            retryDelay = 30; // Server error - retry in 30 minutes
            console.log(`⚠️  Server error, will retry in 30 minutes`);
          } else if (error.status === 404) {
            retryDelay = 1440; // Not found - might be deleted, retry in 24 hours
            console.log(`❓ Not found, will retry in 24 hours`);
          }

          // Update THIS prospect's follow_up_due_at to retry later
          const retryAt = new Date();
          retryAt.setMinutes(retryAt.getMinutes() + retryDelay);

          await supabase
            .from('campaign_prospects')
            .update({
              follow_up_due_at: retryAt.toISOString(),
              notes: `Follow-up retry: ${errorMessage} (${new Date().toISOString()})`,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          results.push({
            prospectId: prospect.id,
            name: `${prospect.first_name} ${prospect.last_name}`,
            status: 'failed_retry_scheduled',
            error: errorMessage,
            retryAt: retryAt.toISOString(),
            errorDetails: errorDetails
          });

          // Continue processing other prospects (don't break for non-rate-limit errors)
        }
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
