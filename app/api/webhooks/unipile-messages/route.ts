/**
 * Unipile Webhook Handler for LinkedIn DM Replies
 * Receives inbound LinkedIn messages and triggers Reply Agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { classifyIntent } from '@/lib/services/intent-classifier';
import { generateReplyDraft, getDefaultSettings } from '@/lib/services/reply-draft-generator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

interface UnipileWebhookPayload {
  event: string;
  data: {
    id: string;
    account_id: string;
    provider: string;
    conversation_id?: string;
    sender?: {
      id: string;
      name: string;
      profile_url?: string;
    };
    recipient?: {
      id: string;
      name: string;
    };
    text?: string;
    html?: string;
    timestamp?: string;
    attachments?: any[];
  };
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature (if Unipile provides one)
    const signature = request.headers.get('x-unipile-signature');
    // TODO: Verify signature when Unipile provides webhook signing

    const payload: UnipileWebhookPayload = await request.json();

    console.log('📥 Unipile webhook received:', {
      event: payload.event,
      accountId: payload.data?.account_id,
      sender: payload.data?.sender?.name
    });

    // Only process incoming messages
    if (payload.event !== 'message.received' && payload.event !== 'message.new') {
      return NextResponse.json({ success: true, message: 'Event ignored' });
    }

    // Only process LinkedIn messages
    if (payload.data.provider !== 'LINKEDIN') {
      return NextResponse.json({ success: true, message: 'Non-LinkedIn message ignored' });
    }

    const supabase = getServiceClient();

    // Find the LinkedIn account in our system
    const { data: account } = await supabase
      .from('user_unipile_accounts')
      .select('workspace_id, user_id, account_email')
      .eq('unipile_account_id', payload.data.account_id)
      .single();

    if (!account) {
      console.error('❌ Unknown Unipile account:', payload.data.account_id);
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    const messageText = payload.data.text || '';
    const senderName = payload.data.sender?.name || 'Unknown';
    const senderProfileUrl = payload.data.sender?.profile_url;

    // Check if this is a reply to one of our campaigns
    // Match by sender profile URL to campaign_prospects
    const { data: prospect } = await supabase
      .from('campaign_prospects')
      .select(`
        id,
        first_name,
        last_name,
        title,
        company,
        linkedin_url,
        campaign_id,
        campaigns (
          id,
          campaign_name,
          workspace_id,
          message_templates
        )
      `)
      .eq('campaigns.workspace_id', account.workspace_id)
      .ilike('linkedin_url', `%${payload.data.sender?.id || 'nomatch'}%`)
      .single();

    // If we can't match by prospect ID, try matching by conversation
    let campaignId = prospect?.campaign_id;
    let prospectId = prospect?.id;
    let prospectName = prospect ? `${prospect.first_name} ${prospect.last_name}` : senderName;
    let prospectCompany = prospect?.company;
    let originalOutreach = '';

    if (prospect?.campaigns?.message_templates) {
      const templates = prospect.campaigns.message_templates as any;
      originalOutreach = templates.connection_request || templates.initial_message || '';
    }

    // Store the reply
    const { data: reply, error: replyError } = await supabase
      .from('campaign_replies')
      .insert({
        campaign_id: campaignId,
        prospect_id: prospectId,
        reply_text: messageText,
        reply_channel: 'linkedin',
        received_at: payload.data.timestamp || new Date().toISOString(),
        requires_review: true,
        priority: 'urgent',
        metadata: {
          unipile_message_id: payload.data.id,
          unipile_account_id: payload.data.account_id,
          unipile_conversation_id: payload.data.conversation_id,
          sender_id: payload.data.sender?.id,
          sender_name: senderName,
          sender_profile_url: senderProfileUrl
        }
      })
      .select()
      .single();

    if (replyError) {
      console.error('❌ Failed to store LinkedIn reply:', replyError);
      return NextResponse.json({ success: false, error: replyError.message }, { status: 500 });
    }

    console.log('✅ LinkedIn reply stored:', reply.id);

    // Get reply agent settings
    const { data: settings } = await supabase
      .from('reply_agent_settings')
      .select('*')
      .eq('workspace_id', account.workspace_id)
      .single();

    const agentSettings = settings || getDefaultSettings();

    // Check if reply agent is enabled
    if (!agentSettings.enabled) {
      console.log('⏸️ Reply agent disabled for workspace');
      // Still notify user but don't generate draft
      await notifyUserOfLinkedInReply(supabase, reply.id, account.workspace_id, {
        prospectName,
        prospectCompany,
        messageText,
        noDraft: true
      });
      return NextResponse.json({ success: true, message: 'Reply stored, agent disabled' });
    }

    // Classify intent
    console.log('🎯 Classifying intent...');
    const intent = await classifyIntent(messageText, {
      originalOutreach,
      prospectName,
      prospectCompany
    });

    // Update reply with intent
    await supabase
      .from('campaign_replies')
      .update({
        intent: intent.intent,
        intent_confidence: intent.confidence,
        intent_reasoning: intent.reasoning
      })
      .eq('id', reply.id);

    console.log(`✅ Intent classified: ${intent.intent} (${(intent.confidence * 100).toFixed(0)}%)`);

    // Generate draft
    console.log('📝 Generating draft...');
    const draftResult = await generateReplyDraft({
      workspaceId: account.workspace_id,
      prospectReply: messageText,
      prospect: {
        name: prospectName,
        role: prospect?.title,
        company: prospectCompany,
        industry: undefined,
        companySize: undefined,
        crmContext: undefined,
        linkedInUrl: prospect?.linkedin_url || senderProfileUrl
      },
      campaign: {
        name: prospect?.campaigns?.campaign_name || 'LinkedIn Campaign',
        channel: 'linkedin',
        goal: 'Book a call',
        originalOutreach
      },
      userName: 'SAM', // Will be replaced with actual user name
      settings: agentSettings
    });

    // Store draft
    await supabase
      .from('campaign_replies')
      .update({
        ai_suggested_response: draftResult.draft,
        original_draft: draftResult.draft,
        draft_generated_at: new Date().toISOString(),
        metadata: {
          ...reply.metadata,
          draft_model: draftResult.metadata.model,
          draft_tokens: draftResult.metadata.tokensUsed,
          draft_generation_ms: draftResult.metadata.generationTimeMs,
          cheese_filter_passed: draftResult.metadata.cheeseFilterPassed
        }
      })
      .eq('id', reply.id);

    console.log('✅ Draft generated and stored');

    // Notify user via Postmark
    await notifyUserOfLinkedInReply(supabase, reply.id, account.workspace_id, {
      prospectName,
      prospectCompany,
      messageText,
      intent: intent.intent,
      intentConfidence: intent.confidence,
      draft: draftResult.draft
    });

    return NextResponse.json({
      success: true,
      replyId: reply.id,
      intent: intent.intent,
      draftGenerated: true
    });

  } catch (error) {
    console.error('❌ Unipile webhook error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Notify user of LinkedIn reply via Postmark email
 */
