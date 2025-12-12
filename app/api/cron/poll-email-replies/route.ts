import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Cron Job: Poll Email Replies (Backup for Webhook)
 *
 * Runs every 15 minutes to detect if prospects have replied to emails
 * This is a BACKUP for any email webhooks and ensures we catch all replies
 *
 * Why needed:
 * - Email webhooks can fail or be delayed
 * - Without this, prospects get follow-ups after they've replied
 * - LinkedIn has polling backup, email needs one too
 *
 * POST /api/cron/poll-email-replies
 * Header: x-cron-secret (for security)
 */

export const maxDuration = 300; // 5 minutes max - need time for email fetching

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

    console.log('📧 Poll email replies starting...');

    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all workspaces with email accounts that have email campaigns
    const { data: emailAccounts, error: accountsError } = await supabase
      .from('workspace_accounts')
      .select(`
        id,
        workspace_id,
        account_name,
        unipile_account_id,
        account_type
      `)
      .eq('account_type', 'email')
      .eq('connection_status', 'connected')
      .eq('is_active', true);

    if (accountsError) {
      console.error('❌ Error fetching email accounts:', accountsError);
      return NextResponse.json({ success: false, error: 'Failed to fetch email accounts' }, { status: 500 });
    }

    if (!emailAccounts || emailAccounts.length === 0) {
      console.log('ℹ️  No email accounts to check');
      return NextResponse.json({
        success: true,
        message: 'No email accounts configured',
        checked: 0,
        replies_found: 0
      });
    }

    console.log(`📧 Checking ${emailAccounts.length} email accounts for replies...`);

    const results = {
      checked: 0,
      replies_found: 0,
      errors: [] as string[],
      accounts_processed: [] as string[]
    };

    // Process each email account
    for (const account of emailAccounts) {
      try {
        console.log(`\n🔍 Checking account: ${account.account_name} (${account.unipile_account_id})`);
        results.accounts_processed.push(account.account_name);

        // Get prospects for this workspace that might have replies
        // (email_sent status, no responded_at)
        const { data: prospects, error: prospectsError } = await supabase
          .from('campaign_prospects')
          .select(`
            id,
            first_name,
            last_name,
            email,
            company_name,
            title,
            status,
            responded_at,
            campaign_id,
            campaigns (
              workspace_id,
              email_account_id
            )
          `)
          .eq('campaigns.workspace_id', account.workspace_id)
          .eq('campaigns.email_account_id', account.unipile_account_id)
          .in('status', ['email_sent', 'follow_up_sent'])
          .is('responded_at', null)
          .not('email', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(30);

        if (prospectsError || !prospects || prospects.length === 0) {
          console.log(`   ℹ️ No prospects to check for ${account.account_name}`);
          continue;
        }

        console.log(`   📋 Checking ${prospects.length} prospects for replies...`);

        // Fetch recent emails for this account (inbox - received emails)
        const emailsResponse = await fetch(
          `${UNIPILE_BASE_URL}/api/v1/emails?account_id=${account.unipile_account_id}&folder=INBOX&limit=50`,
          {
            method: 'GET',
            headers: {
              'X-API-KEY': UNIPILE_API_KEY,
              'Accept': 'application/json'
            }
          }
        );

        if (!emailsResponse.ok) {
          console.error(`   ❌ Failed to fetch emails for ${account.account_name}`);
          results.errors.push(`Failed to fetch emails for ${account.account_name}`);
          continue;
        }

        const emailsData = await emailsResponse.json();
        const emails = emailsData.items || [];

        console.log(`   📨 Found ${emails.length} emails in inbox`);

        // Check each prospect for replies
        for (const prospect of prospects) {
          results.checked++;

          if (!prospect.email) continue;

          // Look for emails from this prospect
          const prospectEmail = prospect.email.toLowerCase();
          const replyEmail = emails.find((email: any) => {
            const from = email.from_attendee?.identifier?.toLowerCase() ||
                        email.from?.toLowerCase() || '';
            return from === prospectEmail || from.includes(prospectEmail);
          });

          if (replyEmail) {
            console.log(`   ✅ Found reply from ${prospect.first_name} ${prospect.last_name} (${prospect.email})`);
            results.replies_found++;

            // Update prospect as replied - STOP all messaging
            await supabase
              .from('campaign_prospects')
              .update({
                status: 'replied',
                responded_at: replyEmail.date || new Date().toISOString(),
                follow_up_due_at: null, // CRITICAL: Stop follow-ups
                updated_at: new Date().toISOString()
              })
              .eq('id', prospect.id);

            // Cancel any pending send_queue items for this prospect
            await supabase
              .from('send_queue')
              .update({
                status: 'cancelled',
                error_message: 'Prospect replied via email - sequence stopped',
                updated_at: new Date().toISOString()
              })
              .eq('prospect_id', prospect.id)
              .eq('status', 'pending');

            // Cancel any pending email queue items
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
            const wsId = (prospect.campaigns as any)?.workspace_id || account.workspace_id;
            console.log(`   🤖 Triggering SAM Reply Agent for ${prospect.first_name}...`);

            await triggerReplyAgent(
              supabase,
              prospect,
              replyEmail,
              wsId,
              'email'
            );
          }
        }

        // Rate limit between accounts
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (accountError) {
        console.error(`❌ Error processing account ${account.account_name}:`, accountError);
        results.errors.push(`Account ${account.account_name}: ${accountError}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n⏱️  Poll completed in ${duration}ms`);
    console.log(`📊 Results: ${results.checked} checked, ${results.replies_found} replies found`);

    return NextResponse.json({
      success: true,
      message: `Checked ${results.checked} prospects, found ${results.replies_found} email replies`,
      ...results,
      execution_time_ms: duration
    });

  } catch (error) {
    console.error('❌ Poll email replies error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Trigger SAM Reply Agent when a prospect replies via email
 * Creates a draft for human approval via email/chat
 */
async function triggerReplyAgent(
  supabase: any,
  prospect: any,
  inboundEmail: any,
  workspaceId: string,
  channel: string
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

    // Get message ID (Unipile email ID)
    const messageId = inboundEmail.id || inboundEmail.message_id || `email-${Date.now()}`;

    // Check if we already have a draft for this message
    const { data: existingDraft } = await supabase
      .from('reply_agent_drafts')
      .select('id')
      .eq('inbound_message_id', messageId)
      .single();

    if (existingDraft) {
      console.log(`   ℹ️ Draft already exists for email ${messageId}`);
      return;
    }

    // Generate approval token
    const approvalToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48); // 48 hour expiry

    // Extract email body text
    const emailBody = inboundEmail.body_plain ||
                      inboundEmail.body?.replace(/<[^>]*>/g, '') ||
                      inboundEmail.text ||
                      '[Email body not available]';

    // Create draft record (Reply Agent cron will pick this up and generate AI reply)
    const { data: draft, error: draftError } = await supabase
      .from('reply_agent_drafts')
      .insert({
        workspace_id: workspaceId,
        campaign_id: prospect.campaign_id,
        prospect_id: prospect.id,
        inbound_message_id: messageId,
        inbound_message_text: emailBody,
        inbound_message_at: inboundEmail.date || new Date().toISOString(),
        channel: channel,
        prospect_name: `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim(),
        prospect_email: prospect.email,
        prospect_company: prospect.company_name || prospect.company,
        prospect_title: prospect.title,
        email_subject: inboundEmail.subject,
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
