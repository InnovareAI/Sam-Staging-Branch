import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { airtableService } from '@/lib/airtable';
import { classifyIntent } from '@/lib/services/intent-classifier';

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
 * MULTI-TURN CONVERSATION SUPPORT (Dec 13, 2025):
 * - Also checks prospects with status='replied' for 2nd/3rd/etc messages
 * - Tracks last_processed_message_id to detect NEW messages only
 * - Creates new drafts for each new inbound message in the conversation
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

    // MULTI-TURN SUPPORT (Dec 13, 2025):
    // 1. First get prospects who haven't replied yet (first reply detection)
    // 2. Then get prospects who HAVE replied (second/third reply detection)

    // Query 1: Prospects awaiting first reply
    // FIX (Dec 20): Remove broken workspace_accounts join - look up unipile_account_id separately
    const { data: firstReplyProspects, error: firstError } = await supabase
      .from('campaign_prospects')
      .select(`
        id,
        first_name,
        last_name,
        linkedin_user_id,
        linkedin_url,
        company_name,
        title,
        status,
        responded_at,
        last_processed_message_id,
        campaign_id,
        campaigns (
          workspace_id,
          linkedin_account_id
        )
      `)
      // FIX (Dec 20): Include 'messaging' and 'follow_up_sent' - these are prospects we've messaged but haven't replied yet
      .in('status', ['connected', 'connection_request_sent', 'messaging', 'follow_up_sent'])
      .is('responded_at', null)
      .not('linkedin_user_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(50); // Increased limit for faster detection

    // Query 2: Prospects who already replied (check for follow-up messages)
    // Only check those updated in last 7 days to avoid checking stale conversations
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: repliedProspects, error: repliedError } = await supabase
      .from('campaign_prospects')
      .select(`
        id,
        first_name,
        last_name,
        linkedin_user_id,
        linkedin_url,
        company_name,
        title,
        status,
        responded_at,
        last_processed_message_id,
        campaign_id,
        campaigns (
          workspace_id,
          linkedin_account_id
        )
      `)
      .eq('status', 'replied')
      .not('linkedin_user_id', 'is', null)
      .gte('responded_at', sevenDaysAgo.toISOString())
      .order('responded_at', { ascending: false })
      .limit(50); // Increased limit for faster detection

    const prospectsError = firstError || repliedError;

    // Combine both lists
    const prospects = [
      ...(firstReplyProspects || []),
      ...(repliedProspects || [])
    ];

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
    // FIX (Dec 20): Look up unipile_account_id from workspace_accounts or user_unipile_accounts
    const byAccount: Record<string, typeof prospects> = {};
    const prospectLog: string[] = [];

    // Cache for account lookups to avoid repeated queries
    const accountCache: Record<string, string | null> = {};

    for (const prospect of prospects) {
      const campaign = prospect.campaigns as any;
      const linkedinAccountId = campaign?.linkedin_account_id;
      let accountId: string | undefined;

      if (linkedinAccountId) {
        // Check cache first
        if (linkedinAccountId in accountCache) {
          accountId = accountCache[linkedinAccountId] || undefined;
        } else {
          // Try workspace_accounts first (primary)
          const { data: wsAccount } = await supabase
            .from('workspace_accounts')
            .select('unipile_account_id')
            .eq('id', linkedinAccountId)
            .single();

          if (wsAccount?.unipile_account_id) {
            accountCache[linkedinAccountId] = wsAccount.unipile_account_id;
            accountId = wsAccount.unipile_account_id;
          } else {
            // Fallback to user_unipile_accounts
            const { data: unipileAccount } = await supabase
              .from('user_unipile_accounts')
              .select('unipile_account_id')
              .eq('id', linkedinAccountId)
              .single();

            accountCache[linkedinAccountId] = unipileAccount?.unipile_account_id || null;
            accountId = unipileAccount?.unipile_account_id;
          }

          if (accountId) {
            console.log(`   ✅ Found Unipile account for ${prospect.first_name}: ${accountId.slice(0, 10)}...`);
          }
        }
      }

      prospectLog.push(`${prospect.first_name}: ${accountId ? accountId.slice(0, 8) : 'NO_ACCOUNT'}`);
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

          // MULTI-TURN SUPPORT (Dec 13, 2025):
          // Find ALL inbound messages from prospect, then check if any are NEW
          // (i.e., newer than last_processed_message_id)
          console.log(`   📨 Checking ${messages.length} messages for reply from ${prospect.first_name}...`);

          // Get all inbound messages from this prospect
          const inboundMessages = messages.filter((msg: any) => {
            return msg.is_sender === 0 && msg.sender_id === prospectProviderId;
          });

          if (inboundMessages.length === 0) {
            continue; // No inbound messages from this prospect
          }

          // Sort by created_at descending (most recent first)
          inboundMessages.sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );

          const latestInbound = inboundMessages[0];
          const lastProcessedId = (prospect as any).last_processed_message_id;

          // Check if this is a NEW message we haven't processed
          if (lastProcessedId && latestInbound.id === lastProcessedId) {
            console.log(`   ℹ️ ${prospect.first_name}: No new messages since last check`);
            continue; // Already processed this message
          }

          // Check if we already have a draft for this specific message
          const { data: existingDraftForMessage } = await supabase
            .from('reply_agent_drafts')
            .select('id')
            .eq('inbound_message_id', latestInbound.id)
            .single();

          if (existingDraftForMessage) {
            console.log(`   ℹ️ ${prospect.first_name}: Draft already exists for message ${latestInbound.id.slice(0, 15)}...`);
            continue;
          }

          // NEW MESSAGE DETECTED!
          const isFirstReply = !prospect.responded_at;
          console.log(`✅ Found ${isFirstReply ? 'FIRST' : 'FOLLOW-UP'} reply from ${prospect.first_name} ${prospect.last_name}`);
          results.replies_found++;

          // ============================================
          // AIRTABLE SYNC (Dec 20, 2025): Sync inbound reply to Airtable
          // ============================================
          try {
            const messageText = latestInbound.text || latestInbound.body || '';
            console.log(`   📊 Classifying intent for Airtable sync...`);

            // Classify intent for Airtable status
            const intent = await classifyIntent(messageText, {
              prospectName: `${prospect.first_name} ${prospect.last_name}`.trim(),
              prospectCompany: prospect.company_name
            });

            console.log(`   📊 Syncing inbound reply to Airtable: ${prospect.first_name} (${intent.intent})`);

            const airtableResult = await airtableService.syncLinkedInLead({
              profileUrl: prospect.linkedin_url,
              name: `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim(),
              jobTitle: prospect.title,
              companyName: prospect.company_name,
              intent: intent.intent,
              replyText: messageText,
            });

            if (airtableResult.success) {
              console.log(`   ✅ Airtable sync successful - Record ID: ${airtableResult.recordId}`);
            } else {
              console.log(`   ⚠️ Airtable sync failed: ${airtableResult.error}`);
            }
          } catch (airtableError) {
            console.error('   ❌ Airtable sync error:', airtableError);
          }

          if (isFirstReply) {
            // First reply - update prospect status and stop follow-ups
            await supabase
              .from('campaign_prospects')
              .update({
                status: 'replied',
                responded_at: latestInbound.created_at || new Date().toISOString(),
                last_processed_message_id: latestInbound.id,
                follow_up_due_at: null, // CRITICAL: Stop follow-ups
                updated_at: new Date().toISOString()
              })
              .eq('id', prospect.id);

            // Cancel pending queue items (messaging sequence)
            await supabase
              .from('send_queue')
              .update({
                status: 'cancelled',
                error_message: 'Prospect replied - sequence stopped',
                updated_at: new Date().toISOString()
              })
              .eq('prospect_id', prospect.id)
              .eq('status', 'pending');

            await supabase
              .from('email_send_queue')
              .update({
                status: 'cancelled',
                error_message: 'Prospect replied - sequence stopped (polling)',
                updated_at: new Date().toISOString()
              })
              .eq('prospect_id', prospect.id)
              .eq('status', 'pending');

            // ============================================
            // COORDINATION: Cancel Follow-Up Agent V2 drafts (Dec 16, 2025)
            // When prospect replies, cancel any pending AI follow-up drafts
            // ============================================
            const { data: cancelledFollowUps } = await supabase
              .from('follow_up_drafts')
              .update({
                status: 'archived',
                rejected_reason: 'Prospect replied - follow-up sequence stopped',
                updated_at: new Date().toISOString()
              })
              .eq('prospect_id', prospect.id)
              .in('status', ['pending_generation', 'pending_approval', 'approved'])
              .select('id');

            if (cancelledFollowUps?.length) {
              console.log(`   🛑 Cancelled ${cancelledFollowUps.length} Follow-Up Agent draft(s)`);
            }
          } else {
            // Follow-up reply - just update last_processed_message_id
            await supabase
              .from('campaign_prospects')
              .update({
                last_processed_message_id: latestInbound.id,
                updated_at: new Date().toISOString()
              })
              .eq('id', prospect.id);
          }

          // TRIGGER SAM REPLY AGENT - Create draft for approval
          const wsId = (prospect.campaigns as any)?.workspace_id;
          console.log(`🤖 Triggering SAM Reply Agent for ${prospect.first_name} (workspace: ${wsId})...`);
          if (!wsId) {
            console.log(`   ⚠️ No workspace_id found for ${prospect.first_name}! campaigns: ${JSON.stringify(prospect.campaigns)}`);
          }
          await triggerReplyAgent(
            supabase,
            prospect,
            latestInbound,
            wsId
          );
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