async function notifyUserOfLinkedInReply(
  supabase: any,
  replyId: string,
  workspaceId: string,
  data: {
    prospectName: string;
    prospectCompany?: string;
    messageText: string;
    intent?: string;
    intentConfidence?: number;
    draft?: string;
    noDraft?: boolean;
  }
) {
  // Get workspace members
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role, users(email, first_name)')
    .eq('workspace_id', workspaceId)
    .in('role', ['owner', 'admin', 'member']);

  if (!members || members.length === 0) {
    console.error('No members found for workspace');
    return;
  }

  // Intent emoji mapping
  const intentEmoji: Record<string, string> = {
    interested: '🟢',
    curious: '🔵',
    objection: '🟠',
    timing: '⏰',
    wrong_person: '👤',
    not_interested: '🔴',
    question: '❓',
    vague_positive: '🟡'
  };

  const emoji = data.intent ? intentEmoji[data.intent] || '📩' : '📩';

  // Send via Postmark
  const { ServerClient } = require('postmark');
  const postmark = new ServerClient(process.env.POSTMARK_INNOVAREAI_API_KEY!);

  for (const member of members) {
    const user = member.users;

    await postmark.sendEmail({
      From: 'Sam <hello@sam.innovareai.com>',
      To: user.email,
      ReplyTo: `draft+${replyId}@sam.innovareai.com`,
      Subject: `${emoji} ${data.prospectName} replied on LinkedIn${data.intent ? ` - ${data.intent.replace('_', ' ')}` : ''}`,
      HtmlBody: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#0077B5;color:white;padding:20px;border-radius:8px 8px 0 0;">
            <h2 style="margin:0;">💼 LinkedIn Reply${data.intent ? ` - ${data.intent.replace('_', ' ').toUpperCase()}` : ''}</h2>
          </div>

          <div style="background:#f9f9f9;padding:20px;border:1px solid #e0e0e0;border-top:none;">
            <p style="font-size:16px;margin:0 0 10px 0;">Hi ${user.first_name},</p>

            <p style="font-size:14px;margin:10px 0;">
              <strong>${data.prospectName}</strong>
              ${data.prospectCompany ? `from <strong>${data.prospectCompany}</strong>` : ''}
              replied on LinkedIn:
            </p>

            <blockquote style="border-left:4px solid #0077B5;padding:15px;margin:20px 0;background:white;border-radius:4px;color:#333;">
              ${data.messageText.replace(/\n/g, '<br>')}
            </blockquote>

            ${data.intent ? `
            <div style="background:#fff;padding:15px;border-radius:4px;margin:20px 0;border-left:4px solid ${
              data.intent === 'interested' ? '#22c55e' :
              data.intent === 'not_interested' ? '#ef4444' :
              data.intent === 'objection' ? '#f97316' :
              '#3b82f6'
            };">
              <p style="margin:0 0 5px 0;font-size:12px;color:#666;">Detected Intent:</p>
              <p style="margin:0;font-size:14px;font-weight:600;">
                ${emoji} ${data.intent.replace('_', ' ').toUpperCase()}
                <span style="font-weight:normal;color:#666;"> (${((data.intentConfidence || 0) * 100).toFixed(0)}% confidence)</span>
              </p>
            </div>
            ` : ''}

            ${data.draft ? `
            <hr style="border:none;border-top:2px solid #0077B5;margin:30px 0;">

            <p style="font-size:16px;margin:20px 0 10px 0;font-weight:600;">My suggested reply:</p>

            <div style="background:white;padding:20px;border-radius:4px;border:1px solid #ddd;margin:20px 0;font-family:inherit;">
              ${data.draft.replace(/\n/g, '<br>')}
            </div>

            <div style="background:#fff3cd;padding:15px;border-radius:4px;border-left:4px solid #ffc107;margin:20px 0;">
              <p style="margin:0 0 10px 0;font-weight:600;">Reply to this email to respond:</p>
              <ul style="margin:0;padding-left:20px;">
                <li><strong>Type "APPROVE"</strong> - Send my draft via LinkedIn</li>
                <li><strong>Edit the message</strong> - Send your version</li>
                <li><strong>Type "REFUSE"</strong> - Don't send anything</li>
              </ul>
            </div>
            ` : `
            <div style="background:#f3f4f6;padding:15px;border-radius:4px;margin:20px 0;">
              <p style="margin:0;color:#666;">Reply agent is disabled. <a href="https://app.meet-sam.com/settings/reply-agent">Enable it</a> to get AI-generated drafts.</p>
            </div>
            `}

            <p style="font-size:12px;color:#666;margin-top:30px;padding-top:20px;border-top:1px solid #e0e0e0;">
              <a href="https://app.meet-sam.com/replies/${replyId}">View in dashboard</a>
            </p>

            <p style="font-size:14px;margin-top:20px;">Sam</p>
          </div>
        </div>
      `,
      TextBody: `Hi ${user.first_name},

${data.prospectName}${data.prospectCompany ? ` from ${data.prospectCompany}` : ''} replied on LinkedIn:

"${data.messageText}"

${data.intent ? `Intent: ${data.intent.replace('_', ' ')} (${((data.intentConfidence || 0) * 100).toFixed(0)}% confidence)` : ''}

${data.draft ? `My suggested reply:

${data.draft}

---
Reply to this email:
- Type "APPROVE" to send my draft via LinkedIn
- Edit the message to send your version
- Type "REFUSE" to not send anything
` : 'Reply agent is disabled. Enable it in settings to get AI-generated drafts.'}

Sam`,
      MessageStream: 'outbound',
      Tag: 'linkedin-reply-notification',
      Metadata: {
        replyId,
        channel: 'linkedin',
        intent: data.intent
      }
    });

    console.log(`📧 LinkedIn reply notification sent to: ${user.email}`);
  }
}
