import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Cron Job: Poll Message Replies (Backup for Webhook)
 *
 * Runs every 2 hours to detect if prospects have replied
 * This is a BACKUP for the Unipile new_message webhook
 *
 * Why needed:
 * - Webhooks can fail or be delayed up to 8 hours
 * - Without this, prospects get follow-ups after they've replied
 * - Connection acceptance has polling backup, replies need one too
 *
 * POST /api/cron/poll-message-replies
 * Header: x-cron-secret (for security)
 */

export const maxDuration = 60; // 60 seconds max

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Security: Verify cron secret
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      console.error('❌ Invalid cron secret');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    console.log('📨 Poll message replies starting...');

    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all prospects that might have replies (connected status, no responded_at)
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select(`
        id,
        first_name,
        last_name,
        linkedin_user_id,
        status,
        responded_at,
        campaign_id,
        campaigns (
          workspace_id,
          linkedin_account_id,
          workspace_accounts!linkedin_account_id (
            unipile_account_id
          )
        )
      `)
      .in('status', ['connected', 'connection_request_sent'])
      .is('responded_at', null)
      .not('linkedin_user_id', 'is', null)
      .limit(50);

    if (prospectsError) {
      console.error('❌ Error fetching prospects:', prospectsError);
      return NextResponse.json({ success: false, error: 'Failed to fetch prospects' }, { status: 500 });
    }

    if (!prospects || prospects.length === 0) {
      console.log('ℹ️  No prospects to check for replies');
      return NextResponse.json({
        success: true,
        message: 'No prospects to check',
        checked: 0,
        replies_found: 0
      });
    }

    console.log(`📧 Checking ${prospects.length} prospects for replies...`);

    // Group prospects by LinkedIn account
    const byAccount: Record<string, typeof prospects> = {};
    for (const prospect of prospects) {
      const campaign = prospect.campaigns as any;
      const accountId = campaign?.workspace_accounts?.unipile_account_id;
      if (accountId) {
        if (!byAccount[accountId]) byAccount[accountId] = [];
        byAccount[accountId].push(prospect);
      }
    }

    const results = {
      checked: 0,
      replies_found: 0,
      errors: [] as string[]
    };

    // Process each LinkedIn account
    for (const [accountId, accountProspects] of Object.entries(byAccount)) {
      try {
        console.log(`\n🔍 Checking account ${accountId} (${accountProspects.length} prospects)`);

        // Fetch recent chats for this account
        const chatsResponse = await fetch(
          `${UNIPILE_BASE_URL}/api/v1/chats?account_id=${accountId}&limit=100`,
          {
            method: 'GET',
            headers: {
              'X-API-KEY': UNIPILE_API_KEY,
              'Accept': 'application/json'
            }
          }
        );

        if (!chatsResponse.ok) {
          console.error(`❌ Failed to fetch chats for account ${accountId}`);
          results.errors.push(`Failed to fetch chats for ${accountId}`);
          continue;
        }

        const chatsData = await chatsResponse.json();
        const chats = chatsData.items || [];

        // For each prospect, check if they have any messages TO us (they replied)
        for (const prospect of accountProspects) {
          results.checked++;

          // Find chat with this prospect
          const prospectChat = chats.find((chat: any) => {
            const participants = chat.attendees || [];
            return participants.some((p: any) =>
              p.provider_id === prospect.linkedin_user_id ||
              p.public_identifier === extractVanity(prospect.linkedin_user_id)
            );
          });

          if (!prospectChat) {
            continue; // No chat found, prospect hasn't replied
          }

          // Fetch messages in this chat
          const messagesResponse = await fetch(
            `${UNIPILE_BASE_URL}/api/v1/chats/${prospectChat.id}/messages?limit=20`,
            {
              method: 'GET',
              headers: {
                'X-API-KEY': UNIPILE_API_KEY,
                'Accept': 'application/json'
              }
            }
          );

          if (!messagesResponse.ok) {
            continue;
          }

          const messagesData = await messagesResponse.json();
          const messages = messagesData.items || [];

          // Check if any message is FROM the prospect (not from us)
          const prospectReply = messages.find((msg: any) => {
            const senderId = msg.sender?.provider_id || msg.sender_id;
            return senderId === prospect.linkedin_user_id;
          });

          if (prospectReply) {
            console.log(`✅ Found reply from ${prospect.first_name} ${prospect.last_name}`);
            results.replies_found++;

            // Update prospect as replied - STOP all messaging
            await supabase
              .from('campaign_prospects')
              .update({
                status: 'replied',
                responded_at: prospectReply.created_at || new Date().toISOString(),
                follow_up_due_at: null, // CRITICAL: Stop follow-ups
                updated_at: new Date().toISOString()
              })
              .eq('id', prospect.id);

            // Also cancel any pending send_queue items for this prospect
            await supabase
              .from('send_queue')
              .update({
                status: 'cancelled',
                error_message: 'Prospect replied - sequence stopped',
                updated_at: new Date().toISOString()
              })
              .eq('prospect_id', prospect.id)
              .eq('status', 'pending');

            // Also cancel any pending emails for this prospect
            await supabase
              .from('email_send_queue')
              .update({
                status: 'cancelled',
                error_message: 'Prospect replied - sequence stopped (polling)',
                updated_at: new Date().toISOString()
              })
              .eq('prospect_id', prospect.id)
              .eq('status', 'pending');

            // TRIGGER SAM REPLY AGENT - Create draft for approval
            console.log(`🤖 Triggering SAM Reply Agent for ${prospect.first_name}...`);
            await triggerReplyAgent(
              supabase,
              prospect,
              prospectReply,
              (prospect.campaigns as any)?.workspace_id
            );
          }
        }

        // Rate limit between accounts
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (accountError) {
        console.error(`❌ Error processing account ${accountId}:`, accountError);
        results.errors.push(`Account ${accountId}: ${accountError}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n⏱️  Poll completed in ${duration}ms`);
    console.log(`📊 Results: ${results.checked} checked, ${results.replies_found} replies found`);

    return NextResponse.json({
      success: true,
      message: `Checked ${results.checked} prospects, found ${results.replies_found} replies`,
      ...results,
      execution_time_ms: duration
    });

  } catch (error) {
    console.error('❌ Poll message replies error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper: Extract vanity from LinkedIn URL or provider_id
function extractVanity(linkedinId: string): string | null {
  if (!linkedinId) return null;

  // If it's a URL, extract vanity
  const urlMatch = linkedinId.match(/linkedin\.com\/in\/([^\/\?#]+)/);
  if (urlMatch) return urlMatch[1];

  // If it's already a vanity or provider_id, return as-is
  return linkedinId;
}

/**
 * Trigger SAM Reply Agent when a prospect replies
 * Creates a draft for human approval via email/chat
 */
async function triggerReplyAgent(
  supabase: any,
  prospect: any,
  inboundMessage: any,
  workspaceId: string
) {
  try {
    // Check if workspace has Reply Agent enabled
    const { data: config } = await supabase
      .from('workspace_reply_agent_config')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('enabled', true)
      .single();

    if (!config) {
      console.log(`   ℹ️ Reply Agent not enabled for workspace ${workspaceId}`);
      return;
    }

    // Check if we already have a draft for this message
    const { data: existingDraft } = await supabase
      .from('reply_agent_drafts')
      .select('id')
      .eq('inbound_message_id', inboundMessage.id)
      .single();

    if (existingDraft) {
      console.log(`   ℹ️ Draft already exists for message ${inboundMessage.id}`);
      return;
    }

    // Generate approval token
    const approvalToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48); // 48 hour expiry

    // Create draft record (Reply Agent cron will pick this up and generate AI reply)
    const { data: draft, error: draftError } = await supabase
      .from('reply_agent_drafts')
      .insert({
        workspace_id: workspaceId,
        campaign_id: prospect.campaign_id,
        prospect_id: prospect.id,
        inbound_message_id: inboundMessage.id,
        inbound_message_text: inboundMessage.text || inboundMessage.body,
        inbound_message_at: inboundMessage.created_at || new Date().toISOString(),
        channel: 'linkedin',
        prospect_name: `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim(),
        prospect_linkedin_url: prospect.linkedin_url,
        prospect_company: prospect.company,
        prospect_title: prospect.title,
        approval_token: approvalToken,
        expires_at: expiresAt.toISOString(),
        status: 'pending_generation', // Will be processed by reply-agent-process cron
      })
      .select()
      .single();

    if (draftError) {
      console.error(`   ❌ Error creating draft:`, draftError);
      return;
    }

    console.log(`   ✅ Draft created: ${draft.id} - SAM will generate reply`);

  } catch (error) {
    console.error(`   ❌ Error triggering Reply Agent:`, error);
  }
}
