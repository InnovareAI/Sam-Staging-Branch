import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';
import { airtableService } from '@/lib/airtable';

export const dynamic = 'force-dynamic';

const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const action = searchParams.get('action');

  if (!token || !action) {
    return redirectWithMessage('error', 'Missing token or action');
  }

  const supabase = supabaseAdmin();

  // Find the draft by approval token
  const { data: draft, error } = await supabase
    .from('reply_agent_drafts')
    .select('*, campaign_prospects(linkedin_user_id), campaigns(id)')
    .eq('approval_token', token)
    .single();

  if (error || !draft) {
    return redirectWithMessage('error', 'Draft not found or already processed');
  }

  // Check if already processed
  if (draft.status !== 'pending_approval') {
    return redirectWithMessage('info', `This draft was already ${draft.status}`);
  }

  // Check if expired
  if (new Date(draft.expires_at) < new Date()) {
    await supabase
      .from('reply_agent_drafts')
      .update({ status: 'expired' })
      .eq('id', draft.id);
    return redirectWithMessage('error', 'This draft has expired');
  }

  if (action === 'approve') {
    // Send the message via Unipile
    const sendResult = await sendMessage(draft, supabase);

    if (sendResult.success) {
      await supabase
        .from('reply_agent_drafts')
        .update({
          status: 'sent',
          approved_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          outbound_message_id: sendResult.messageId
        })
        .eq('id', draft.id);

      // Store in linkedin_messages for unified message history
      await supabase
        .from('linkedin_messages')
        .insert({
          workspace_id: draft.workspace_id,
          campaign_id: draft.campaign_id,
          prospect_id: draft.prospect_id,
          direction: 'outgoing',
          message_type: 'reply',
          content: draft.edited_text || draft.draft_text,
          unipile_message_id: sendResult.messageId,
          recipient_name: draft.prospect_name,
          recipient_linkedin_id: draft.campaign_prospects?.linkedin_user_id,
          status: 'sent',
          sent_at: new Date().toISOString(),
          metadata: {
            source: 'reply_agent',
            draft_id: draft.id,
            inbound_message_id: draft.inbound_message_id
          }
        });

      // ============================================
      // COORDINATION: Reset Follow-Up Agent V2 timers (Dec 16, 2025)
      // After Reply Agent sends, schedule next follow-up check
      // and cancel any pending follow_up_drafts (we just sent a new message)
      // ============================================
      if (draft.prospect_id) {
        // 1. Cancel any pending Follow-Up Agent drafts
        const { data: cancelledDrafts } = await supabase
          .from('follow_up_drafts')
          .update({
            status: 'archived',
            rejected_reason: 'Reply Agent sent new message - resetting follow-up sequence',
            updated_at: new Date().toISOString()
          })
          .eq('prospect_id', draft.prospect_id)
          .in('status', ['pending_generation', 'pending_approval', 'approved'])
          .select('id');

        if (cancelledDrafts?.length) {
          console.log(`🛑 Cancelled ${cancelledDrafts.length} Follow-Up Agent draft(s) for prospect`);
        }

        // 2. Schedule next follow-up check (3 days from now if no reply)
        const nextFollowUpDate = new Date();
        nextFollowUpDate.setDate(nextFollowUpDate.getDate() + 3);

        await supabase
          .from('campaign_prospects')
          .update({
            follow_up_due_at: nextFollowUpDate.toISOString(),
            last_follow_up_at: new Date().toISOString(),
            // Don't increment follow_up_sequence_index - Reply Agent is conversational, not sequence
            updated_at: new Date().toISOString()
          })
          .eq('id', draft.prospect_id);

        console.log(`⏰ Scheduled next Follow-Up Agent check for ${nextFollowUpDate.toISOString()}`);
      }

      // ============================================
      // AIRTABLE SYNC (Dec 20, 2025): Sync outbound reply to Airtable
      // Updates the prospect record with the latest outgoing message
      // ============================================
      try {
        console.log(`📊 Syncing outbound reply to Airtable: ${draft.prospect_name}`);

        const airtableResult = await airtableService.syncLinkedInLead({
          profileUrl: draft.prospect_linkedin_url,
          name: draft.prospect_name,
          jobTitle: draft.prospect_title,
          companyName: draft.prospect_company,
          // For outbound messages, we note it as a conversation update
          replyText: `[SAM Reply Sent] ${(draft.edited_text || draft.draft_text).substring(0, 200)}...`,
        });

        if (airtableResult.success) {
          console.log(`✅ Airtable outbound sync successful - Record ID: ${airtableResult.recordId}`);
        } else {
          console.log(`⚠️ Airtable outbound sync failed: ${airtableResult.error}`);
        }
      } catch (airtableError) {
        console.error('❌ Airtable outbound sync error:', airtableError);
      }

      return redirectWithMessage('success', `Reply sent to ${draft.prospect_name}!`);
    } else {
      await supabase
        .from('reply_agent_drafts')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          send_error: sendResult.error
        })
        .eq('id', draft.id);

      return redirectWithMessage('error', `Approved but send failed: ${sendResult.error}`);
    }

  } else if (action === 'reject') {
    await supabase
      .from('reply_agent_drafts')
      .update({
        status: 'rejected',
        rejection_reason: 'Rejected via email link'
      })
      .eq('id', draft.id);

    return redirectWithMessage('success', 'Draft rejected');

  } else {
    return redirectWithMessage('error', 'Invalid action');
  }
}

