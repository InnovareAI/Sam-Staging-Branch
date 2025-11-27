/**
 * Postmark Inbound Webhook Handler
 * Processes incoming emails to SAM and triggers appropriate actions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@supabase/supabase-js'
import { verifyPostmarkWebhook, getRequestBody } from '@/lib/security/webhook-auth'

interface PostmarkInboundEmail {
  From: string
  FromName: string
  FromFull: {
    Email: string
    Name: string
  }
  To: string
  ToFull: Array<{
    Email: string
    Name: string
    MailboxHash: string
  }>
  Cc: string
  CcFull: Array<any>
  Bcc: string
  BccFull: Array<any>
  Subject: string
  MessageID: string
  ReplyTo: string
  OriginalRecipient: string
  Date: string
  MailboxHash: string
  TextBody: string
  HtmlBody: string
  StrippedTextReply: string
  Tag: string
  Headers: Array<{ Name: string; Value: string }>
  Attachments: Array<{
    Name: string
    Content: string
    ContentType: string
    ContentLength: number
  }>
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    const body = await getRequestBody(request);
    const { valid, error } = await verifyPostmarkWebhook(request, body);

    if (!valid && error) {
      console.error('❌ Invalid Postmark webhook signature');
      return error;
    }

    const email: PostmarkInboundEmail = JSON.parse(body);

    console.log('📧 Received inbound email:', {
      from: email.From,
      to: email.To,
      subject: email.Subject,
      mailboxHash: email.MailboxHash
    })

    // Save email to database FIRST (for all emails)
    const emailRecord = await saveEmailToDatabase(email)

    // Extract the action context from To address
    // Format: sam+action-sessionid@meet-sam.com
    // Or: reply+sessionid@meet-sam.com
    const recipient = email.ToFull[0]
    const mailboxHash = recipient.MailboxHash // The part after "+"

    // Parse the context
    const context = parseEmailContext(mailboxHash, email.Subject, email.TextBody)

    // Route to appropriate handler
    if (context.type === 'approval') {
      await handleApprovalReply(email, context, emailRecord.id)
    } else if (context.type === 'campaign-reply') {
      await handleCampaignReply(email, context, emailRecord.id)
    } else if (context.type === 'draft-reply') {
      await handleDraftReply(email, context, emailRecord.id)
    } else if (context.type === 'general') {
      await handleGeneralMessage(email, emailRecord.id)
    }

    return NextResponse.json({
      success: true,
      message: 'Email processed successfully',
      emailId: emailRecord.id
    })
  } catch (error) {
    console.error('❌ Error processing inbound email:', error)
    return NextResponse.json(
      { error: 'Failed to process email' },
      { status: 500 }
    )
  }
}

/**
 * Create Supabase service role client for webhook operations
 */
function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

/**
 * Save inbound email to database
 */
