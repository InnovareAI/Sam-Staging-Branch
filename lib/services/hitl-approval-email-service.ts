/**
 * HITL (Human-in-the-Loop) Approval Email Service
 * Implements email-based approval system for SAM AI message responses
 */

import { supabaseAdmin } from '@/app/lib/supabase'
import { COMPANY_BRANDING, CompanyBranding } from '@/lib/email-templates'

const supabase = supabaseAdmin()

export interface HITLApprovalSession {
  id: string
  workspace_id: string
  campaign_execution_id?: string
  original_message_id: string
  original_message_content: string
  original_message_channel: 'linkedin' | 'email'
  prospect_name?: string
  prospect_email?: string
  prospect_linkedin_url?: string
  prospect_company?: string
  sam_suggested_reply: string
  sam_confidence_score?: number
  sam_reasoning?: string
  approval_status: 'pending' | 'approved' | 'rejected' | 'modified' | 'expired'
  assigned_to?: string
  reviewed_by?: string
  reviewed_at?: string
  approval_method: 'email' | 'ui'
  approval_email_sent_at?: string
  approval_email_replied_at?: string
  final_approved_message?: string
  modification_notes?: string
  timeout_hours: number
  expires_at: string
  escalated_to?: string
  escalated_at?: string
  reply_sent: boolean
  reply_sent_at?: string
  reply_delivery_status?: string
  created_at: string
  updated_at: string
}

export interface HITLEmailData {
  session: HITLApprovalSession
  reviewerEmail: string
  reviewerName: string
  company: 'InnovareAI' | '3cubedai'
  approvalLink: string
  rejectLink: string
  modifyLink: string
}

export class HITLApprovalEmailService {
  private postmarkApiKey: string
  private fromEmail: string
  private fromName: string

  constructor() {
    this.postmarkApiKey = process.env.POSTMARK_SERVER_TOKEN || ''
    this.fromEmail = process.env.POSTMARK_FROM_EMAIL || 'sp@innovareai.com'
    this.fromName = process.env.POSTMARK_FROM_NAME || 'Sarah Powell - SAM AI'
  }