async function sendMessage(draft: any, supabase: any): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!UNIPILE_API_KEY) {
    return { success: false, error: 'Unipile not configured' };
  }

  try {
    const channel = draft.channel || 'linkedin';  // Default to LinkedIn
    const messageText = draft.edited_text || draft.draft_text;

    if (channel === 'email') {
      // ========== EMAIL CHANNEL ==========
      // Get workspace email account
      // FIX (Dec 20): Check both workspace_accounts and user_unipile_accounts
      let emailAccountId: string | null = null;
      let emailAccountName: string | null = null;

      // Try workspace_accounts first
      const { data: wsEmailAccount } = await supabase
        .from('workspace_accounts')
        .select('unipile_account_id, account_name')
        .eq('workspace_id', draft.workspace_id)
        .eq('account_type', 'email')
        .in('connection_status', VALID_CONNECTION_STATUSES)
        .limit(1)
        .single();

      if (wsEmailAccount?.unipile_account_id) {
        emailAccountId = wsEmailAccount.unipile_account_id;
        emailAccountName = wsEmailAccount.account_name;
      } else {
        // FIX (Dec 20): Fallback to user_unipile_accounts
        // NOTE: column is 'platform' not 'provider'
        const { data: userEmailAccount } = await supabase
          .from('user_unipile_accounts')
          .select('unipile_account_id, account_name')
          .eq('workspace_id', draft.workspace_id)
          .in('platform', ['MAIL', 'GOOGLE', 'OUTLOOK', 'MICROSOFT'])
          .in('connection_status', ['connected', 'active'])
          .limit(1)
          .single();

        if (userEmailAccount?.unipile_account_id) {
          emailAccountId = userEmailAccount.unipile_account_id;
          emailAccountName = userEmailAccount.account_name;
          console.log(`   ✅ Found email account in user_unipile_accounts: ${emailAccountName}`);
        }
      }

      if (!emailAccountId) {
        return { success: false, error: 'No email account connected. Connect Gmail or Outlook in Settings.' };
      }

      // Get prospect email
      const { data: prospect } = await supabase
        .from('campaign_prospects')
        .select('email, first_name, last_name')
        .eq('id', draft.prospect_id)
        .single();

      if (!prospect?.email) {
        return { success: false, error: 'Prospect has no email address' };
      }

      // Send email via Unipile - POST /api/v1/emails with account_id in body
      // FIX (Dec 20): 'to' must be an array of { identifier: email, display_name?: name }
      const recipientName = `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim();
      const response = await fetch(`https://${UNIPILE_DSN}/api/v1/emails`, {
        method: 'POST',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          account_id: emailAccountId,
          to: [{
            identifier: prospect.email,
            ...(recipientName && { display_name: recipientName })
          }],
          subject: draft.email_subject || draft.subject || `Re: ${draft.inbound_subject || 'Following up'}`,
          body: messageText,
          // Thread with original message if available
          ...(draft.inbound_thread_id && { thread_id: draft.inbound_thread_id })
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Email send error: ${errorText}` };
      }

      const result = await response.json();
      console.log(`✅ Email reply sent to ${prospect.email} via ${emailAccountName}`);
      return { success: true, messageId: result.message_id || result.id };

    } else {
      // ========== LINKEDIN CHANNEL ==========
      // For Reply Agent, we have the inbound_message_id - use it to find the chat
      // This is more reliable than trying to match by linkedin_user_id (which may be a URL)

      if (!draft.inbound_message_id) {
        return { success: false, error: 'No inbound message ID - cannot find conversation' };
      }

      // Step 1: Get the inbound message to find the chat_id
      const messageResponse = await fetch(`https://${UNIPILE_DSN}/api/v1/messages/${draft.inbound_message_id}`, {
        method: 'GET',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Accept': 'application/json'
        }
      });

      if (!messageResponse.ok) {
        const errorText = await messageResponse.text();
        return { success: false, error: `Failed to fetch inbound message: ${errorText}` };
      }

      const messageData = await messageResponse.json();
      const chatId = messageData.chat_id;

      if (!chatId) {
        return { success: false, error: 'Inbound message has no chat_id' };
      }

      // Step 2: Send reply to that chat
      const response = await fetch(`https://${UNIPILE_DSN}/api/v1/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          text: messageText
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Unipile send error: ${errorText}` };
      }

      const result = await response.json();
      return { success: true, messageId: result.message_id || result.id };
    }

  } catch (error) {
    return { success: false, error: String(error) };
  }
}