async function saveEmailToDatabase(email: PostmarkInboundEmail) {
  const supabase = getServiceClient()

  // Insert email into email_responses table
  const { data, error } = await supabase
    .from('email_responses')
    .insert({
      from_email: email.From,
      from_name: email.FromName,
      to_email: email.To,
      subject: email.Subject,
      message_id: email.MessageID,
      text_body: email.TextBody,
      html_body: email.HtmlBody,
      stripped_text: email.StrippedTextReply,
      has_attachments: email.Attachments && email.Attachments.length > 0,
      attachments: email.Attachments || [],
      received_at: new Date(email.Date),
      processed: false,
      raw_email: email
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to save email to database:', error)
    throw new Error(`Database error: ${error.message}`)
  }

  console.log('✅ Email saved to database:', data.id)
  return data
}

/**
 * Parse email context from mailbox hash and content
 */
function parseEmailContext(mailboxHash: string, subject: string, body: string) {
  // Check if it's an approval reply
  // Format: approval-{sessionId}
  if (mailboxHash?.startsWith('approval-')) {
    const sessionId = mailboxHash.replace('approval-', '')
    return {
      type: 'approval' as const,
      sessionId,
      action: detectApprovalAction(body)
    }
  }

  // Check if it's a campaign reply
  // Format: campaign-reply-{campaignId}-{prospectId} (NEW FORMAT)
  if (mailboxHash?.startsWith('campaign-reply-')) {
    const parts = mailboxHash.split('-');
    // Extract campaignId and prospectId (skip 'campaign' and 'reply' parts)
    const campaignId = parts[2];
    const prospectId = parts[3];
    return {
      type: 'campaign-reply' as const,
      campaignId,
      prospectId
    }
  }

  // Legacy format: reply-{campaignId}-{prospectId} (BACKWARD COMPATIBLE)
  if (mailboxHash?.startsWith('reply-')) {
    const [, campaignId, prospectId] = mailboxHash.split('-')
    return {
      type: 'campaign-reply' as const,
      campaignId,
      prospectId
    }
  }

  // Check if it's a HITL reply to SAM's draft
  // Format: draft-{replyId}
  if (mailboxHash?.startsWith('draft-')) {
    const replyId = mailboxHash.replace('draft-', '')
    return {
      type: 'draft-reply' as const,
      replyId,
      action: detectHITLAction(body)
    }
  }

  // General message to SAM
  return {
    type: 'general' as const
  }
}

/**
 * Detect approval action from email body
 */
function detectApprovalAction(body: string): 'approve-all' | 'reject-all' | 'review' | 'custom' {
  const bodyLower = body.toLowerCase().trim()

  if (bodyLower.includes('approve all') || bodyLower === 'approve') {
    return 'approve-all'
  }
  if (bodyLower.includes('reject all') || bodyLower === 'reject') {
    return 'reject-all'
  }
  if (bodyLower.includes('review') || bodyLower.includes('look')) {
    return 'review'
  }

  return 'custom'
}

/**
 * Detect HITL action from draft reply email
 */
function detectHITLAction(body: string): { action: 'approve' | 'refuse' | 'edit', editedMessage?: string } {
  const bodyLower = body.toLowerCase().trim()
  const bodyTrimmed = body.trim()

  // Check for APPROVE keyword
  if (bodyLower === 'approve' || bodyLower.includes('approve') && bodyLower.length < 50) {
    return { action: 'approve' }
  }

  // Check for REFUSE/REJECT keyword
  if (bodyLower === 'refuse' || bodyLower === 'reject' ||
      bodyLower.includes('refuse') && bodyLower.length < 50 ||
      bodyLower.includes('reject') && bodyLower.length < 50) {
    return { action: 'refuse' }
  }

  // Otherwise, treat the email body as the edited message
  // Strip out email signatures and quoted text
  let editedMessage = bodyTrimmed

  // Remove common email signatures
  const signatureMarkers = ['--', '___', 'Sent from', 'Best regards', 'Thanks,', 'Thank you,']
  for (const marker of signatureMarkers) {
    const index = editedMessage.indexOf(marker)
    if (index > 0) {
      editedMessage = editedMessage.substring(0, index).trim()
    }
  }

  return {
    action: 'edit',
    editedMessage
  }
}

/**
 * Handle approval-related replies
 */
async function handleApprovalReply(email: PostmarkInboundEmail, context: { sessionId: string, action: string }, emailId: string) {
  const supabase = getServiceClient()

  // Get the approval session
  const { data: session } = await supabase
    .from('prospect_approval_sessions')
    .select('*, workspace_id')
    .eq('id', context.sessionId)
    .single()

  if (!session) {
    console.error('Approval session not found:', context.sessionId)
    return
  }

  // Get user from email
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.From)
    .single()

  if (!user) {
    console.error('User not found:', email.From)
    return
  }

  // Execute the action
  if (context.action === 'approve-all') {
    // Approve all pending prospects
    const { data: prospects } = await supabase
      .from('prospect_approvals')
      .select('id')
      .eq('session_id', context.sessionId)
      .eq('status', 'pending')

    if (prospects) {
      await supabase
        .from('prospect_approvals')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id
        })
        .in('id', prospects.map(p => p.id))

      // Update session
      await supabase
        .from('prospect_approval_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', context.sessionId)

      // Send confirmation email
      await sendApprovalConfirmation(email.From, {
        action: 'approved',
        count: prospects.length,
        sessionId: context.sessionId
      })
    }
  }

  console.log('✅ Processed approval reply:', {
    sessionId: context.sessionId,
    action: context.action,
    from: email.From
  })
}

/**
 * Handle campaign reply forwards (PRIORITY: IMMEDIATE - <15 min)
 * Reply agent emails have the highest priority in the system
 */
async function handleCampaignReply(email: PostmarkInboundEmail, context: { campaignId: string, prospectId: string }, emailId: string) {
  const supabase = getServiceClient()

  console.log('🚨 PRIORITY: Campaign reply received - processing immediately:', {
    campaignId: context.campaignId,
    prospectId: context.prospectId,
    from: email.From
  })

  // 1. Store the reply in database with HIGH PRIORITY flag
  const { data: reply, error: replyError } = await supabase
    .from('campaign_replies')
    .insert({
      campaign_id: context.campaignId,
      prospect_id: context.prospectId,
      email_response_id: emailId,
      reply_text: email.TextBody,
      reply_html: email.HtmlBody,
      received_at: new Date().toISOString(),
      requires_review: true,
      priority: 'urgent',  // Mark as urgent for UI sorting
      metadata: {
        from_email: email.From,
        from_name: email.FromName,
        subject: email.Subject,
        message_id: email.MessageID
      }
    })
    .select()
    .single()

  if (replyError) {
    console.error('Failed to store campaign reply:', replyError)
    throw new Error(`Failed to store reply: ${replyError.message}`)
  }

  // 2. IMMEDIATELY notify the user (no batching, no delay)
  await notifyUserOfReply(email, context, reply.id)

  // 3. Generate SAM draft response (high priority)
  await generateReplyDraft(reply.id, context, email)

  // 4. Mark email as processed
  await supabase
    .from('email_responses')
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
      intent: 'campaign_reply',
      sentiment: await detectSentiment(email.TextBody),  // Quick sentiment analysis
      requires_response: true
    })
    .eq('id', emailId)

  console.log('✅ Campaign reply processed and user notified (priority: urgent):', {
    replyId: reply.id,
    campaignId: context.campaignId,
    prospectId: context.prospectId,
    processingTime: new Date().getTime() - new Date(email.Date).getTime() + 'ms'
  })
}

