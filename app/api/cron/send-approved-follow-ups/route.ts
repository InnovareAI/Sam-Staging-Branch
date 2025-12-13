/**
 * Cron Job: Send Approved Follow-Up Drafts
 *
 * POST /api/cron/send-approved-follow-ups
 *
 * Runs every 15 minutes to:
 * 1. Find approved drafts with scheduled_for <= NOW
 * 2. Send via appropriate channel (LinkedIn DM, Email, InMail)
 * 3. Update draft status to 'sent'
 * 4. Update prospect's follow_up_due_at for next follow-up
 *
 * This only sends drafts that have been approved via HITL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateNextFollowUpDate, FollowUpScenario } from '@/lib/services/follow-up-agent-v2';

export const maxDuration = 300; // 5 minutes

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Unipile REST API configuration
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

export async function POST(req: NextRequest) {
  try {
    // Security check
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      console.warn('⚠️ Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('📤 Sending approved follow-up drafts...');

    // 1. Find approved drafts ready to send
    const { data: drafts, error: draftsError } = await supabase
      .from('follow_up_drafts')
      .select(`
        *,
        campaign_prospects!prospect_id (
          id,
          first_name,
          last_name,
          linkedin_url,
          linkedin_user_id,
          email,
          follow_up_sequence_index
        ),
        campaigns!campaign_id (
          id,
          workspace_id,
          linkedin_account_id,
          workspace_accounts!linkedin_account_id (
            unipile_account_id,
            account_name
          )
        )
      `)
      .eq('status', 'approved')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(10); // Process 10 at a time

    if (draftsError) {
      console.error('Error fetching drafts:', draftsError);
      return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
    }

    if (!drafts || drafts.length === 0) {
      console.log('✅ No approved drafts ready to send');
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No approved drafts ready to send'
      });
    }

    console.log(`📊 Found ${drafts.length} approved drafts to send`);

    const results: Array<{
      draftId: string;
      prospectName: string;
      channel: string;
      status: 'sent' | 'failed' | 'skipped';
      error?: string;
    }> = [];

    for (const draft of drafts) {
      const prospect = draft.campaign_prospects as any;
      const campaign = draft.campaigns as any;
      const prospectName = `${prospect?.first_name || ''} ${prospect?.last_name || ''}`.trim();

      try {
        console.log(`\n📤 Sending to: ${prospectName} via ${draft.channel}`);

        // Send based on channel
        switch (draft.channel) {
          case 'linkedin': {
            const linkedinAccount = campaign?.workspace_accounts as any;
            const unipileAccountId = linkedinAccount?.unipile_account_id;

            if (!unipileAccountId) {
              throw new Error('No LinkedIn account configured for this campaign');
            }

            // Find or create chat
            const chatsResponse = await unipileRequest(
              `/api/v1/chats?account_id=${unipileAccountId}`
            );

            let chat = chatsResponse.items?.find((c: any) =>
              c.attendees?.some((a: any) => a.provider_id === prospect.linkedin_user_id)
            );

            if (!chat) {
              // Try to find by vanity URL
              const vanityMatch = prospect.linkedin_url?.match(/linkedin\.com\/in\/([^\/\?#]+)/);
              if (vanityMatch) {
                // Check if they're connected first
                const profile = await unipileRequest(
                  `/api/v1/users/${vanityMatch[1]}?account_id=${unipileAccountId}`
                );

                if (profile.network_distance !== 'FIRST_DEGREE') {
                  throw new Error(`Cannot message - not connected (distance: ${profile.network_distance})`);
                }

                // They're connected but no chat exists yet - create conversation
                console.log('📝 Creating new conversation...');
              }
            }

            if (!chat) {
              throw new Error('No chat found and cannot create one');
            }

            // Send message
            await unipileRequest(`/api/v1/chats/${chat.id}/messages`, {
              method: 'POST',
              body: JSON.stringify({
                text: draft.message
              })
            });

            console.log(`✅ LinkedIn DM sent to ${prospectName}`);
            break;
          }

          case 'email': {
            // Use Unipile email account for sending
            if (!prospect.email) {
              throw new Error('No email address for prospect');
            }

            // Get workspace email account
            const { data: emailAccount, error: emailAccountError } = await supabase
              .from('workspace_accounts')
              .select('unipile_account_id, account_name')
              .eq('workspace_id', campaign.workspace_id)
              .eq('account_type', 'email')
              .eq('connection_status', 'connected')
              .limit(1)
              .single();

            if (emailAccountError || !emailAccount?.unipile_account_id) {
              throw new Error('No email account connected for this workspace. Connect Gmail or Outlook in Settings → Integrations.');
            }

            console.log(`📧 Sending email via Unipile account: ${emailAccount.account_name}`);

            // Send email via Unipile
            await unipileRequest(`/api/v1/emails/send`, {
              method: 'POST',
              body: JSON.stringify({
                account_id: emailAccount.unipile_account_id,
                to: [{ email: prospect.email, name: prospectName }],
                subject: draft.subject || 'Following up',
                body: draft.message,
                body_type: 'text/plain'  // Use plain text for conversational emails
              })
            });

            console.log(`✅ Email sent to ${prospect.email}`);
            break;
          }

          case 'inmail': {
            // InMail requires Sales Navigator
            // TODO: Implement InMail via Unipile
            throw new Error('InMail sending not yet implemented - use LinkedIn');
          }

          default:
            throw new Error(`Unknown channel: ${draft.channel}`);
        }

        // Update draft status to sent
        await supabase
          .from('follow_up_drafts')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', draft.id);

        // Store in linkedin_messages for unified message history
        await supabase
          .from('linkedin_messages')
          .insert({
            workspace_id: campaign.workspace_id,
            campaign_id: draft.campaign_id,
            prospect_id: prospect.id,
            direction: 'outgoing',
            message_type: 'follow_up',
            content: draft.message,
            recipient_linkedin_url: prospect.linkedin_url,
            recipient_name: prospectName,
            recipient_linkedin_id: prospect.linkedin_user_id,
            status: 'sent',
            sent_at: new Date().toISOString(),
            metadata: {
              source: 'follow_up_agent',
              draft_id: draft.id,
              touch_number: draft.touch_number,
              scenario: draft.scenario,
              channel: draft.channel
            }
          });

        console.log(`💾 Stored follow-up message in linkedin_messages`);

        // Update prospect's follow-up tracking
        const nextFollowUpDate = calculateNextFollowUpDate(
          draft.scenario as FollowUpScenario,
          draft.touch_number,
          undefined
        );

        await supabase
          .from('campaign_prospects')
          .update({
            follow_up_sequence_index: draft.touch_number,
            last_follow_up_at: new Date().toISOString(),
            follow_up_due_at: nextFollowUpDate?.toISOString() || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', prospect.id);

        results.push({
          draftId: draft.id,
          prospectName,
          channel: draft.channel,
          status: 'sent'
        });

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));

      } catch (error: any) {
        console.error(`❌ Failed to send to ${prospectName}:`, error.message);

        // Update draft with error
        const retryCount = (draft.retry_count || 0) + 1;
        const shouldRetry = retryCount < 3;

        await supabase
          .from('follow_up_drafts')
          .update({
            status: shouldRetry ? 'approved' : 'failed',
            error_message: error.message,
            retry_count: retryCount,
            // If retrying, push scheduled_for back by 30 minutes
            ...(shouldRetry && {
              scheduled_for: new Date(Date.now() + 30 * 60 * 1000).toISOString()
            })
          })
          .eq('id', draft.id);

        results.push({
          draftId: draft.id,
          prospectName,
          channel: draft.channel,
          status: 'failed',
          error: error.message
        });
      }
    }

    const sent = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;

    console.log(`\n📊 Summary:`);
    console.log(`   - Sent: ${sent}`);
    console.log(`   - Failed: ${failed}`);

    return NextResponse.json({
      success: true,
      processed: drafts.length,
      sent,
      failed,
      results
    });

  } catch (error: any) {
    console.error('❌ Cron job error:', error);
    return NextResponse.json({
      error: 'Failed to send approved follow-ups',
      details: error.message
    }, { status: 500 });
  }
}