function redirectWithMessage(type: 'success' | 'error' | 'info', message: string) {
  const encodedMessage = encodeURIComponent(message);
  return NextResponse.redirect(`${APP_URL}/reply-agent-result?type=${type}&message=${encodedMessage}`);
}

// POST endpoint for manual approvals from the UI
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Support both token-based (from edit pages) and draft_id-based (from UI) auth
    const { draft_id, token, action, edited_text, editedText } = body;
    const textToUse = editedText || edited_text;

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 });
    }

    if (!draft_id && !token) {
      return NextResponse.json({ error: 'Missing draft_id or token' }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    // Fetch draft by either draft_id or token
    let query = supabase
      .from('reply_agent_drafts')
      .select('*, campaign_prospects(linkedin_user_id)');

    if (token) {
      query = query.eq('approval_token', token);
    } else {
      query = query.eq('id', draft_id);
    }

    const { data: draft, error } = await query.single();

    if (error || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    if (draft.status !== 'pending_approval') {
      return NextResponse.json({ error: `Draft already ${draft.status}` }, { status: 400 });
    }

    const draftId = draft.id;

    if (action === 'approve') {
      // Update edited text if provided
      if (textToUse) {
        await supabase
          .from('reply_agent_drafts')
          .update({ edited_text: textToUse })
          .eq('id', draftId);
        draft.edited_text = textToUse;
      }

      const sendResult = await sendMessage(draft, supabase);

      if (sendResult.success) {
        await supabase
          .from('reply_agent_drafts')
          .update({
            status: 'sent',
            approved_at: new Date().toISOString(),
            sent_at: new Date().toISOString(),
            outbound_message_id: sendResult.messageId
          })
          .eq('id', draftId);

        // Store in linkedin_messages for unified message history
        await supabase
          .from('linkedin_messages')
          .insert({
            workspace_id: draft.workspace_id,
            campaign_id: draft.campaign_id,
            prospect_id: draft.prospect_id,
            direction: 'outgoing',
            message_type: 'reply',
            content: draft.edited_text || draft.draft_text,
            unipile_message_id: sendResult.messageId,
            recipient_name: draft.prospect_name,
            recipient_linkedin_id: draft.campaign_prospects?.linkedin_user_id,
            status: 'sent',
            sent_at: new Date().toISOString(),
            metadata: {
              source: 'reply_agent',
              draft_id: draft.id,
              inbound_message_id: draft.inbound_message_id
            }
          });

        // ============================================
        // COORDINATION: Reset Follow-Up Agent V2 timers (Dec 16, 2025)
        // After Reply Agent sends, schedule next follow-up check
        // and cancel any pending follow_up_drafts (we just sent a new message)
        // ============================================
        if (draft.prospect_id) {
          // 1. Cancel any pending Follow-Up Agent drafts
          const { data: cancelledDrafts } = await supabase
            .from('follow_up_drafts')
            .update({
              status: 'archived',
              rejected_reason: 'Reply Agent sent new message - resetting follow-up sequence',
              updated_at: new Date().toISOString()
            })
            .eq('prospect_id', draft.prospect_id)
            .in('status', ['pending_generation', 'pending_approval', 'approved'])
            .select('id');

          if (cancelledDrafts?.length) {
            console.log(`🛑 Cancelled ${cancelledDrafts.length} Follow-Up Agent draft(s) for prospect`);
          }

          // 2. Schedule next follow-up check (3 days from now if no reply)
          const nextFollowUpDate = new Date();
          nextFollowUpDate.setDate(nextFollowUpDate.getDate() + 3);

          await supabase
            .from('campaign_prospects')
            .update({
              follow_up_due_at: nextFollowUpDate.toISOString(),
              last_follow_up_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', draft.prospect_id);

          console.log(`⏰ Scheduled next Follow-Up Agent check for ${nextFollowUpDate.toISOString()}`);
        }

        // ============================================
        // AIRTABLE SYNC (Dec 20, 2025): Sync outbound reply to Airtable
        // Updates the prospect record with the latest outgoing message
        // ============================================
        try {
          console.log(`📊 Syncing outbound reply to Airtable: ${draft.prospect_name}`);

          const airtableResult = await airtableService.syncLinkedInLead({
            profileUrl: draft.prospect_linkedin_url,
            name: draft.prospect_name,
            jobTitle: draft.prospect_title,
            companyName: draft.prospect_company,
            // For outbound messages, we note it as a conversation update
            replyText: `[SAM Reply Sent] ${(draft.edited_text || draft.draft_text).substring(0, 200)}...`,
          });

          if (airtableResult.success) {
            console.log(`✅ Airtable outbound sync successful - Record ID: ${airtableResult.recordId}`);
          } else {
            console.log(`⚠️ Airtable outbound sync failed: ${airtableResult.error}`);
          }
        } catch (airtableError) {
          console.error('❌ Airtable outbound sync error:', airtableError);
        }

        return NextResponse.json({ success: true, status: 'sent' });
      } else {
        await supabase
          .from('reply_agent_drafts')
          .update({
            status: 'approved',
            approved_at: new Date().toISOString(),
            send_error: sendResult.error
          })
          .eq('id', draftId);

        return NextResponse.json({ success: false, error: sendResult.error });
      }

    } else if (action === 'reject') {
      await supabase
        .from('reply_agent_drafts')
        .update({
          status: 'rejected',
          rejection_reason: body.reason || 'Rejected via UI'
        })
        .eq('id', draftId);

      return NextResponse.json({ success: true, status: 'rejected' });

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Approve endpoint error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