/**
 * Handle HITL reply to SAM's draft (via email)
 * User replies from Outlook/Gmail with APPROVE, REFUSE, or edited message
 */
async function handleDraftReply(email: PostmarkInboundEmail, context: { replyId: string, action: { action: string, editedMessage?: string } }, emailId: string) {
  const supabase = getServiceClient()

  console.log('📧 HITL replied to draft via email:', {
    replyId: context.replyId,
    action: context.action.action,
    from: email.From
  })

  // 1. Get the reply record
  const { data: reply } = await supabase
    .from('campaign_replies')
    .select(`
      *,
      campaigns(id, name, workspace_id, channel),
      workspace_prospects(id, name, company, email, linkedin_url)
    `)
    .eq('id', context.replyId)
    .single()

  if (!reply) {
    console.error('Reply not found:', context.replyId)
    return
  }

  // 2. Verify user has access
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.From)
    .single()

  if (!user) {
    console.error('User not found:', email.From)
    return
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', reply.campaigns.workspace_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    console.error('User not a member of workspace')
    return
  }

  // 3. Handle action
  if (context.action.action === 'approve') {
    // Use SAM's draft as-is
    await supabase
      .from('campaign_replies')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        final_message: reply.ai_suggested_response,
        requires_review: false
      })
      .eq('id', context.replyId)

    // Queue for sending
    await queueMessageForSending({
      replyId: context.replyId,
      prospectId: reply.workspace_prospects.id,
      campaignId: reply.campaigns.id,
      channel: reply.campaigns.channel || 'email',
      message: reply.ai_suggested_response,
      prospectEmail: reply.workspace_prospects.email,
      prospectLinkedIn: reply.workspace_prospects.linkedin_url
    })

    // Send confirmation
    await sendHITLConfirmation(email.From, {
      action: 'approved',
      prospectName: reply.workspace_prospects.name,
      message: reply.ai_suggested_response
    })

    console.log('✅ Draft approved via email, message queued')

  } else if (context.action.action === 'refuse') {
    // Don't send anything
    await supabase
      .from('campaign_replies')
      .update({
        status: 'refused',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        requires_review: false,
        metadata: {
          ...reply.metadata,
          refusal_reason: 'Refused via email',
          refused_at: new Date().toISOString()
        }
      })
      .eq('id', context.replyId)

    // Send confirmation
    await sendHITLConfirmation(email.From, {
      action: 'refused',
      prospectName: reply.workspace_prospects.name
    })

    console.log('❌ Draft refused via email, no message sent')

  } else if (context.action.action === 'edit') {
    // Use HITL's edited version
    await supabase
      .from('campaign_replies')
      .update({
        status: 'edited',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        final_message: context.action.editedMessage,
        requires_review: false,
        metadata: {
          ...reply.metadata,
          original_draft: reply.ai_suggested_response,
          edit_made_at: new Date().toISOString()
        }
      })
      .eq('id', context.replyId)

    // Queue edited message for sending
    await queueMessageForSending({
      replyId: context.replyId,
      prospectId: reply.workspace_prospects.id,
      campaignId: reply.campaigns.id,
      channel: reply.campaigns.channel || 'email',
      message: context.action.editedMessage!,
      prospectEmail: reply.workspace_prospects.email,
      prospectLinkedIn: reply.workspace_prospects.linkedin_url
    })

    // Send confirmation
    await sendHITLConfirmation(email.From, {
      action: 'edited',
      prospectName: reply.workspace_prospects.name,
      message: context.action.editedMessage
    })

    console.log('✏️  Draft edited via email, message queued')
  }
}

/**
 * Handle general messages to SAM (HITL → Sam)
 * Creates a SAM conversation thread and processes the user's request
 */
