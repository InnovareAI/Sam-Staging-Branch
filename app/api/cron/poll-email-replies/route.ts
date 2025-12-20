import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { airtableService } from '@/lib/airtable';
import { classifyIntent } from '@/lib/services/intent-classifier';
import { syncInterestedLeadToCRM } from '@/lib/services/crm-sync';
import { sendEmailReplyNotification } from '@/lib/notifications/google-chat';
import crypto from 'crypto';

/**
 * Cron Job: Poll Email Replies (Backup for Webhook)
 *
 * Runs every 15 minutes to detect if prospects have replied to emails
 * This is a BACKUP for any email webhooks and ensures we catch all replies
 *
 * Why needed:
 * - Email webhooks can fail or be delayed
 * - Without this, prospects get follow-ups after they've replied
 * - ReachInbox/Mass-emailing platforms can have delayed sync
 *
 * POST /api/cron/poll-email-replies
 * Header: x-cron-secret (for security)
 */

export const maxDuration = 300; // 5 minutes max

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

    console.log('📧 Poll email replies starting (Inbound-First)...');

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all active email accounts via Unipile
    const { data: emailAccounts, error: accountsError } = await supabase
      .from('user_unipile_accounts')
      .select('id, workspace_id, account_name, unipile_account_id, platform')
      .in('platform', ['GOOGLE', 'OUTLOOK', 'EMAIL'])
      .eq('connection_status', 'active');

    if (accountsError || !emailAccounts) {
      console.error('❌ Error fetching email accounts:', accountsError);
      return NextResponse.json({ success: false, error: 'Failed to fetch email accounts' }, { status: 500 });
    }

    console.log(`📧 Checking ${emailAccounts.length} email accounts for replies...`);

    const results = {
      checked: 0,
      replies_found: 0,
      errors: [] as string[],
      accounts_processed: [] as string[]
    };

    for (const account of emailAccounts) {
      try {
        console.log(`\n🔍 Checking account: ${account.account_name}`);
        results.accounts_processed.push(account.account_name);

        // 1. Fetch recent emails from INBOX
        const emailsResponse = await fetch(
          `${UNIPILE_BASE_URL}/api/v1/emails?account_id=${account.unipile_account_id}&folder=INBOX&limit=50`,
          {
            method: 'GET',
            headers: { 'X-API-KEY': UNIPILE_API_KEY, 'Accept': 'application/json' }
          }
        );

        if (!emailsResponse.ok) {
          console.error(`   ❌ Failed to fetch emails for ${account.account_name}`);
          results.errors.push(`Failed to fetch for ${account.account_name}`);
          continue;
        }

        const emailsData = await emailsResponse.json();
        const emails = emailsData.items || [];
        if (emails.length === 0) {
          console.log(`   ℹ️ No recent emails in inbox`);
          continue;
        }

        // 2. Match senders against campaign_prospects
        const uniqueSenders = [...new Set(emails.map((e: any) =>
          (e.from_attendee?.identifier || e.from || '').toLowerCase()
        ).filter(Boolean))];

        const { data: matchedProspects, error: pError } = await supabase
          .from('campaign_prospects')
          .select(`
            id, first_name, last_name, email, company_name, title, status, responded_at, campaign_id,
            location, industry, company_size, personalization_data,
            campaigns!inner (workspace_id, name)
          `)
          .in('email', uniqueSenders)
          .is('responded_at', null)
          .eq('campaigns.workspace_id', account.workspace_id);

        if (pError || !matchedProspects || matchedProspects.length === 0) {
          console.log(`   ℹ️ No matching prospects in this batch of ${emails.length} emails`);
          continue;
        }

        console.log(`   📋 Found ${matchedProspects.length} matching prospects who replied!`);

        // 3. Process each reply
        for (const prospect of matchedProspects) {
          results.checked++;
          results.replies_found++;

          const prospectEmail = (prospect.email || '').toLowerCase();
          const replyEmail = emails.find((e: any) => {
            const from = (e.from_attendee?.identifier || e.from || '').toLowerCase();
            return from === prospectEmail || from.includes(prospectEmail);
          });

          if (replyEmail) {
            console.log(`   ✅ Processing: ${prospect.first_name} ${prospect.last_name} (${prospectEmail})`);

            // Update Supabase
            await supabase
              .from('campaign_prospects')
              .update({
                status: 'replied',
                responded_at: replyEmail.date || new Date().toISOString(),
                follow_up_due_at: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', prospect.id);

            // Stop sequences
            await supabase.from('send_queue').update({ status: 'cancelled' }).eq('prospect_id', prospect.id).eq('status', 'pending');
            await supabase.from('email_send_queue').update({ status: 'cancelled' }).eq('prospect_id', prospect.id).eq('status', 'pending');

            const messageText = replyEmail.body_plain || replyEmail.body || replyEmail.subject || '';
            const intent = await classifyIntent(messageText, {
              prospectName: `${prospect.first_name} ${prospect.last_name}`.trim(),
              prospectCompany: prospect.company_name
            });

            // Airtable Sync
            await airtableService.syncEmailLead({
              email: prospect.email,
              name: `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim(),
              campaignName: (prospect.campaigns as any)?.name,
              replyText: messageText,
              intent: intent.intent,
              country: prospect.location,
              industry: prospect.industry,
              companySize: prospect.company_size || (prospect.personalization_data as any)?.company_size,
            });

            // CRM Sync
            const positiveIntents = ['interested', 'curious', 'question', 'vague_positive'];
            if (positiveIntents.includes(intent.intent)) {
              await syncInterestedLeadToCRM(account.workspace_id, {
                prospectId: prospect.id,
                firstName: prospect.first_name,
                lastName: prospect.last_name,
                email: prospect.email,
                company: prospect.company_name,
                jobTitle: prospect.title,
                replyText: messageText,
                intent: intent.intent,
                intentConfidence: intent.confidence,
                campaignId: prospect.campaign_id,
              });

              const { data: acConfig } = await supabase.from('workspace_crm_config').select('activecampaign_list_id').eq('workspace_id', account.workspace_id).single();
              const { activeCampaignService } = await import('@/lib/activecampaign');
              await activeCampaignService.addNewMemberToList(prospect.email, prospect.first_name || '', prospect.last_name || '', acConfig?.activecampaign_list_id || 'sam-users');
            }

            // Notifications
            await sendEmailReplyNotification({
              prospectEmail: prospect.email,
              prospectName: `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim(),
              campaignName: (prospect.campaigns as any)?.name,
              messageText: messageText,
              intent: intent.intent,
              country: prospect.location,
              emailAccount: account.account_name
            });

            // Reply Agent
            await triggerReplyAgent(supabase, prospect, replyEmail, account.workspace_id, 'email');
          }
        }
      } catch (err) {
        console.error(`❌ Error in account ${account.account_name}:`, err);
        results.errors.push(`${account.account_name}: ${err}`);
      }
    }

    const duration = Date.now() - startTime;
    return NextResponse.json({ success: true, ...results, execution_time_ms: duration });

  } catch (error) {
    console.error('❌ Cron failed:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

async function triggerReplyAgent(supabase: any, prospect: any, inboundEmail: any, workspaceId: string, channel: string) {
  try {
    const { data: config } = await supabase.from('workspace_reply_agent_config').select('*').eq('workspace_id', workspaceId).eq('enabled', true).single();
    if (!config) return;

    const messageId = inboundEmail.id || inboundEmail.message_id || `email-${Date.now()}`;
    const { data: existing } = await supabase.from('reply_agent_drafts').select('id').eq('inbound_message_id', messageId).maybeSingle();
    if (existing) return;

    const emailBody = inboundEmail.body_plain || inboundEmail.body?.replace(/<[^>]*>/g, '') || inboundEmail.text || '[No content]';

    await supabase.from('reply_agent_drafts').insert({
      workspace_id: workspaceId,
      campaign_id: prospect.campaign_id,
      prospect_id: prospect.id,
      inbound_message_id: messageId,
      inbound_message_text: emailBody,
      inbound_message_at: inboundEmail.date || new Date().toISOString(),
      channel,
      prospect_name: `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim(),
      prospect_email: prospect.email,
      prospect_company: prospect.company_name || prospect.company,
      prospect_title: prospect.title,
      email_subject: inboundEmail.subject,
      draft_text: '[Pending AI generation]',
      approval_token: crypto.randomUUID(),
      expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      status: 'pending_generation',
    });
  } catch (error) {
    console.error(`   ❌ Reply Agent trigger failed:`, error);
  }
}
