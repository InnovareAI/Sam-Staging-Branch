/**
 * Unipile Webhook Handler for LinkedIn DM Replies
 * Receives inbound LinkedIn messages and triggers Reply Agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { classifyIntent } from '@/lib/services/intent-classifier';
import { generateReplyDraft, getDefaultSettings } from '@/lib/services/reply-draft-generator';
import { syncInterestedLeadToCRM } from '@/lib/services/crm-sync';
import { sendCampaignReplyNotification } from '@/lib/notifications/google-chat';
import { activeCampaignService } from '@/lib/activecampaign';
import { airtableService } from '@/lib/airtable';

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
    // Match by linkedin_user_id (provider_id) OR by vanity URL
    const senderId = payload.data.sender?.id;
    const senderVanity = payload.data.sender?.profile_url?.split('/in/')[1]?.split('/')[0]?.split('?')[0];

    let prospect = null;

    // First try matching by linkedin_user_id (most reliable)
    if (senderId) {
      const { data: prospectByUserId } = await supabase
        .from('campaign_prospects')
        .select(`
          id,
          first_name,
          last_name,
          email,
          title,
          company_name,
          linkedin_url,
          linkedin_user_id,
          campaign_id,
          status,
          campaigns (
            id,
            name,
            workspace_id,
            message_templates
          )
        `)
        .eq('linkedin_user_id', senderId)
        .in('status', ['connected', 'messaging', 'follow_up_sent', 'connection_request_sent'])
        .limit(1)
        .maybeSingle();

      if (prospectByUserId) {
        prospect = prospectByUserId;
        console.log(`✅ Matched prospect by linkedin_user_id: ${prospect.first_name} ${prospect.last_name}`);
      }
    }

    // Fallback: try matching by vanity URL
    if (!prospect && senderVanity) {
      const { data: prospectByVanity } = await supabase
        .from('campaign_prospects')
        .select(`
          id,
          first_name,
          last_name,
          email,
          title,
          company_name,
          linkedin_url,
          linkedin_user_id,
          campaign_id,
          status,
          campaigns (
            id,
            name,
            workspace_id,
            message_templates
          )
        `)
        .ilike('linkedin_url', `%${senderVanity}%`)
        .in('status', ['connected', 'messaging', 'follow_up_sent', 'connection_request_sent'])
        .limit(1)
        .maybeSingle();

      if (prospectByVanity) {
        prospect = prospectByVanity;
        console.log(`✅ Matched prospect by vanity URL: ${prospect.first_name} ${prospect.last_name}`);
      }
    }

    // If we can't match by prospect ID, try matching by conversation
    let campaignId = prospect?.campaign_id;
    let prospectId = prospect?.id;
    let prospectName = prospect ? `${prospect.first_name} ${prospect.last_name}` : senderName;
    let prospectCompany = prospect?.company_name;
    let originalOutreach = '';
    const isFromCampaign = !!prospect;

    if (prospect?.campaigns?.message_templates) {
      const templates = prospect.campaigns.message_templates as any;
      originalOutreach = templates.connection_request || templates.initial_message || '';
    }

    // CRITICAL: If this is a campaign prospect, IMMEDIATELY stop follow-up sequence
    if (isFromCampaign && prospectId) {
      console.log(`🛑 STOPPING follow-up sequence for ${prospectName} - they replied!`);

      const { error: stopError } = await supabase
        .from('campaign_prospects')
        .update({
          status: 'replied',
          responded_at: new Date().toISOString(),
          follow_up_due_at: null, // STOP follow-ups
          updated_at: new Date().toISOString()
        })
        .eq('id', prospectId);

      if (stopError) {
        console.error(`❌ Failed to stop follow-up sequence:`, stopError);
      } else {
        console.log(`✅ Follow-up sequence STOPPED for prospect ${prospectId}`);
      }

      // Also cancel any pending queued messages
      const { error: cancelError } = await supabase
        .from('linkedin_message_queue')
        .update({
          status: 'cancelled',
          error_message: 'Prospect replied - sequence stopped',
          updated_at: new Date().toISOString()
        })
        .eq('prospect_id', prospectId)
        .eq('status', 'pending');

      if (!cancelError) {
        console.log(`✅ Cancelled pending queued messages for prospect`);
      }
    }

    // NON-CAMPAIGN MESSAGE FILTER (Added Dec 1, 2025)
    // If this message is NOT from a campaign prospect, check if it's worth processing
    // Only process organic leads who show clear business intent
    if (!isFromCampaign) {
      console.log('📋 Non-campaign message received, checking business intent...');

      // Quick intent check for non-campaign messages
      const lowerMessage = messageText.toLowerCase();

      // High-value signals: demo requests, service inquiries, pricing questions
      const businessIntentPatterns = [
        /\b(demo|meeting|call|schedule|book|calendar)\b/i,
        /\b(interested|interest|curious|learn more|tell me more)\b/i,
        /\b(pricing|price|cost|plans?|subscription)\b/i,
        /\b(sam|your service|your product|your platform|your tool)\b/i,
        /\b(linkedin automation|outreach|campaigns?|leads?|prospecting)\b/i,
        /\b(how does it work|how do you|what do you offer)\b/i,
        /\b(sign up|get started|trial|free trial)\b/i,
        /\b(sales|business development|b2b|lead gen)\b/i,
      ];

      const hasBusinessIntent = businessIntentPatterns.some(pattern => pattern.test(lowerMessage));

      if (!hasBusinessIntent) {
        console.log('⏭️ Ignoring non-campaign message without business intent:', {
          sender: senderName,
          preview: messageText.substring(0, 100)
        });
        return NextResponse.json({
          success: true,
          message: 'Non-campaign message without business intent - ignored',
          reason: 'no_business_intent'
        });
      }

      console.log('✅ Non-campaign message has business intent - processing as organic lead');
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

    // Sync to CRM and ActiveCampaign if positive intent
    // Positive: interested, curious, question, vague_positive (engaged leads)
    // Negative: objection, timing, wrong_person, not_interested (skip sync)
    const positiveIntents = ['interested', 'curious', 'question', 'vague_positive'];
    if (positiveIntents.includes(intent.intent)) {
      console.log(`📊 Positive intent (${intent.intent}) detected - syncing to CRM & ActiveCampaign...`);
      const crmResult = await syncInterestedLeadToCRM(account.workspace_id, {
        prospectId: prospectId,
        firstName: prospect?.first_name || senderName.split(' ')[0] || 'Unknown',
        lastName: prospect?.last_name || senderName.split(' ').slice(1).join(' ') || '',
        email: undefined, // LinkedIn doesn't provide email
        phone: undefined,
        company: prospectCompany,
        jobTitle: prospect?.title,
        linkedInUrl: prospect?.linkedin_url || senderProfileUrl,
        replyText: messageText,
        intent: intent.intent,
        intentConfidence: intent.confidence,
        campaignId: campaignId,
        campaignName: prospect?.campaigns?.campaign_name
      });

      if (crmResult.success) {
        console.log(`✅ CRM sync successful: ${crmResult.crmType} - Contact: ${crmResult.contactId}`);
      } else if (crmResult.error !== 'No active CRM connection') {
        console.log(`⚠️ CRM sync skipped: ${crmResult.error}`);
      }

      // Sync to ActiveCampaign Newsletter list (ID 4)
      // Creates contact and adds to newsletter for future nurturing
      try {
        const firstName = prospect?.first_name || senderName.split(' ')[0] || 'Unknown';
        const lastName = prospect?.last_name || senderName.split(' ').slice(1).join(' ') || '';

        // Prioritize actual email, fallback to placeholder
        const email = prospect?.email || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@linkedin-lead.placeholder`;

        console.log(`📧 Syncing interested lead to ActiveCampaign: ${firstName} ${lastName}`);

        // Fetch AC list ID from workspace config
        const { data: acConfig } = await supabase
          .from('workspace_crm_config')
          .select('activecampaign_list_id')
          .eq('workspace_id', account.workspace_id)
          .single();

        const listId = acConfig?.activecampaign_list_id || 'sam-users';

        const acResult = await activeCampaignService.addNewMemberToList(
          email,
          firstName,
          lastName,
          listId,
          {
            fieldValues: [
              { field: 'LINKEDIN_URL', value: prospect?.linkedin_url || senderProfileUrl || '' },
              { field: 'COMPANY', value: prospectCompany || '' },
              { field: 'JOB_TITLE', value: prospect?.title || '' },
              { field: 'SAM_INTENT', value: intent.intent },
              { field: 'SAM_CAMPAIGN', value: prospect?.campaigns?.campaign_name || 'LinkedIn Campaign' }
            ]
          }
        );

        if (acResult.success) {
          console.log(`✅ ActiveCampaign Newsletter sync successful - Contact ID: ${acResult.contactId}`);

          // Add "SAM Interested Lead" tag
          try {
            const tag = await activeCampaignService.findOrCreateTag('SAM Interested Lead');
            await activeCampaignService.addTagToContact(acResult.contactId!, tag.id);
            console.log(`✅ Added "SAM Interested Lead" tag to contact`);
          } catch (tagError) {
            console.log(`⚠️ Could not add tag: ${tagError}`);
          }
        } else {
          console.log(`⚠️ ActiveCampaign sync failed: ${acResult.error}`);
        }
      } catch (acError) {
        console.error('❌ ActiveCampaign sync error:', acError);
      }

    }

    // Sync ALL replies to Airtable (full pipeline visibility)
    // This updates status based on intent - positive, negative, or neutral
    try {
      const firstName = prospect?.first_name || senderName.split(' ')[0] || 'Unknown';
      const lastName = prospect?.last_name || senderName.split(' ').slice(1).join(' ') || '';

      console.log(`📊 Syncing reply to Airtable: ${firstName} ${lastName} (${intent.intent})`);

      const airtableResult = await airtableService.syncLinkedInLead({
        profileUrl: prospect?.linkedin_url || senderProfileUrl,
        name: `${firstName} ${lastName}`.trim(),
        jobTitle: prospect?.title,
        companyName: prospectCompany,
        linkedInAccount: account.account_email,
        intent: intent.intent,
        replyText: messageText,
      });

      if (airtableResult.success) {
        console.log(`✅ Airtable sync successful - Record ID: ${airtableResult.recordId}`);
      } else {
        console.log(`⚠️ Airtable sync failed: ${airtableResult.error}`);
      }
    } catch (airtableError) {
      console.error('❌ Airtable sync error:', airtableError);
    }

    // Generate draft with full research
    console.log('📝 Generating draft with Opus 4.5 research...');
    const draftResult = await generateReplyDraft({
      workspaceId: account.workspace_id,
      prospectReply: messageText,
      // Pass Unipile account ID for LinkedIn API access during research
      unipileAccountId: payload.data.account_id,
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
      draft: draftResult.draft,
      isFromCampaign,  // Flag to indicate organic vs campaign lead
    });

    // Send Google Chat notification for IA1-IA7 workspaces
    await sendCampaignReplyNotification({
      workspaceId: account.workspace_id,
      prospectName,
      prospectCompany,
      messageText,
      intent: intent.intent,
      intentConfidence: intent.confidence,
      draft: draftResult.draft,
      isFromCampaign,
      replyId: reply.id,
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
    isFromCampaign?: boolean;  // false = organic lead not in any campaign
  }
) {
  // Get workspace members (no FK, so separate queries)
  const { data: members, error: membersError } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', workspaceId)
    .in('role', ['owner', 'admin', 'member']);

  if (membersError) {
    console.error('Error fetching workspace members:', membersError);
    return;
  }

  if (!members || members.length === 0) {
    console.error('No members found for workspace');
    return;
  }

  // Get user details for each member
  const userIds = members.map((m: any) => m.user_id);
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, first_name')
    .in('id', userIds);

  if (usersError) {
    console.error('Error fetching users:', usersError);
    return;
  }

  // Map users to members
  const userMap = new Map((users || []).map((u: any) => [u.id, u]));
  const membersWithUsers = members.map((m: any) => ({
    ...m,
    users: userMap.get(m.user_id)
  })).filter((m: any) => m.users); // Only include members with valid user data

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

  // Send via Postmark (use POSTMARK_SERVER_TOKEN which is set in production)
  const { ServerClient } = require('postmark');
  const postmarkToken = process.env.POSTMARK_SERVER_TOKEN || process.env.POSTMARK_INNOVAREAI_API_KEY;
  if (!postmarkToken) {
    console.error('❌ Postmark token not configured');
    return;
  }
  const postmark = new ServerClient(postmarkToken);

  for (const member of membersWithUsers) {
    const user = member.users;

    await postmark.sendEmail({
      From: 'Sam <hello@sam.innovareai.com>',
      To: user.email,
      ReplyTo: `draft+${replyId}@sam.innovareai.com`,
      Subject: `${emoji} ${data.isFromCampaign === false ? '🌟 Organic Lead: ' : ''}${data.prospectName} ${data.isFromCampaign === false ? 'messaged you' : 'replied'} on LinkedIn${data.intent ? ` - ${data.intent.replace('_', ' ')}` : ''}`,
      HtmlBody: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#0077B5;color:white;padding:20px;border-radius:8px 8px 0 0;">
            <h2 style="margin:0;">💼 LinkedIn Reply${data.intent ? ` - ${data.intent.replace('_', ' ').toUpperCase()}` : ''}</h2>
          </div>

          ${data.isFromCampaign === false ? `
          <div style="background:#fef3c7;padding:15px 20px;border:1px solid #f59e0b;border-top:none;border-bottom:none;">
            <p style="margin:0;font-size:14px;color:#92400e;">
              <strong>🌟 Organic Lead</strong> — This person is NOT in any active campaign.
              They reached out on their own showing interest in your services. I drafted a reply based on their intent.
            </p>
          </div>
          ` : ''}

          <div style="background:#f9f9f9;padding:20px;border:1px solid #e0e0e0;border-top:none;">
            <p style="font-size:16px;margin:0 0 10px 0;">Hi ${user.first_name},</p>

            <p style="font-size:14px;margin:10px 0;">
              <strong>${data.prospectName}</strong>
              ${data.prospectCompany ? `from <strong>${data.prospectCompany}</strong>` : ''}
              ${data.isFromCampaign === false ? 'messaged you' : 'replied'} on LinkedIn:
            </p>

            <blockquote style="border-left:4px solid #0077B5;padding:15px;margin:20px 0;background:white;border-radius:4px;color:#333;">
              ${data.messageText.replace(/\n/g, '<br>')}
            </blockquote>

            ${data.intent ? `
            <div style="background:#fff;padding:15px;border-radius:4px;margin:20px 0;border-left:4px solid ${data.intent === 'interested' ? '#22c55e' :
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
${data.isFromCampaign === false ? `
🌟 ORGANIC LEAD - This person is NOT in any active campaign.
They reached out on their own showing interest in your services. I drafted a reply based on their intent.
` : ''}
${data.prospectName}${data.prospectCompany ? ` from ${data.prospectCompany}` : ''} ${data.isFromCampaign === false ? 'messaged you' : 'replied'} on LinkedIn:

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
