import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';

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
    // Get the LinkedIn account for this campaign
    // Try campaign_linkedin_accounts first (legacy), then campaigns.linkedin_account_id
    let unipileAccountId: string | null = null;

    const { data: linkedinAccount } = await supabase
      .from('campaign_linkedin_accounts')
      .select('unipile_account_id')
      .eq('campaign_id', draft.campaign_id)
      .single();

    if (linkedinAccount?.unipile_account_id) {
      unipileAccountId = linkedinAccount.unipile_account_id;
    } else {
      // Fallback: Get from campaigns.linkedin_account_id -> workspace_accounts
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('linkedin_account_id')
        .eq('id', draft.campaign_id)
        .single();

      if (campaign?.linkedin_account_id) {
        const { data: workspaceAccount } = await supabase
          .from('workspace_accounts')
          .select('unipile_account_id')
          .eq('id', campaign.linkedin_account_id)
          .single();

        unipileAccountId = workspaceAccount?.unipile_account_id;
      }
    }

    if (!unipileAccountId) {
      return { success: false, error: 'No LinkedIn account found' };
    }

    const recipientId = draft.campaign_prospects?.linkedin_user_id;
    if (!recipientId) {
      return { success: false, error: 'No recipient LinkedIn ID' };
    }

    // Send via Unipile
    const response = await fetch(`https://${UNIPILE_DSN}/api/v1/messages`, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        account_id: unipileAccountId,
        attendee_id: recipientId,
        text: draft.edited_text || draft.draft_text
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Unipile error: ${errorText}` };
    }

    const result = await response.json();
    return { success: true, messageId: result.id };

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