async function handleGeneralMessage(email: PostmarkInboundEmail, emailId: string) {
  const supabase = getServiceClient()

  console.log('📨 General message to SAM:', {
    from: email.From,
    subject: email.Subject
  })

  // 1. Find user by email
  const { data: user } = await supabase
    .from('users')
    .select('id, email, first_name, last_name')
    .eq('email', email.From)
    .single()

  if (!user) {
    console.log('⚠️  Email from unknown user:', email.From)
    // TODO: Send "User not found" response or create lead
    await sendUnknownUserResponse(email.From, email.Subject)
    return
  }

  // 2. Get user's workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    console.error('User has no workspace:', user.id)
    return
  }

  // 3. Create SAM conversation thread
  const { data: thread, error: threadError } = await supabase
    .from('sam_conversation_threads')
    .insert({
      workspace_id: membership.workspace_id,
      user_id: user.id,
      title: email.Subject || 'Email conversation',
      status: 'active',
      source: 'email',
      metadata: {
        email_id: emailId,
        original_from: email.From,
        original_subject: email.Subject,
        inbound_message_id: email.MessageID
      }
    })
    .select()
    .single()

  if (threadError || !thread) {
    console.error('Failed to create thread:', threadError)
    return
  }

  console.log('✅ Created SAM thread:', thread.id)

  // 4. Add user's email as first message
  await supabase
    .from('sam_conversation_messages')
    .insert({
      thread_id: thread.id,
      role: 'user',
      content: email.TextBody || email.HtmlBody,
      metadata: {
        email_id: emailId,
        from_email: email.From,
        message_id: email.MessageID
      }
    })

  // 5. Generate SAM's response
  try {
    const samResponse = await generateSAMEmailResponse({
      threadId: thread.id,
      workspaceId: membership.workspace_id,
      userMessage: email.TextBody || email.HtmlBody,
      userEmail: user.email,
      userName: `${user.first_name} ${user.last_name}`.trim()
    })

    // 6. Save SAM's response to database
    await supabase
      .from('sam_conversation_messages')
      .insert({
        thread_id: thread.id,
        role: 'assistant',
        content: samResponse.content,
        metadata: {
          model: samResponse.model,
          tokens_used: samResponse.tokensUsed
        }
      })

    // 7. Send email reply
    await sendSAMEmailReply({
      to: email.From,
      subject: `Re: ${email.Subject || 'Your request'}`,
      body: samResponse.content,
      userName: user.first_name,
      threadId: thread.id,
      inReplyTo: email.MessageID
    })

    // 8. Mark email as processed
    await supabase
      .from('email_responses')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        ai_summary: samResponse.content.substring(0, 500)
      })
      .eq('id', emailId)

    console.log('✅ SAM responded to email:', {
      threadId: thread.id,
      from: email.From
    })
  } catch (error) {
    console.error('Failed to generate SAM response:', error)
    // Send fallback response
    await sendSAMErrorResponse(email.From, email.Subject, user.first_name)
  }
}

/**
 * Send approval confirmation email
 */
async function sendApprovalConfirmation(to: string, data: { action: string, count: number, sessionId: string }) {
  // Implementation using Postmark
  const { ServerClient } = require('postmark')
  const postmark = new ServerClient(process.env.POSTMARK_INNOVAREAI_API_KEY!)

  await postmark.sendEmail({
    From: 'Sam <hello@sam.innovareai.com>',
    To: to,
    Subject: `✅ ${data.count} Prospects Approved`,
    HtmlBody: `
      <p>Perfect! I've approved all ${data.count} prospects.</p>
      <p>Your campaign will start within the next few minutes.</p>
      <p><a href="https://app.meet-sam.com/campaigns">View Campaign Dashboard</a></p>
      <p>Sam</p>
    `,
    MessageStream: 'outbound',
    Tag: 'approval-confirmation'
  })
}

/**
 * Notify user of campaign reply (IMMEDIATE - Priority Email)
 * Sends email with SAM's draft and reply instructions
 * Now includes intent classification for smarter context
 */
