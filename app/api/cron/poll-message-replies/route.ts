import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { airtableService } from '@/lib/airtable';
import { classifyIntent } from '@/lib/services/intent-classifier';
import { syncInterestedLeadToCRM } from '@/lib/services/crm-sync';

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
        email,
        linkedin_user_id,
        linkedin_url,
        company_name,
        title,
        industry,
        location,
        company_size,
        personalization_data,
        status,
        responded_at,
        last_processed_message_id,
        campaign_id,
        campaigns:campaign_id (
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
        email,
        linkedin_user_id,
        linkedin_url,
        company_name,
        title,
        industry,
        location,
        company_size,
        personalization_data,
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
          // FIX (Dec 20): Use prefix matching - Unipile sometimes returns truncated IDs
          const prospectChat = chats.find((chat: any) => {
            const attendeeId = chat.attendee_provider_id || '';
            // Match if either ID starts with the other (handles truncation either way)
            return attendeeId.startsWith(prospectProviderId.slice(0, 20)) ||
              prospectProviderId.startsWith(attendeeId.slice(0, 20));
          });

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
          // FIX (Dec 20): Use prefix matching for sender_id - Unipile truncates IDs
          const inboundMessages = messages.filter((msg: any) => {
            if (msg.is_sender !== 0) return false;
            const senderId = msg.sender_id || '';
            // Match if either ID starts with the other (handles truncation)
            return senderId.startsWith(prospectProviderId.slice(0, 20)) ||
              prospectProviderId.startsWith(senderId.slice(0, 20));
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
              industry: prospect.industry,
              country: prospect.location,
              companySize: prospect.company_size || (prospect.personalization_data as any)?.company_size,
              intent: intent.intent,
              replyText: messageText,
            });

            if (airtableResult.success) {
              console.log(`   ✅ Airtable sync successful - Record ID: ${airtableResult.recordId}`);
            } else {
              console.log(`   ⚠️ Airtable sync failed: ${airtableResult.error}`);
            }

            // ============================================
            // CRM SYNC (Dec 20, 2025): Sync to ActiveCampaign/other CRMs
            // ============================================
            const positiveIntents = ['interested', 'curious', 'question', 'vague_positive'];
            if (positiveIntents.includes(intent.intent)) {
              console.log(`   📊 Positive intent detected - syncing to CRM...`);
              const workspaceId = (prospect.campaigns as any)?.workspace_id;
              if (workspaceId) {
                await syncInterestedLeadToCRM(workspaceId, {
                  prospectId: prospect.id,
                  firstName: prospect.first_name,
                  lastName: prospect.last_name,
                  email: prospect.email,
                  company: prospect.company_name,
                  jobTitle: prospect.title,
                  linkedInUrl: prospect.linkedin_url,
                  replyText: messageText,
                  intent: intent.intent,
                  intentConfidence: intent.confidence,
                  campaignId: prospect.campaign_id,
                });

                // ============================================
                // ACTIVECAMPAIGN LIST SYNC (Dec 20, 2025)
                // ============================================
                if (prospect.email) {
                  const { activeCampaignService } = await import('@/lib/activecampaign');
                  // Find AC list ID from workspace config or use default 'sam-users'
                  const { data: acConfig } = await supabase
                    .from('workspace_crm_config')
                    .select('activecampaign_list_id')
                    .eq('workspace_id', workspaceId)
                    .single();

                  const listId = acConfig?.activecampaign_list_id || 'sam-users';

                  await activeCampaignService.addNewMemberToList(
                    prospect.email,
                    prospect.first_name || '',
                    prospect.last_name || '',
                    listId
                  );
                }
              }
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

    // ============================================
    // INBOUND-FIRST PASS (Dec 20, 2025)
    // Catch replies that weren't matched in the prospect-first pass
    // This handles cases where linkedin_user_id doesn't match Unipile's sender_id
    // ============================================
    console.log('\n🔍 Starting INBOUND-FIRST pass to catch missed replies...');

    const inboundResults = await processInboundMessagesFirst(supabase, accountCache);
    results.replies_found += inboundResults.replies_found;
    if (inboundResults.unmatched_count > 0) {
      console.log(`⚠️ ${inboundResults.unmatched_count} inbound messages could not be matched to any prospect`);
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
 * INBOUND-FIRST PASS (Dec 20, 2025)
 *
 * Instead of starting from prospects and finding their messages,
 * this approach starts from inbound messages and tries to match them to prospects.
 *
 * This catches replies from:
 * - Prospects whose linkedin_user_id doesn't match Unipile's sender_id
 * - Prospects whose ID was truncated differently
 * - Prospects who weren't in our initial query (status edge cases)
 */
async function processInboundMessagesFirst(
  supabase: any,
  accountCache: Record<string, string | null>
): Promise<{ replies_found: number; unmatched_count: number }> {
  const results = { replies_found: 0, unmatched_count: 0 };

  try {
    // Get all Unipile accounts we're monitoring
    const { data: accounts } = await supabase
      .from('user_unipile_accounts')
      .select('id, unipile_account_id, account_name, user_id')
      .eq('platform', 'LINKEDIN')
      .eq('connection_status', 'connected');

    if (!accounts || accounts.length === 0) {
      console.log('   ℹ️ No connected LinkedIn accounts to check');
      return results;
    }

    console.log(`   📊 Checking ${accounts.length} LinkedIn accounts for inbound messages...`);

    for (const account of accounts) {
      const unipileAccountId = account.unipile_account_id;
      if (!unipileAccountId) continue;

      try {
        // Fetch recent messages for this account
        const messagesResponse = await fetch(
          `${UNIPILE_BASE_URL}/api/v1/messages?account_id=${unipileAccountId}&limit=50`,
          {
            method: 'GET',
            headers: {
              'X-API-KEY': UNIPILE_API_KEY,
              'Accept': 'application/json'
            }
          }
        );

        if (!messagesResponse.ok) {
          console.log(`   ⚠️ Failed to fetch messages for ${account.account_name}`);
          continue;
        }

        const messagesData = await messagesResponse.json();
        const allMessages = messagesData.items || [];

        // Filter to INBOUND only (is_sender === 0 or is_sender === false)
        const inboundMessages = allMessages.filter((msg: any) =>
          msg.is_sender === 0 || msg.is_sender === false
        );

        if (inboundMessages.length === 0) continue;

        console.log(`\n   👤 ${account.account_name}: ${inboundMessages.length} inbound messages`);

        // Get campaigns for this account to know which prospects to check
        const { data: campaigns } = await supabase
          .from('campaigns')
          .select('id, name, workspace_id')
          .eq('linkedin_account_id', account.id);

        if (!campaigns || campaigns.length === 0) continue;

        const campaignIds = campaigns.map((c: any) => c.id);

        // Process each inbound message
        for (const msg of inboundMessages.slice(0, 20)) { // Limit to 20 most recent
          const senderId = msg.sender_id || '';
          const senderName = msg.sender_name || '';
          const messageText = msg.text || msg.body || '';
          const messageId = msg.id;

          // Skip if we already have a draft for this message
          const { data: existingDraft } = await supabase
            .from('reply_agent_drafts')
            .select('id')
            .eq('inbound_message_id', messageId)
            .maybeSingle();

          if (existingDraft) continue;

          // Try to match this sender to a prospect using multiple strategies
          let matchedProspect = null;

          // Strategy 1: Exact match on linkedin_user_id
          const { data: exactMatch } = await supabase
            .from('campaign_prospects')
            .select(`
              id, first_name, last_name, email, linkedin_user_id, linkedin_url,
              company_name, title, industry, location, company_size,
              personalization_data, status, responded_at, campaign_id,
              last_processed_message_id,
              campaigns:campaign_id (workspace_id)
            `)
            .eq('linkedin_user_id', senderId)
            .in('campaign_id', campaignIds)
            .maybeSingle();

          if (exactMatch) {
            matchedProspect = exactMatch;
            console.log(`      ✓ Exact match: ${senderName} → ${exactMatch.first_name} ${exactMatch.last_name}`);
          }

          // Strategy 2: Prefix match (handles truncation)
          if (!matchedProspect && senderId.length >= 15) {
            const senderPrefix = senderId.slice(0, 20);
            const { data: prefixMatches } = await supabase
              .from('campaign_prospects')
              .select(`
                id, first_name, last_name, email, linkedin_user_id, linkedin_url,
                company_name, title, industry, location, company_size,
                personalization_data, status, responded_at, campaign_id,
                last_processed_message_id,
                campaigns:campaign_id (workspace_id)
              `)
              .like('linkedin_user_id', `${senderPrefix}%`)
              .in('campaign_id', campaignIds)
              .limit(1);

            if (prefixMatches && prefixMatches.length > 0) {
              matchedProspect = prefixMatches[0];
              console.log(`      ✓ Prefix match: ${senderName} → ${matchedProspect.first_name} ${matchedProspect.last_name}`);
            }
          }

          // Strategy 3: Name match (fallback for completely different IDs)
          if (!matchedProspect && senderName) {
            const nameParts = senderName.toLowerCase().split(' ');
            if (nameParts.length >= 2) {
              const firstName = nameParts[0];
              const lastName = nameParts[nameParts.length - 1];

              const { data: nameMatches } = await supabase
                .from('campaign_prospects')
                .select(`
                  id, first_name, last_name, email, linkedin_user_id, linkedin_url,
                  company_name, title, industry, location, company_size,
                  personalization_data, status, responded_at, campaign_id,
                  last_processed_message_id,
                  campaigns:campaign_id (workspace_id)
                `)
                .ilike('first_name', firstName)
                .ilike('last_name', `%${lastName}%`)
                .in('campaign_id', campaignIds)
                .in('status', ['connected', 'connection_request_sent', 'messaging', 'follow_up_sent'])
                .limit(1);

              if (nameMatches && nameMatches.length > 0) {
                matchedProspect = nameMatches[0];
                console.log(`      ✓ Name match: ${senderName} → ${matchedProspect.first_name} ${matchedProspect.last_name}`);

                // Update the prospect's linkedin_user_id to prevent future mismatches
                await supabase
                  .from('campaign_prospects')
                  .update({
                    linkedin_user_id: senderId,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', matchedProspect.id);

                console.log(`      📝 Updated linkedin_user_id for ${matchedProspect.first_name}`);
              }
            }
          }

          if (!matchedProspect) {
            // Log unmatched message for debugging
            results.unmatched_count++;
            console.log(`      ❌ Unmatched: "${senderName}" - "${messageText.slice(0, 50)}..."`);
            continue;
          }

          // Check if we already processed this message for this prospect
          if (matchedProspect.last_processed_message_id === messageId) {
            continue;
          }

          // Check if prospect already has status 'replied' and this isn't a new message
          const messageDate = new Date(msg.created_at || msg.timestamp);
          const respondedDate = matchedProspect.responded_at ? new Date(matchedProspect.responded_at) : null;

          if (matchedProspect.status === 'replied' && respondedDate && messageDate <= respondedDate) {
            continue; // This message was already processed
          }

          // NEW REPLY FOUND!
          const isFirstReply = !matchedProspect.responded_at;
          console.log(`   ✅ Found ${isFirstReply ? 'FIRST' : 'FOLLOW-UP'} reply: ${matchedProspect.first_name} ${matchedProspect.last_name}`);
          results.replies_found++;

          // Sync to Airtable
          try {
            const messageText = msg.text || msg.body || '';
            const intent = await classifyIntent(messageText, {
              prospectName: `${matchedProspect.first_name} ${matchedProspect.last_name}`.trim(),
              prospectCompany: matchedProspect.company_name
            });

            const airtableResult = await airtableService.syncLinkedInLead({
              profileUrl: matchedProspect.linkedin_url,
              name: `${matchedProspect.first_name || ''} ${matchedProspect.last_name || ''}`.trim(),
              jobTitle: matchedProspect.title,
              companyName: matchedProspect.company_name,
              industry: matchedProspect.industry,
              country: matchedProspect.location,
              companySize: matchedProspect.company_size || (matchedProspect.personalization_data as any)?.company_size,
              intent: intent.intent,
              replyText: messageText,
            });

            if (airtableResult.success) {
              console.log(`      ✅ Airtable sync successful - Record ID: ${airtableResult.recordId}`);
            } else {
              console.log(`      ⚠️ Airtable sync failed: ${airtableResult.error}`);
            }

            // ============================================
            // CRM SYNC (Dec 20, 2025): Sync to ActiveCampaign/other CRMs
            // ============================================
            const positiveIntents = ['interested', 'curious', 'question', 'vague_positive'];
            if (positiveIntents.includes(intent.intent)) {
              console.log(`      📊 Positive intent detected - syncing to CRM...`);
              const workspaceId = (matchedProspect.campaigns as any)?.workspace_id;
              if (workspaceId) {
                await syncInterestedLeadToCRM(workspaceId, {
                  prospectId: matchedProspect.id,
                  firstName: matchedProspect.first_name,
                  lastName: matchedProspect.last_name,
                  email: matchedProspect.email,
                  company: matchedProspect.company_name,
                  jobTitle: matchedProspect.title,
                  linkedInUrl: matchedProspect.linkedin_url,
                  replyText: messageText,
                  intent: intent.intent,
                  intentConfidence: intent.confidence,
                  campaignId: matchedProspect.campaign_id,
                });

                // ============================================
                // ACTIVECAMPAIGN LIST SYNC (Dec 20, 2025)
                // ============================================
                if (matchedProspect.email) {
                  const { activeCampaignService } = await import('@/lib/activecampaign');
                  const { data: acConfig } = await supabase
                    .from('workspace_crm_config')
                    .select('activecampaign_list_id')
                    .eq('workspace_id', workspaceId)
                    .single();

                  const listId = acConfig?.activecampaign_list_id || 'sam-users';

                  await activeCampaignService.addNewMemberToList(
                    matchedProspect.email,
                    matchedProspect.first_name || '',
                    matchedProspect.last_name || '',
                    listId
                  );
                }
              }
            }
          } catch (airtableError) {
            console.error('      ❌ Airtable sync error:', airtableError);
          }

          // Update prospect
          if (isFirstReply) {
            await supabase
              .from('campaign_prospects')
              .update({
                status: 'replied',
                responded_at: msg.created_at || new Date().toISOString(),
                last_processed_message_id: messageId,
                follow_up_due_at: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', matchedProspect.id);

            // Cancel pending queue items
            await supabase
              .from('send_queue')
              .update({
                status: 'cancelled',
                error_message: 'Prospect replied - sequence stopped (inbound-first)',
                updated_at: new Date().toISOString()
              })
              .eq('prospect_id', matchedProspect.id)
              .eq('status', 'pending');

            await supabase
              .from('email_send_queue')
              .update({
                status: 'cancelled',
                error_message: 'Prospect replied - sequence stopped (inbound-first)',
                updated_at: new Date().toISOString()
              })
              .eq('prospect_id', matchedProspect.id)
              .eq('status', 'pending');

            // Cancel Follow-Up Agent drafts
            await supabase
              .from('follow_up_drafts')
              .update({
                status: 'archived',
                rejected_reason: 'Prospect replied - follow-up sequence stopped (inbound-first)',
                updated_at: new Date().toISOString()
              })
              .eq('prospect_id', matchedProspect.id)
              .in('status', ['pending_generation', 'pending_approval', 'approved']);

          } else {
            await supabase
              .from('campaign_prospects')
              .update({
                last_processed_message_id: messageId,
                updated_at: new Date().toISOString()
              })
              .eq('id', matchedProspect.id);
          }

          // Trigger Reply Agent
          const wsId = (matchedProspect.campaigns as any)?.workspace_id;
          if (wsId) {
            await triggerReplyAgent(supabase, matchedProspect, msg, wsId);
          }
        }
      } catch (accountError) {
        console.error(`   ❌ Error processing account ${account.account_name}:`, accountError);
      }

      // Rate limit between accounts
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch (error) {
    console.error('❌ Inbound-first pass error:', error);
  }

  return results;
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