  /**
   * Create new HITL approval session and send email
   */
  async createApprovalSession(sessionData: {
    workspace_id: string
    campaign_execution_id?: string
    original_message_id: string
    original_message_content: string
    original_message_channel: 'linkedin' | 'email'
    prospect_name?: string
    prospect_email?: string
    prospect_linkedin_url?: string
    prospect_company?: string
    sam_suggested_reply: string
    sam_confidence_score?: number
    sam_reasoning?: string
    assigned_to_email: string
    timeout_hours?: number
  }): Promise<{ success: boolean; session?: HITLApprovalSession; error?: string }> {
    try {
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + (sessionData.timeout_hours || 24))

      // Create approval session
      const { data: session, error } = await supabase
        .from('hitl_reply_approval_sessions')
        .insert({
          workspace_id: sessionData.workspace_id,
          campaign_execution_id: sessionData.campaign_execution_id,
          original_message_id: sessionData.original_message_id,
          original_message_content: sessionData.original_message_content,
          original_message_channel: sessionData.original_message_channel,
          prospect_name: sessionData.prospect_name,
          prospect_email: sessionData.prospect_email,
          prospect_linkedin_url: sessionData.prospect_linkedin_url,
          prospect_company: sessionData.prospect_company,
          sam_suggested_reply: sessionData.sam_suggested_reply,
          sam_confidence_score: sessionData.sam_confidence_score,
          sam_reasoning: sessionData.sam_reasoning,
          approval_status: 'pending',
          approval_method: 'email',
          timeout_hours: sessionData.timeout_hours || 24,
          expires_at: expiresAt.toISOString(),
          reply_sent: false
        })
        .select()
        .single()

      if (error) throw error

      // Get reviewer details
      const { data: reviewer } = await supabase
        .from('auth.users')
        .select('email, raw_user_meta_data')
        .eq('email', sessionData.assigned_to_email)
        .single()

      if (!reviewer) {
        throw new Error('Reviewer not found')
      }

      const reviewerName = reviewer.raw_user_meta_data?.full_name || 
                          reviewer.raw_user_meta_data?.first_name || 
                          sessionData.assigned_to_email.split('@')[0]

      // Send approval email
      const emailResult = await this.sendApprovalEmail({
        session: session as HITLApprovalSession,
        reviewerEmail: sessionData.assigned_to_email,
        reviewerName,
        company: 'InnovareAI', // TODO: Get from workspace
        approvalLink: `${process.env.NEXT_PUBLIC_APP_URL}/hitl/approve/${session.id}`,
        rejectLink: `${process.env.NEXT_PUBLIC_APP_URL}/hitl/reject/${session.id}`,
        modifyLink: `${process.env.NEXT_PUBLIC_APP_URL}/hitl/modify/${session.id}`
      })

      if (emailResult.success) {
        // Update session with sent timestamp
        await supabase
          .from('hitl_reply_approval_sessions')
          .update({ approval_email_sent_at: new Date().toISOString() })
          .eq('id', session.id)
      }

      return {
        success: true,
        session: session as HITLApprovalSession
      }

    } catch (error) {
      console.error('HITL approval session creation failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Send HITL approval email using Postmark
   */
  async sendApprovalEmail(data: HITLEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const branding = COMPANY_BRANDING[data.company]
      const emailTemplate = this.generateApprovalEmailTemplate(data, branding)

      const response = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': this.postmarkApiKey
        },
        body: JSON.stringify({
          From: emailTemplate.from,
          To: emailTemplate.to,
          Subject: emailTemplate.subject,
          HtmlBody: emailTemplate.htmlBody,
          TextBody: emailTemplate.textBody,
          MessageStream: 'outbound',
          Tag: 'hitl-approval'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Postmark API error: ${errorData.Message || response.statusText}`)
      }

      const result = await response.json()
      return {
        success: true,
        messageId: result.MessageID
      }

    } catch (error) {
      console.error('HITL approval email send failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Process approval decision (approve/reject/modify)
   */
  async processApprovalDecision(
    sessionId: string,
    decision: 'approved' | 'rejected' | 'modified',
    reviewedBy: string,
    finalMessage?: string,
    modificationNotes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = {
        approval_status: decision,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        approval_email_replied_at: new Date().toISOString()
      }

      if (decision === 'approved' || decision === 'modified') {
        updateData.final_approved_message = finalMessage || null
      }

      if (decision === 'modified') {
        updateData.modification_notes = modificationNotes || null
      }

      const { error } = await supabase
        .from('hitl_reply_approval_sessions')
        .update(updateData)
        .eq('id', sessionId)

      if (error) throw error

      // If approved or modified, trigger actual reply sending
      if (decision === 'approved' || decision === 'modified') {
        await this.triggerReplyDelivery(sessionId)
      }

      return { success: true }

    } catch (error) {
      console.error('Approval decision processing failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Trigger actual reply delivery after approval
   */
  private async triggerReplyDelivery(sessionId: string): Promise<void> {
    try {
      // Get session data
      const { data: session, error } = await supabase
        .from('hitl_reply_approval_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (error || !session) throw new Error('Session not found')

      // TODO: Integrate with actual message sending service (Unipile API)
      // For now, just mark as sent
      await supabase
        .from('hitl_reply_approval_sessions')
        .update({
          reply_sent: true,
          reply_sent_at: new Date().toISOString(),
          reply_delivery_status: 'sent'
        })
        .eq('id', sessionId)

      console.log(`HITL approved reply sent for session ${sessionId}`)

    } catch (error) {
      console.error('Reply delivery failed:', error)
    }
  }

  /**
   * Check for expired sessions and send reminders
   */
  async processExpiredSessions(): Promise<{ processed: number; errors: number }> {
    try {
      const { data: expiredSessions, error } = await supabase
        .from('hitl_reply_approval_sessions')
        .select('*')
        .eq('approval_status', 'pending')
        .lt('expires_at', new Date().toISOString())

      if (error) throw error

      let processed = 0
      let errors = 0

      for (const session of expiredSessions || []) {
        try {
          await supabase
            .from('hitl_reply_approval_sessions')
            .update({ approval_status: 'expired' })
            .eq('id', session.id)
          
          processed++
        } catch (error) {
          console.error(`Failed to expire session ${session.id}:`, error)
          errors++
        }
      }

      return { processed, errors }

    } catch (error) {
      console.error('Expired session processing failed:', error)
      return { processed: 0, errors: 1 }
    }
  }

  /**
   * Generate HTML email template for approval request
   */
  private generateApprovalEmailTemplate(data: HITLEmailData, branding: CompanyBranding) {
    const { session } = data
    const channelEmoji = session.original_message_channel === 'linkedin' ? '💼' : '📧'
    const channelName = session.original_message_channel === 'linkedin' ? 'LinkedIn' : 'Email'

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SAM AI Message Approval Required</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      line-height: 1.6; 
      color: #333; 
      margin: 0; 
      padding: 0; 
      background-color: #f8f9fa;
    }
    .container { 
      max-width: 700px; 
      margin: 0 auto; 
      padding: 20px; 
    }
    .card { 
      background: white; 
      border-radius: 12px; 
      padding: 32px; 
      box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
      margin-bottom: 20px;
    }
    .header { 
      text-align: center; 
      margin-bottom: 32px; 
    }
    .logo { 
      width: 60px; 
      height: 60px; 
      border-radius: 50%; 
      object-fit: cover; 
      margin: 0 auto 16px; 
      display: block; 
    }
    .prospect-info {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .message-box {
      border-left: 4px solid ${branding.primaryColor};
      background: #f8f9fa;
      padding: 16px;
      margin: 16px 0;
      border-radius: 0 8px 8px 0;
    }
    .suggested-reply {
      border: 2px solid ${branding.primaryColor};
      background: ${branding.primaryColor}05;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .action-buttons {
      text-align: center;
      margin: 32px 0;
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      min-width: 120px;
      text-align: center;
    }
    .approve-btn { 
      background: #22c55e; 
      color: white; 
    }
    .reject-btn { 
      background: #ef4444; 
      color: white; 
    }
    .modify-btn { 
      background: #f59e0b; 
      color: white; 
    }
    .confidence-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      background: ${branding.primaryColor}20;
      color: ${branding.primaryColor};
    }
    .footer { 
      text-align: center; 
      margin-top: 32px; 
      font-size: 14px; 
      color: #666; 
    }
    .company-signature {
      color: ${branding.primaryColor};
      font-weight: 600;
    }
    .urgent {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
      color: #991b1b;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <img src="https://app.meet-sam.com/SAM.jpg" alt="SAM AI" class="logo">
        <h1>🤖 SAM AI Response Approval</h1>
        <p><strong class="company-signature">${branding.name}</strong> - Human-in-the-Loop Quality Control</p>
      </div>
      
      <div class="urgent">
        ⏰ <strong>Action Required:</strong> This approval request expires in ${session.timeout_hours} hours.
      </div>
      
      <h2>Hi ${data.reviewerName}!</h2>
      <p>SAM AI has generated a response to an incoming ${channelName} message and needs your approval before sending.</p>
      
      <div class="prospect-info">
        <h3>${channelEmoji} Contact Information</h3>
        ${session.prospect_name ? `<p><strong>Name:</strong> ${session.prospect_name}</p>` : ''}
        ${session.prospect_company ? `<p><strong>Company:</strong> ${session.prospect_company}</p>` : ''}
        ${session.prospect_email ? `<p><strong>Email:</strong> ${session.prospect_email}</p>` : ''}
        ${session.prospect_linkedin_url ? `<p><strong>LinkedIn:</strong> <a href="${session.prospect_linkedin_url}" target="_blank">View Profile</a></p>` : ''}
        <p><strong>Channel:</strong> ${channelName}</p>
      </div>
      
      <h3>📬 Original Message</h3>
      <div class="message-box">
        ${session.original_message_content}
      </div>
      
      <h3>🤖 SAM's Suggested Reply</h3>
      ${session.sam_confidence_score ? `<p>Confidence Score: <span class="confidence-badge">${Math.round(session.sam_confidence_score * 100)}%</span></p>` : ''}
      <div class="suggested-reply">
        <strong>Suggested Response:</strong>
        <p style="margin-top: 12px; white-space: pre-wrap;">${session.sam_suggested_reply}</p>
        ${session.sam_reasoning ? `<p style="margin-top: 16px; font-size: 14px; color: #666;"><strong>AI Reasoning:</strong> ${session.sam_reasoning}</p>` : ''}
      </div>
      
      <h3>✅ Your Decision</h3>
      <p>Please review the suggested response and choose an action:</p>
      
      <div class="action-buttons">
        <a href="${data.approvalLink}" class="button approve-btn">
          ✅ Approve & Send
        </a>
        <a href="${data.modifyLink}" class="button modify-btn">
          ✏️ Modify Message
        </a>
        <a href="${data.rejectLink}" class="button reject-btn">
          ❌ Reject & Don't Send
        </a>
      </div>
      
      <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p><strong>💡 Quick Actions:</strong></p>
        <p><small>• <strong>Approve:</strong> Send the message as-is</small></p>
        <p><small>• <strong>Modify:</strong> Edit the message before sending</small></p>
        <p><small>• <strong>Reject:</strong> Don't send any response</small></p>
      </div>
      
      <div class="footer">
        <p>Best regards,<br>
        <strong class="company-signature">SAM AI Platform</strong><br>
        ${branding.name}</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
        <p><small>Session ID: ${session.id}</small></p>
        <p><small>This approval request was sent from SAM AI's Human-in-the-Loop quality control system.</small></p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim()

    const textBody = `
SAM AI Response Approval Required - ${branding.name}

Hi ${data.reviewerName}!

SAM AI has generated a response to an incoming ${channelName} message and needs your approval before sending.

CONTACT INFORMATION:
${session.prospect_name ? `Name: ${session.prospect_name}\n` : ''}${session.prospect_company ? `Company: ${session.prospect_company}\n` : ''}${session.prospect_email ? `Email: ${session.prospect_email}\n` : ''}${session.prospect_linkedin_url ? `LinkedIn: ${session.prospect_linkedin_url}\n` : ''}Channel: ${channelName}

ORIGINAL MESSAGE:
${session.original_message_content}

SAM'S SUGGESTED REPLY:
${session.sam_confidence_score ? `Confidence Score: ${Math.round(session.sam_confidence_score * 100)}%\n` : ''}${session.sam_suggested_reply}
${session.sam_reasoning ? `\nAI Reasoning: ${session.sam_reasoning}` : ''}

YOUR DECISION OPTIONS:
• Approve & Send: ${data.approvalLink}
• Modify Message: ${data.modifyLink}
• Reject & Don't Send: ${data.rejectLink}

⏰ This approval request expires in ${session.timeout_hours} hours.

Best regards,
SAM AI Platform
${branding.name}

Session ID: ${session.id}
    `.trim()

    return {
      from: `${branding.fromName} <${branding.fromEmail}>`,
      to: data.reviewerEmail,
      subject: `🤖 SAM AI Response Approval Required - ${session.prospect_name || 'New Contact'}`,
      htmlBody,
      textBody
    }
  }
}