async function notifyUserOfReply(email: PostmarkInboundEmail, context: { campaignId: string, prospectId: string }, replyId: string) {
  const supabase = getServiceClient()

  // Wait for draft and intent to be generated
  await new Promise(resolve => setTimeout(resolve, 3000))

  // Get reply with draft and intent
  const { data: reply } = await supabase
    .from('campaign_replies')
    .select(`
      *,
      campaigns(name, campaign_name, workspace_id)
    `)
    .eq('id', replyId)
    .single()

  if (!reply || !reply.ai_suggested_response) {
    console.error('Reply or draft not found')
    return
  }

  // Get prospect from campaign_prospects
  const { data: prospect } = await supabase
    .from('campaign_prospects')
    .select('first_name, last_name, company, title')
    .eq('id', context.prospectId)
    .single()

  const prospectName = prospect ? `${prospect.first_name} ${prospect.last_name}`.trim() : 'Prospect'
  const prospectCompany = prospect?.company || 'Unknown'
  const prospectTitle = prospect?.title

  // Get workspace members
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role, users(email, first_name)')
    .eq('workspace_id', reply.campaigns.workspace_id)
    .in('role', ['owner', 'admin', 'member'])

  if (!members || members.length === 0) {
    console.error('No members found for workspace')
    return
  }

  // Intent emoji and color mapping
  const intentConfig: Record<string, { emoji: string; color: string; label: string; tip: string }> = {
    interested: { emoji: '🟢', color: '#22c55e', label: 'INTERESTED', tip: 'High priority - they want to move forward' },
    curious: { emoji: '🔵', color: '#3b82f6', label: 'CURIOUS', tip: 'Wants more info - answer concisely, then CTA' },
    objection: { emoji: '🟠', color: '#f97316', label: 'OBJECTION', tip: 'Handle carefully - acknowledge, don\'t argue' },
    timing: { emoji: '⏰', color: '#8b5cf6', label: 'TIMING', tip: 'Not now - respect it, offer to follow up' },
    wrong_person: { emoji: '👤', color: '#6b7280', label: 'WRONG PERSON', tip: 'Ask for referral to right contact' },
    not_interested: { emoji: '🔴', color: '#ef4444', label: 'NOT INTERESTED', tip: 'Exit gracefully - no begging' },
    question: { emoji: '❓', color: '#0ea5e9', label: 'QUESTION', tip: 'Answer directly, then bridge to next step' },
    vague_positive: { emoji: '🟡', color: '#eab308', label: 'VAGUE POSITIVE', tip: 'Mirror energy, ask soft clarifying question' }
  }

  const intent = reply.intent || 'curious'
  const intentInfo = intentConfig[intent] || intentConfig.curious
  const confidence = reply.intent_confidence ? Math.round(reply.intent_confidence * 100) : 0

  // Send email with draft to all team members
  const { ServerClient } = require('postmark')
  const postmark = new ServerClient(process.env.POSTMARK_INNOVAREAI_API_KEY!)

  for (const member of members) {
    const user = member.users

    await postmark.sendEmail({
      From: 'Sam <hello@sam.innovareai.com>',
      To: user.email,
      ReplyTo: `draft+${replyId}@sam.innovareai.com`,
      Subject: `${intentInfo.emoji} ${prospectName} replied - ${intentInfo.label}`,
      HtmlBody: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:${intentInfo.color};color:white;padding:20px;border-radius:8px 8px 0 0;">
            <h2 style="margin:0;">${intentInfo.emoji} ${intentInfo.label} - Draft Ready</h2>
          </div>

          <div style="background:#f9f9f9;padding:20px;border:1px solid #e0e0e0;border-top:none;">
            <p style="font-size:16px;margin:0 0 10px 0;">Hi ${user.first_name},</p>

            <p style="font-size:14px;margin:10px 0;">
              <strong>${prospectName}</strong>
              ${prospectTitle ? `(${prospectTitle})` : ''}
              from <strong>${prospectCompany}</strong> replied:
            </p>

            <blockquote style="border-left:4px solid ${intentInfo.color};padding:15px;margin:20px 0;background:white;border-radius:4px;color:#333;">
              ${email.HtmlBody || email.TextBody.replace(/\n/g, '<br>')}
            </blockquote>

            <div style="background:white;padding:15px;border-radius:4px;margin:20px 0;border-left:4px solid ${intentInfo.color};">
              <p style="margin:0 0 5px 0;font-size:12px;color:#666;font-weight:600;">Detected Intent:</p>
              <p style="margin:0 0 8px 0;font-size:16px;font-weight:600;color:${intentInfo.color};">
                ${intentInfo.emoji} ${intentInfo.label}
                <span style="font-weight:normal;color:#666;font-size:12px;"> (${confidence}% confidence)</span>
              </p>
              <p style="margin:0;font-size:13px;color:#666;font-style:italic;">
                💡 ${intentInfo.tip}
              </p>
            </div>

            <hr style="border:none;border-top:2px solid ${intentInfo.color};margin:30px 0;">

            <p style="font-size:16px;margin:20px 0 10px 0;font-weight:600;">My suggested response:</p>

            <div style="background:white;padding:20px;border-radius:4px;border:1px solid #ddd;margin:20px 0;font-family:inherit;line-height:1.6;">
              ${reply.ai_suggested_response.replace(/\n/g, '<br>')}
            </div>

            <hr style="border:none;border-top:1px solid #e0e0e0;margin:30px 0;">

            <div style="background:#fff3cd;padding:15px;border-radius:4px;border-left:4px solid #ffc107;margin:20px 0;">
              <p style="margin:0 0 10px 0;font-weight:600;">Reply to this email:</p>
              <ul style="margin:0;padding-left:20px;">
                <li><strong>APPROVE</strong> - Send my draft as-is</li>
                <li><strong>Edit the message</strong> - Send your version</li>
                <li><strong>REFUSE</strong> - Don't send anything</li>
              </ul>
            </div>

            <p style="font-size:12px;color:#666;margin-top:30px;padding-top:20px;border-top:1px solid #e0e0e0;">
              Processed immediately. No login needed.
            </p>

            <p style="font-size:14px;margin-top:20px;">Sam</p>
          </div>
        </div>
      `,
      TextBody: `Hi ${user.first_name},

${prospectName} from ${prospectCompany} replied:

"${email.TextBody}"

---
INTENT: ${intentInfo.label} (${confidence}% confidence)
TIP: ${intentInfo.tip}
---

My suggested response:

${reply.ai_suggested_response}

---

REPLY TO THIS EMAIL:
- Type "APPROVE" to send my draft as-is
- Edit the message to send your version
- Type "REFUSE" to not send anything

Sam`,
      MessageStream: 'outbound',
      Tag: 'reply-draft-notification',
      Metadata: {
        priority: 'urgent',
        replyId,
        intent,
        intentConfidence: confidence
      }
    })

    console.log(`📧 Draft notification sent: ${user.email} | Intent: ${intent} (${confidence}%)`)
  }
}

/**
 * Generate SAM AI response to user's email
 */
async function generateSAMEmailResponse(params: {
  threadId: string
  workspaceId: string
  userMessage: string
  userEmail: string
  userName: string
}) {
  const { threadId, workspaceId, userMessage, userEmail, userName } = params

  // Call SAM AI via internal API
  const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/api/sam/threads/${threadId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: userMessage,
      workspaceId: workspaceId,
      context: {
        source: 'email',
        userEmail,
        userName
      }
    })
  })

  if (!response.ok) {
    throw new Error(`SAM API error: ${response.statusText}`)
  }

  const data = await response.json()

  return {
    content: data.response || data.message || 'I received your message and will process it shortly.',
    model: data.model || 'claude-3.5-sonnet',
    tokensUsed: data.tokensUsed || 0
  }
}

/**
 * Send SAM's email reply to user
 */
async function sendSAMEmailReply(params: {
  to: string
  subject: string
  body: string
  userName: string
  threadId: string
  inReplyTo?: string
}) {
  const { ServerClient } = require('postmark')
  const postmark = new ServerClient(process.env.POSTMARK_INNOVAREAI_API_KEY!)

  const headers: Array<{ Name: string; Value: string }> = []

  if (params.inReplyTo) {
    headers.push({
      Name: 'In-Reply-To',
      Value: params.inReplyTo
    })
  }

  await postmark.sendEmail({
    From: 'Sam <hello@sam.innovareai.com>',
    To: params.to,
    Subject: params.subject,
    HtmlBody: `
      <p>Hi ${params.userName},</p>
      ${params.body.split('\n').map(p => `<p>${p}</p>`).join('\n')}
      <hr style="border:none;border-top:1px solid #eee;margin:30px 0;">
      <p style="color:#666;font-size:12px;">
        View this conversation in your dashboard:
        <a href="https://app.meet-sam.com/conversations/${params.threadId}">Open in SAM</a>
      </p>
      <p>Sam</p>
    `,
    TextBody: `Hi ${params.userName},\n\n${params.body}\n\n---\nView this conversation: https://app.meet-sam.com/conversations/${params.threadId}\n\nSam`,
    MessageStream: 'outbound',
    Tag: 'sam-email-reply',
    Headers: headers.length > 0 ? headers : undefined
  })
}

/**
 * Send response to unknown user
 */
async function sendUnknownUserResponse(to: string, subject: string) {
  const { ServerClient } = require('postmark')
  const postmark = new ServerClient(process.env.POSTMARK_INNOVAREAI_API_KEY!)

  await postmark.sendEmail({
    From: 'Sam <hello@sam.innovareai.com>',
    To: to,
    Subject: `Re: ${subject || 'Your message'}`,
    HtmlBody: `
      <p>Hi there,</p>
      <p>Thank you for reaching out! I don't have an account associated with <strong>${to}</strong> in my system.</p>
      <p>If you're interested in using SAM AI for B2B sales automation, you can:</p>
      <ul>
        <li><a href="https://app.meet-sam.com/signup">Sign up for a free account</a></li>
        <li><a href="https://innovareai.com">Learn more about SAM AI</a></li>
        <li>Reply to this email with questions and I'll help get you started</li>
      </ul>
      <p>Looking forward to working with you!</p>
      <p>Sam</p>
    `,
    MessageStream: 'outbound',
    Tag: 'unknown-user'
  })
}

/**
 * Send error response when SAM fails
 */
async function sendSAMErrorResponse(to: string, subject: string, userName: string) {
  const { ServerClient } = require('postmark')
  const postmark = new ServerClient(process.env.POSTMARK_INNOVAREAI_API_KEY!)

  await postmark.sendEmail({
    From: 'Sam <hello@sam.innovareai.com>',
    To: to,
    Subject: `Re: ${subject || 'Your request'}`,
    HtmlBody: `
      <p>Hi ${userName},</p>
      <p>I received your email but encountered a temporary issue processing it. My team has been notified and will look into this shortly.</p>
      <p>In the meantime, you can:</p>
      <ul>
        <li><a href="https://app.meet-sam.com">Access SAM directly in your dashboard</a></li>
        <li>Reply to this email to try again</li>
        <li>Contact support if this issue persists</li>
      </ul>
      <p>Apologies for the inconvenience!</p>
      <p>Sam</p>
    `,
    MessageStream: 'outbound',
    Tag: 'sam-error'
  })
}

/**
 * Generate draft response for campaign reply (HIGH PRIORITY)
 * This runs immediately when a prospect replies
 */
async function generateReplyDraft(replyId: string, context: { campaignId: string, prospectId: string }, email: PostmarkInboundEmail) {
  const supabase = getServiceClient()

  try {
    // Check if enhanced draft generation is enabled (feature flag)
    const useEnhancedDrafts = process.env.ENABLE_ENHANCED_REPLY_DRAFTS === 'true'

    if (useEnhancedDrafts) {
      // Use enhanced draft generation with web scraping
      await generateEnhancedReplyDraftWithScraping(replyId, context, email, supabase)
    } else {
      // Use basic draft generation (original implementation)
      await generateBasicReplyDraft(replyId, context, email, supabase)
    }

  } catch (error) {
    console.error('Failed to generate reply draft:', error)
    // Don't throw - this is non-critical, user can still respond manually
  }
}

/**
 * Enhanced draft generation with web scraping (NEW)
 */
async function generateEnhancedReplyDraftWithScraping(
  replyId: string,
  context: { campaignId: string, prospectId: string },
  email: PostmarkInboundEmail,
  supabase: any
) {
  console.log('🚀 Generating ENHANCED draft with web scraping:', replyId)

  // Import enhanced draft generation service
  const { generateEnhancedReplyDraft, saveEnhancedDraft } = await import('@/lib/services/reply-agent-draft-generation')

  // Get campaign and prospect context
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('name, message_template, workspace_id, metadata')
    .eq('id', context.campaignId)
    .single()

  const { data: prospect } = await supabase
    .from('workspace_prospects')
    .select('id, name, company, title, industry, notes, linkedin_url, company_website, metadata')
    .eq('id', context.prospectId)
    .single()

  if (!campaign || !prospect) {
    console.error('Missing campaign or prospect data for draft generation')
    return
  }

  // Build context for enhanced generation
  const draftContext = {
    replyId,
    prospectReply: email.TextBody,
    prospect: {
      id: prospect.id,
      name: prospect.name,
      title: prospect.title,
      company: prospect.company,
      company_website: prospect.company_website || prospect.metadata?.company_website,
      linkedin_url: prospect.linkedin_url,
      industry: prospect.industry,
      notes: prospect.notes
    },
    campaign: {
      id: campaign.id,
      name: campaign.name,
      message_template: campaign.message_template,
      products: campaign.metadata?.products || [],
      services: campaign.metadata?.services || [],
      value_props: campaign.metadata?.value_propositions || []
    },
    workspace_id: campaign.workspace_id
  }

  // Generate enhanced draft with scraping (pass supabase for calendar settings)
  const generatedDraft = await generateEnhancedReplyDraft(draftContext, supabase)

  // Save to database
  await saveEnhancedDraft(replyId, generatedDraft, supabase)

  console.log('✅ Enhanced draft generated with enrichment:', {
    replyId,
    sources_scraped: generatedDraft.enrichment_data.enrichment_metadata.sources_scraped,
    confidence_score: generatedDraft.confidence_score,
    matched_offers: generatedDraft.matched_offers
  })
}

/**
 * Basic draft generation with intent classification (UPGRADED)
 * Uses new intent classifier and full system prompt
 */
async function generateBasicReplyDraft(
  replyId: string,
  context: { campaignId: string, prospectId: string },
  email: PostmarkInboundEmail,
  supabase: any
) {
  console.log('🤖 Generating SAM draft response with intent classification:', replyId)

  // Import services
  const { classifyIntent } = await import('@/lib/services/intent-classifier')
  const { generateReplyDraft, getDefaultSettings } = await import('@/lib/services/reply-draft-generator')

  // Get campaign and prospect context
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, campaign_name, message_templates, workspace_id')
    .eq('id', context.campaignId)
    .single()

  const { data: prospect } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, company, title, linkedin_url')
    .eq('id', context.prospectId)
    .single()

  if (!campaign || !prospect) {
    console.error('Missing campaign or prospect data for draft generation')
    return
  }

  const prospectName = `${prospect.first_name} ${prospect.last_name}`.trim()
  const campaignName = campaign.campaign_name || campaign.name || 'Campaign'
  const originalOutreach = campaign.message_templates?.connection_request || ''

  // Step 1: Classify intent
  console.log('🎯 Classifying intent...')
  const intent = await classifyIntent(email.TextBody, {
    originalOutreach,
    prospectName,
    prospectCompany: prospect.company
  })
  console.log(`✅ Intent: ${intent.intent} (${(intent.confidence * 100).toFixed(0)}%)`)

  // Step 2: Update reply with intent
  await supabase
    .from('campaign_replies')
    .update({
      intent: intent.intent,
      intent_confidence: intent.confidence,
      intent_reasoning: intent.reasoning,
      reply_channel: 'email'
    })
    .eq('id', replyId)

  // Step 3: Get reply agent settings
  const { data: settings } = await supabase
    .from('reply_agent_settings')
    .select('*')
    .eq('workspace_id', campaign.workspace_id)
    .single()

  const agentSettings = settings || getDefaultSettings()

  // Step 4: Generate draft with full system prompt
  console.log('📝 Generating draft...')
  const draftResult = await generateReplyDraft({
    workspaceId: campaign.workspace_id,
    prospectReply: email.TextBody,
    prospect: {
      name: prospectName,
      role: prospect.title,
      company: prospect.company,
      linkedInUrl: prospect.linkedin_url
    },
    campaign: {
      name: campaignName,
      channel: 'email',
      goal: 'Book a call',
      originalOutreach
    },
    userName: 'SAM',
    settings: agentSettings
  })

  // Step 5: Save draft to database
  await supabase
    .from('campaign_replies')
    .update({
      ai_suggested_response: draftResult.draft,
      original_draft: draftResult.draft,
      draft_generated_at: new Date().toISOString(),
      metadata: {
        model: draftResult.metadata.model,
        tokens_used: draftResult.metadata.tokensUsed,
        generation_time_ms: draftResult.metadata.generationTimeMs,
        cheese_filter_passed: draftResult.metadata.cheeseFilterPassed,
        intent: intent.intent,
        intent_confidence: intent.confidence
      }
    })
    .eq('id', replyId)

  console.log('✅ Draft generated with intent classification:', {
    replyId,
    intent: intent.intent,
    confidence: intent.confidence,
    cheeseFilterPassed: draftResult.metadata.cheeseFilterPassed
  })
}

/**
 * Detect sentiment from email text (quick analysis)
 */
async function detectSentiment(text: string): Promise<'positive' | 'negative' | 'neutral'> {
  if (!text) return 'neutral'

  // Quick keyword-based sentiment detection for immediate classification
  const textLower = text.toLowerCase()

  const positiveKeywords = [
    'interested', 'sounds good', 'yes', 'please', 'great', 'perfect',
    'love', 'excited', 'definitely', 'absolutely', 'schedule', 'call',
    'meeting', 'demo', 'let\'s', 'when can', 'looking forward'
  ]

  const negativeKeywords = [
    'not interested', 'no thanks', 'unsubscribe', 'remove', 'stop',
    'never', 'spam', 'don\'t contact', 'not at this time', 'no longer'
  ]

  const positiveCount = positiveKeywords.filter(keyword => textLower.includes(keyword)).length
  const negativeCount = negativeKeywords.filter(keyword => textLower.includes(keyword)).length

  if (positiveCount > negativeCount && positiveCount > 0) {
    return 'positive'
  }

  if (negativeCount > positiveCount && negativeCount > 0) {
    return 'negative'
  }

  return 'neutral'
}

/**
 * Send confirmation to HITL after their action
 */
async function sendHITLConfirmation(to: string, data: { action: string, prospectName: string, message?: string }) {
  const { ServerClient } = require('postmark')
  const postmark = new ServerClient(process.env.POSTMARK_INNOVAREAI_API_KEY!)

  let subject = ''
  let body = ''

  if (data.action === 'approved') {
    subject = `✅ Message approved and queued for ${data.prospectName}`
    body = `
      <p>Perfect! I've queued your message to ${data.prospectName}.</p>
      <p>It will be sent within the next minute.</p>
      <p><strong>Message:</strong></p>
      <blockquote style="border-left:4px solid #8907FF;padding-left:16px;color:#666;">
        ${data.message?.replace(/\n/g, '<br>')}
      </blockquote>
      <p>Sam</p>
    `
  } else if (data.action === 'edited') {
    subject = `✅ Edited message queued for ${data.prospectName}`
    body = `
      <p>Got it! I've queued your edited message to ${data.prospectName}.</p>
      <p>It will be sent within the next minute.</p>
      <p><strong>Your message:</strong></p>
      <blockquote style="border-left:4px solid #8907FF;padding-left:16px;color:#666;">
        ${data.message?.replace(/\n/g, '<br>')}
      </blockquote>
      <p>Sam</p>
    `
  } else if (data.action === 'refused') {
    subject = `❌ No message will be sent to ${data.prospectName}`
    body = `
      <p>Understood. I won't send any response to ${data.prospectName}.</p>
      <p>Sam</p>
    `
  }

  await postmark.sendEmail({
    From: 'Sam <hello@sam.innovareai.com>',
    To: to,
    Subject: subject,
    HtmlBody: body,
    MessageStream: 'outbound',
    Tag: 'hitl-confirmation'
  })
}

/**
 * Queue message for sending via email or LinkedIn
 */
async function queueMessageForSending(params: {
  replyId: string
  prospectId: string
  campaignId: string
  channel: string
  message: string
  prospectEmail?: string
  prospectLinkedIn?: string
}) {
  const supabase = getServiceClient()

  // Get workspace_id from campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('workspace_id')
    .eq('id', params.campaignId)
    .single()

  if (!campaign) {
    throw new Error('Campaign not found')
  }

  // Create outbox record
  const { data: outboxMessage, error: outboxError } = await supabase
    .from('message_outbox')
    .insert({
      workspace_id: campaign.workspace_id,
      campaign_id: params.campaignId,
      prospect_id: params.prospectId,
      reply_id: params.replyId,
      channel: params.channel,
      message_content: params.message,
      status: 'queued',
      scheduled_send_time: new Date(Date.now() + 10000).toISOString(), // Send in 10 seconds
      metadata: {
        created_via: 'reply_agent_email',
        created_at: new Date().toISOString(),
        prospect_email: params.prospectEmail,
        prospect_linkedin: params.prospectLinkedIn
      }
    })
    .select()
    .single()

  if (outboxError) {
    console.error('Failed to create outbox record:', outboxError)
    throw new Error('Failed to queue message')
  }

  console.log('📦 Message queued for N8N:', outboxMessage.id)

  // N8N Integration Flow:
  // 1. N8N polls message_outbox for status='queued'
  // 2. N8N determines provider based on workspace tier:
  //    - Startup: N8N → Unipile (single email account)
  //    - SME/Enterprise: N8N → Unipile (replies use same account as receiving)
  // 3. For LinkedIn: N8N → Unipile
  // 4. N8N updates message_outbox status to 'sent' or 'failed'

  return {
    messageId: outboxMessage.id,
    scheduledSendTime: outboxMessage.scheduled_send_time
  }
}
