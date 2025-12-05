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

export const maxDuration = 300; // 5 minutes max - need time for profile lookups

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
      .order('updated_at', { ascending: false }) // Most recently updated first
      .limit(20); // Dec 5: Increased to catch more prospects

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
    const prospectLog: string[] = [];
    for (const prospect of prospects) {
      const campaign = prospect.campaigns as any;
      const accountId = campaign?.workspace_accounts?.unipile_account_id;
      prospectLog.push(`${prospect.first_name}: ${accountId || 'NO_ACCOUNT'}`);
      if (accountId) {
        if (!byAccount[accountId]) byAccount[accountId] = [];
        byAccount[accountId].push(prospect);
      }
    }

    console.log(`📊 Prospects: ${prospectLog.join(', ')}`);
    console.log(`📊 Accounts: ${Object.keys(byAccount).join(', ')}`);

    const results = {
      checked: 0,
      replies_found: 0,
      errors: [] as string[],
      prospects_loaded: prospectLog,
      accounts: Object.keys(byAccount)
    };

    // Process each LinkedIn account
    for (const [accountId, accountProspects] of Object.entries(byAccount)) {
      try {
        console.log(`\n🔍 Checking account ${accountId} (${accountProspects.length} prospects)`);

        // Fetch recent chats for this account (limit to 30 most recent)
        const chatsResponse = await fetch(
          `${UNIPILE_BASE_URL}/api/v1/chats?account_id=${accountId}&limit=30`,
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

        // Dec 5 FIX: For each prospect, find their provider_id, then find chat and replies
        for (const prospect of accountProspects) {
          results.checked++;

          let prospectProviderId: string | null = null;

          // Check if linkedin_user_id is already a provider_id (starts with ACo) or a URL
          const linkedinId = prospect.linkedin_user_id;
          if (linkedinId?.startsWith('ACo')) {
            // Already a provider_id - use directly
            prospectProviderId = linkedinId;
            console.log(`   📋 ${prospect.first_name}: provider_id direct`);
          } else {
            // It's a URL - extract vanity and look up
            const prospectVanity = extractVanity(linkedinId);
            if (!prospectVanity) continue;

            try {
              const profileResponse = await fetch(
                `${UNIPILE_BASE_URL}/api/v1/users/${prospectVanity}?account_id=${accountId}`,
                {
                  method: 'GET',
                  headers: {
                    'X-API-KEY': UNIPILE_API_KEY,
                    'Accept': 'application/json'
                  }
                }
              );

              if (profileResponse.ok) {
                const profile = await profileResponse.json();
                prospectProviderId = profile.provider_id;
                console.log(`   📋 ${prospect.first_name}: ${prospectProviderId?.slice(0, 15)}...`);
              }
            } catch (err) {
              console.log(`   ⚠️ Could not look up ${prospect.first_name}`);
              continue;
            }
          }

          if (!prospectProviderId) continue;

          // Find chat with this prospect by matching attendee_provider_id
          const prospectChat = chats.find((chat: any) =>
            chat.attendee_provider_id === prospectProviderId
          );

          if (!prospectChat) {
            console.log(`   ❌ No chat found for ${prospect.first_name} (${prospectProviderId?.slice(0, 15)}...)`);
            continue; // No chat found, prospect hasn't replied
          }

          console.log(`   ✓ Found chat for ${prospect.first_name}: ${prospectChat.id}`);

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
          // Dec 5 FIX: Use is_sender === 0 and verify sender_id matches prospect
          console.log(`   📨 Checking ${messages.length} messages for reply from ${prospect.first_name}...`);
          const prospectReply = messages.find((msg: any) => {
            // is_sender: 0 = message from them, 1 = message from us
            // sender_id should match the prospect's provider_id
            const isReply = msg.is_sender === 0 && msg.sender_id === prospectProviderId;
            if (msg.is_sender === 0) {
              console.log(`      Found msg from them: sender_id=${msg.sender_id?.slice(0, 20)}... expected=${prospectProviderId?.slice(0, 20)}...`);
            }
            return isReply;
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
            const wsId = (prospect.campaigns as any)?.workspace_id;
            console.log(`🤖 Triggering SAM Reply Agent for ${prospect.first_name} (workspace: ${wsId})...`);
            if (!wsId) {
              console.log(`   ⚠️ No workspace_id found for ${prospect.first_name}! campaigns: ${JSON.stringify(prospect.campaigns)}`);
            }
            await triggerReplyAgent(
              supabase,
              prospect,
              prospectReply,
              wsId
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
        prospect_company: prospect.company_name || prospect.company,
        prospect_title: prospect.title,
        draft_text: '[Pending AI generation]', // Required field - will be replaced by reply-agent-process cron
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
