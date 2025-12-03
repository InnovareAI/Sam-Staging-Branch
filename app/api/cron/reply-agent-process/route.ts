import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';
import { getClaudeClient } from '@/lib/llm/claude-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || '792e0c09eeee1a229b78a6341739613177fad24f401b1c82f2673bbb9ee806a0';
const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const POSTMARK_API_KEY = process.env.POSTMARK_SERVER_TOKEN;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';

interface UnipileMessage {
  id: string;
  text: string;
  timestamp: string;
  sender_id: string;
  sender_name?: string;
  is_inbound: boolean;
}

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('x-cron-secret');
  if (authHeader !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const results: any[] = [];

  try {
    // 1. Get all workspaces with Reply Agent enabled
    const { data: enabledConfigs, error: configError } = await supabase
      .from('workspace_reply_agent_config')
      .select('*, workspaces(id, name)')
      .eq('enabled', true);

    if (configError || !enabledConfigs?.length) {
      return NextResponse.json({
        message: 'No workspaces with Reply Agent enabled',
        processed: 0
      });
    }

    for (const config of enabledConfigs) {
      const workspaceId = config.workspace_id;

      // 2. Get active campaigns for this workspace
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, campaign_name')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active');

      if (!campaigns?.length) continue;

      // 3. Get prospects who have been contacted (might reply)
      const campaignIds = campaigns.map(c => c.id);
      const { data: prospects } = await supabase
        .from('campaign_prospects')
        .select('*, campaigns(campaign_name)')
        .in('campaign_id', campaignIds)
        .in('status', ['connection_request_sent', 'connected', 'message_sent', 'followed_up']);

      if (!prospects?.length) continue;

      // 4. Get LinkedIn account for this workspace
      const { data: linkedinAccount } = await supabase
        .from('campaign_linkedin_accounts')
        .select('unipile_account_id')
        .in('campaign_id', campaignIds)
        .limit(1)
        .single();

      if (!linkedinAccount?.unipile_account_id) continue;

      // 5. Check for new messages from Unipile
      for (const prospect of prospects) {
        if (!prospect.linkedin_user_id) continue;

        try {
          // Check if we already processed this prospect recently
          const { data: existingDraft } = await supabase
            .from('reply_agent_drafts')
            .select('id')
            .eq('prospect_id', prospect.id)
            .eq('status', 'pending_approval')
            .single();

          if (existingDraft) continue; // Already have pending draft

          // Fetch recent messages from Unipile
          const messagesResponse = await fetch(
            `https://${UNIPILE_DSN}/api/v1/messages?account_id=${linkedinAccount.unipile_account_id}&attendee_id=${prospect.linkedin_user_id}&limit=5`,
            {
              headers: {
                'X-API-KEY': UNIPILE_API_KEY!,
                'Accept': 'application/json'
              }
            }
          );

          if (!messagesResponse.ok) continue;

          const messagesData = await messagesResponse.json();
          const messages: UnipileMessage[] = messagesData.items || [];

          // Find unprocessed inbound messages
          const inboundMessages = messages.filter(m => m.is_inbound);
          if (!inboundMessages.length) continue;

          const latestInbound = inboundMessages[0];

          // Check if we already processed this message
          const { data: processedMessage } = await supabase
            .from('reply_agent_drafts')
            .select('id')
            .eq('inbound_message_id', latestInbound.id)
            .single();

          if (processedMessage) continue; // Already processed

          // 6. Generate AI reply
          const draft = await generateAIReply(
            latestInbound,
            prospect,
            config,
            supabase
          );

          if (!draft) continue;

          // 7. Save draft to database
          const { data: savedDraft, error: saveError } = await supabase
            .from('reply_agent_drafts')
            .insert({
              workspace_id: workspaceId,
              campaign_id: prospect.campaign_id,
              prospect_id: prospect.id,
              inbound_message_id: latestInbound.id,
              inbound_message_text: latestInbound.text,
              inbound_message_at: latestInbound.timestamp,
              channel: 'linkedin',
              prospect_name: prospect.first_name ? `${prospect.first_name} ${prospect.last_name || ''}`.trim() : latestInbound.sender_name,
              prospect_linkedin_url: prospect.linkedin_url,
              prospect_company: prospect.company,
              prospect_title: prospect.title,
              draft_text: draft.text,
              intent_detected: draft.intent,
              ai_model: config.ai_model || 'claude-opus-4-5-20251101',
              research_linkedin_profile: draft.research?.linkedin,
              research_company_profile: draft.research?.company,
            })
            .select()
            .single();

          if (saveError) {
            console.error('Error saving draft:', saveError);
            continue;
          }

          // 8. Send HITL email via Postmark (if manual approval mode)
          if (config.approval_mode === 'manual') {
            await sendHITLEmail(savedDraft, config, prospect, latestInbound.text, supabase);
          } else {
            // Auto-approve mode - send immediately
            await autoSendReply(savedDraft, linkedinAccount.unipile_account_id, supabase);
          }

          results.push({
            workspace_id: workspaceId,
            prospect: prospect.first_name,
            draft_id: savedDraft.id,
            mode: config.approval_mode
          });

        } catch (prospectError) {
          console.error(`Error processing prospect ${prospect.id}:`, prospectError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      drafts: results
    });

  } catch (error) {
    console.error('Reply Agent cron error:', error);
    return NextResponse.json({ error: 'Failed to process' }, { status: 500 });
  }
}

async function generateAIReply(
  inboundMessage: UnipileMessage,
  prospect: any,
  config: any,
  supabase: any
): Promise<{ text: string; intent: string; research?: any } | null> {
  try {
    const claude = getClaudeClient();

    // Detect intent first
    const intentPrompt = `Classify this prospect reply into one of these intents:
- INTERESTED: They want to learn more, book a call, or try the product
- QUESTION: They're asking about features, pricing, integrations, etc.
- OBJECTION: They have concerns or pushback
- TIMING: Not now, maybe later
- NOT_INTERESTED: Clear rejection
- VAGUE_POSITIVE: Thumbs up, thanks, etc.
- UNCLEAR: Can't determine intent

Prospect reply: "${inboundMessage.text}"

Respond with just the intent category (e.g., "INTERESTED").`;

    const intentResponse = await claude.complete(intentPrompt, {
      maxTokens: 50,
      temperature: 0
    });
    const intent = intentResponse.trim().toUpperCase().replace(/[^A-Z_]/g, '');

    // If not interested, don't generate a reply
    if (intent === 'NOT_INTERESTED') {
      return { text: '', intent, research: null };
    }

    // Build context for reply generation
    const prospectContext = `
Prospect: ${prospect.first_name || ''} ${prospect.last_name || ''}
Title: ${prospect.title || 'Unknown'}
Company: ${prospect.company || 'Unknown'}
LinkedIn: ${prospect.linkedin_url || 'N/A'}
`;

    const systemPrompt = config.reply_guidelines || `You are a professional sales representative. Generate a helpful, concise reply.`;

    const userPrompt = `Generate a reply to this prospect message.

${prospectContext}

Their message: "${inboundMessage.text}"

Detected intent: ${intent}

Tone: ${config.response_tone || 'professional'}

Keep the reply under 100 words. Sound human, not templated. One clear CTA if appropriate.

Reply:`;

    const replyResponse = await claude.complete(userPrompt, {
      system: systemPrompt,
      maxTokens: 300,
      temperature: 0.7
    });

    return {
      text: replyResponse.trim(),
      intent,
      research: null // TODO: Add research fetching
    };

  } catch (error) {
    console.error('Error generating AI reply:', error);
    return null;
  }
}

async function sendHITLEmail(
  draft: any,
  config: any,
  prospect: any,
  inboundText: string,
  supabase: any
): Promise<void> {
  if (!POSTMARK_API_KEY) {
    console.error('POSTMARK_API_KEY not configured');
    return;
  }

  try {
    // Get workspace owner's email
    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id, users(email)')
      .eq('workspace_id', draft.workspace_id)
      .eq('role', 'owner')
      .limit(1);

    const ownerEmail = members?.[0]?.users?.email;
    if (!ownerEmail) {
      console.error('No owner email found for workspace');
      return;
    }

    const approveUrl = `${APP_URL}/api/reply-agent/approve?token=${draft.approval_token}&action=approve`;
    const rejectUrl = `${APP_URL}/api/reply-agent/approve?token=${draft.approval_token}&action=reject`;
    const editUrl = `${APP_URL}/workspace/${draft.workspace_id}/reply-agent?draft=${draft.id}`;

    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .message-box { background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #667eea; }
    .draft-box { background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #10b981; }
    .button { display: inline-block; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 8px 8px 8px 0; }
    .approve { background: #10b981; color: white; }
    .reject { background: #ef4444; color: white; }
    .edit { background: #6b7280; color: white; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .intent { display: inline-block; background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin:0;">📬 New Reply Needs Approval</h2>
      <p style="margin:8px 0 0 0; opacity:0.9;">${prospect.first_name || 'A prospect'} replied to your campaign</p>
    </div>
    <div class="content">
      <p><strong>From:</strong> ${draft.prospect_name || 'Unknown'}</p>
      <p><strong>Company:</strong> ${draft.prospect_company || 'Unknown'}</p>
      <p><strong>Intent:</strong> <span class="intent">${draft.intent_detected || 'UNCLEAR'}</span></p>

      <h3>Their Message:</h3>
      <div class="message-box">
        ${inboundText}
      </div>

      <h3>SAM's Draft Reply:</h3>
      <div class="draft-box">
        ${draft.draft_text}
      </div>

      <div style="margin-top: 24px;">
        <a href="${approveUrl}" class="button approve">✓ Approve & Send</a>
        <a href="${rejectUrl}" class="button reject">✗ Reject</a>
        <a href="${editUrl}" class="button edit">✏️ Edit First</a>
      </div>

      <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
        This draft will expire in 48 hours if not actioned.
      </p>
    </div>
    <div class="footer">
      <p>Sent by SAM AI • <a href="${APP_URL}">app.meet-sam.com</a></p>
    </div>
  </div>
</body>
</html>
`;

    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': POSTMARK_API_KEY
      },
      body: JSON.stringify({
        From: 'sam@innovareai.com',
        To: ownerEmail,
        Subject: `📬 ${draft.prospect_name || 'Prospect'} replied - Review SAM's draft`,
        HtmlBody: emailBody,
        TextBody: `New reply from ${draft.prospect_name}:\n\n"${inboundText}"\n\nSAM's draft reply:\n\n"${draft.draft_text}"\n\nApprove: ${approveUrl}\nReject: ${rejectUrl}`,
        MessageStream: 'outbound'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Postmark error:', error);
    }

  } catch (error) {
    console.error('Error sending HITL email:', error);
  }
}

async function autoSendReply(
  draft: any,
  accountId: string,
  supabase: any
): Promise<void> {
  // TODO: Implement auto-send via Unipile
  // For now, just mark as approved
  await supabase
    .from('reply_agent_drafts')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString()
    })
    .eq('id', draft.id);
}
