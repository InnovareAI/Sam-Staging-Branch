/**
 * Postmark Inbound Webhook Handler
 * Processes incoming emails to SAM and triggers appropriate actions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@supabase/supabase-js'

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
    const email: PostmarkInboundEmail = await request.json()

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
  // Format: reply-{campaignId}-{prospectId}
  if (mailboxHash?.startsWith('reply-')) {
    const [, campaignId, prospectId] = mailboxHash.split('-')
    return {
      type: 'campaign-reply' as const,
      campaignId,
      prospectId
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
 * Handle campaign reply forwards
 */
async function handleCampaignReply(email: PostmarkInboundEmail, context: { campaignId: string, prospectId: string }, emailId: string) {
  // Store the reply in the database for HITL review
  const supabase = getServiceClient()

  await supabase
    .from('campaign_replies')
    .insert({
      campaign_id: context.campaignId,
      prospect_id: context.prospectId,
      reply_text: email.TextBody,
      reply_html: email.HtmlBody,
      received_at: new Date().toISOString(),
      requires_review: true
    })

  // Notify the user
  await notifyUserOfReply(email, context)

  console.log('✅ Stored campaign reply for review:', {
    campaignId: context.campaignId,
    prospectId: context.prospectId
  })
}

/**
 * Handle general messages to SAM
 */
async function handleGeneralMessage(email: PostmarkInboundEmail, emailId: string) {
  // Could forward to support, store in inbox, etc.
  console.log('📨 General message to SAM:', {
    from: email.From,
    subject: email.Subject
  })
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
 * Notify user of campaign reply
 */
async function notifyUserOfReply(email: PostmarkInboundEmail, context: { campaignId: string, prospectId: string }) {
  const supabase = getServiceClient()

  // Get prospect and campaign details
  const { data: prospect } = await supabase
    .from('workspace_prospects')
    .select('name, company')
    .eq('id', context.prospectId)
    .single()

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('name, workspace_id')
    .eq('id', context.campaignId)
    .single()

  if (!prospect || !campaign) return

  // Get workspace owner
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('owner_id')
    .eq('id', campaign.workspace_id)
    .single()

  if (!workspace) return

  const { data: owner } = await supabase
    .from('users')
    .select('email, first_name')
    .eq('id', workspace.owner_id)
    .single()

  if (!owner) return

  // Send notification
  const { ServerClient } = require('postmark')
  const postmark = new ServerClient(process.env.POSTMARK_INNOVAREAI_API_KEY!)

  await postmark.sendEmail({
    From: 'Sam <hello@sam.innovareai.com>',
    To: owner.email,
    Subject: `💬 ${prospect.name} replied to your outreach`,
    HtmlBody: `
      <p>Hi ${owner.first_name},</p>
      <p><strong>${prospect.name}</strong> from ${prospect.company} replied:</p>
      <blockquote style="border-left:4px solid #8907FF;padding-left:16px;color:#666;margin:20px 0;">
        ${email.HtmlBody || email.TextBody}
      </blockquote>
      <p><a href="https://app.meet-sam.com/replies/${context.campaignId}/${context.prospectId}"
         style="background:#8907FF;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">
        View & Respond
      </a></p>
      <p>Sam</p>
    `,
    MessageStream: 'outbound',
    Tag: 'reply-notification'
  })
}
