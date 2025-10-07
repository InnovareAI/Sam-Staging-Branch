/**
 * SAM Email Notification System
 * Centralized email handling for SAM AI
 */

import { ServerClient } from 'postmark'

const postmark = new ServerClient(process.env.POSTMARK_INNOVAREAI_API_KEY!)

// SAM's email configuration
export const SAM_EMAIL = {
  innovareai: 'SAM AI <sam@innovareai.com>',
  '3cubed': 'SAM AI <sam@3cubed.ai>'
}

// Get SAM email based on company
export function getSamEmail(company: 'innovareai' | '3cubed' = 'innovareai') {
  return SAM_EMAIL[company]
}

// Helper: Generate personalized greeting based on reminder type
function getGreetingByReminderType(reminderType: 'initial' | 'morning' | 'evening', userName: string): string {
  switch (reminderType) {
    case 'morning':
      return `Good morning, ${userName}! 🌅`
    case 'evening':
      return `Hey ${userName}! 🌆`
    default:
      return `Hi ${userName}! 👋`
  }
}

// Helper: Generate contextual message based on reminder type
function getContextualMessage(reminderType: 'initial' | 'morning' | 'evening', prospectCount: number, campaignName: string): string {
  switch (reminderType) {
    case 'morning':
      return `As we discussed yesterday, I've found <strong>${prospectCount} qualified prospects</strong> for your <strong>"${campaignName}"</strong> campaign. They're still waiting for your review!`
    case 'evening':
      return `Following up on this morning's message — <strong>${prospectCount} prospects</strong> are ready for review in your <strong>"${campaignName}"</strong> campaign. Quick 5-minute approval gets them into your pipeline.`
    default:
      return `I've found <strong>${prospectCount} qualified prospects</strong> for your <strong>"${campaignName}"</strong> campaign.`
  }
}

/**
 * Send approval notification when prospects are ready for review
 */
export async function sendApprovalNotification(params: {
  userEmail: string
  userName: string
  sessionId: string
  prospectCount: number
  campaignName: string
  company?: 'innovareai' | '3cubed'
  reminderType?: 'initial' | 'morning' | 'evening'
}) {
  const approvalUrl = `https://app.meet-sam.com/approve?session=${params.sessionId}`

  // Personalize greeting based on reminder type
  const greeting = getGreetingByReminderType(params.reminderType || 'initial', params.userName)

  await postmark.sendEmail({
    From: getSamEmail(params.company),
    To: params.userEmail,
    Subject: `🎯 ${params.prospectCount} Prospects Ready for Review - "${params.campaignName}"`,
    HtmlBody: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
          }
          .prospect-box {
            background: #f0f9ff;
            border: 1px solid #0ea5e9;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
          }
          .quick-actions {
            background: #f9fafb;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>${greeting}</h2>

          <p>${getContextualMessage(params.reminderType || 'initial', params.prospectCount, params.campaignName)}</p>

          <div class="prospect-box">
            <p style="margin:0;"><strong>📊 Ready for Review:</strong></p>
            <p style="margin:8px 0 0 0;color:#0369a1;">${params.prospectCount} prospects match your ICP criteria</p>
          </div>

          <p style="text-align:center;">
            <a href="${approvalUrl}" class="button">👀 Review Prospects Now</a>
          </p>

          <div class="quick-actions">
            <p style="margin:0 0 8px 0;"><strong>⚡ Quick Actions (reply to this email):</strong></p>
            <ul style="margin:8px 0;">
              <li>Reply <strong>"APPROVE ALL"</strong> to approve everyone</li>
              <li>Reply <strong>"REVIEW"</strong> to see them first</li>
              <li>Reply <strong>"SKIP"</strong> to review later</li>
            </ul>
          </div>

          <p style="color:#666;font-size:14px;">⏱️ <strong>Time estimate:</strong> 3-5 minutes to review</p>

          <p style="margin-top:32px;">Best,<br><strong>SAM</strong></p>
        </div>
      </body>
      </html>
    `,
    TextBody: `Hi ${params.userName}!

I've found ${params.prospectCount} qualified prospects for your "${params.campaignName}" campaign.

Review them here: ${approvalUrl}

Quick Actions (reply to this email):
- Reply "APPROVE ALL" to approve everyone
- Reply "REVIEW" to see them first
- Reply "SKIP" to review later

Time estimate: 3-5 minutes

Best,
SAM`,
    ReplyTo: `sam+approval-${params.sessionId}@innovareai.com`,
    MessageStream: 'outbound',
    Tag: 'sam-approval-notification'
  })
}

/**
 * Send notification when a prospect replies to outreach
 */
export async function sendReplyNotification(params: {
  userEmail: string
  userName: string
  prospectName: string
  prospectCompany: string
  replyText: string
  campaignId: string
  prospectId: string
  company?: 'innovareai' | '3cubed'
}) {
  const replyUrl = `https://app.meet-sam.com/replies/${params.campaignId}/${params.prospectId}`

  await postmark.sendEmail({
    From: getSamEmail(params.company),
    To: params.userEmail,
    Subject: `💬 ${params.prospectName} replied to your outreach!`,
    HtmlBody: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
          }
          .reply-box {
            background: #f9fafb;
            border-left: 4px solid #8907FF;
            padding: 16px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .prospect-info {
            background: #f0f9ff;
            border-radius: 8px;
            padding: 12px;
            margin: 16px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Great news, ${params.userName}! 🎉</h2>

          <div class="prospect-info">
            <p style="margin:0;"><strong>${params.prospectName}</strong> from ${params.prospectCompany} replied to your message</p>
          </div>

          <div class="reply-box">
            <p style="margin:0 0 8px 0;color:#666;font-size:14px;">Their message:</p>
            <p style="margin:0;color:#111;">${params.replyText}</p>
          </div>

          <p style="text-align:center;">
            <a href="${replyUrl}" class="button">View & Respond</a>
          </p>

          <p style="color:#666;font-size:14px;">💡 <strong>Tip:</strong> I can help you draft a response. Just ask me in the thread!</p>

          <p style="margin-top:32px;">Best,<br><strong>SAM</strong></p>
        </div>
      </body>
      </html>
    `,
    TextBody: `Great news, ${params.userName}!

${params.prospectName} from ${params.prospectCompany} replied to your message:

"${params.replyText}"

View and respond here: ${replyUrl}

Tip: I can help you draft a response. Just ask me in the thread!

Best,
SAM`,
    ReplyTo: `sam+reply-${params.campaignId}-${params.prospectId}@innovareai.com`,
    MessageStream: 'outbound',
    Tag: 'sam-reply-notification'
  })
}

/**
 * Send campaign launch notification
 */
export async function sendCampaignLaunchNotification(params: {
  userEmail: string
  userName: string
  campaignName: string
  campaignId: string
  prospectCount: number
  company?: 'innovareai' | '3cubed'
}) {
  const dashboardUrl = `https://app.meet-sam.com/campaigns/${params.campaignId}`

  await postmark.sendEmail({
    From: getSamEmail(params.company),
    To: params.userEmail,
    Subject: `🚀 Campaign "${params.campaignName}" is Live!`,
    HtmlBody: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
          }
          .stats-box {
            background: linear-gradient(135deg, #10b98120 0%, #05966920 100%);
            border: 2px solid #10b981;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>🎉 Your Campaign is Live, ${params.userName}!</h2>

          <div class="stats-box">
            <h3 style="margin:0 0 8px 0;color:#059669;">Campaign: ${params.campaignName}</h3>
            <p style="margin:0;font-size:32px;font-weight:bold;color:#047857;">${params.prospectCount}</p>
            <p style="margin:4px 0 0 0;color:#065f46;">prospects contacted</p>
          </div>

          <p>Your outreach messages are being sent. I'll notify you when you get replies!</p>

          <p style="text-align:center;">
            <a href="${dashboardUrl}" class="button">📊 View Campaign Dashboard</a>
          </p>

          <p style="color:#666;font-size:14px;">
            <strong>What happens next:</strong><br>
            • Messages sent over the next 24-48 hours<br>
            • You'll get notified of replies<br>
            • I'll track engagement and optimize timing
          </p>

          <p style="margin-top:32px;">Best,<br><strong>SAM</strong></p>
        </div>
      </body>
      </html>
    `,
    TextBody: `🎉 Your Campaign is Live, ${params.userName}!

Campaign: ${params.campaignName}
Prospects contacted: ${params.prospectCount}

Your outreach messages are being sent. I'll notify you when you get replies!

View dashboard: ${dashboardUrl}

What happens next:
• Messages sent over the next 24-48 hours
• You'll get notified of replies
• I'll track engagement and optimize timing

Best,
SAM`,
    MessageStream: 'outbound',
    Tag: 'sam-campaign-launch'
  })
}

/**
 * Send daily digest of campaign activity
 */
export async function sendDailyDigest(params: {
  userEmail: string
  userName: string
  stats: {
    messagesSent: number
    repliesReceived: number
    meetingsBooked: number
    activeCampaigns: number
  }
  company?: 'innovareai' | '3cubed'
}) {
  await postmark.sendEmail({
    From: getSamEmail(params.company),
    To: params.userEmail,
    Subject: `📊 Your SAM Daily Digest - ${new Date().toLocaleDateString()}`,
    HtmlBody: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin: 20px 0;
          }
          .stat-card {
            background: #f9fafb;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
          }
          .stat-number {
            font-size: 32px;
            font-weight: bold;
            color: #8907FF;
            margin: 8px 0;
          }
          .stat-label {
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Good morning, ${params.userName}! ☀️</h2>

          <p>Here's what happened yesterday with your campaigns:</p>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-number">${params.stats.messagesSent}</div>
              <div class="stat-label">Messages Sent</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${params.stats.repliesReceived}</div>
              <div class="stat-label">Replies Received</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${params.stats.meetingsBooked}</div>
              <div class="stat-label">Meetings Booked</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${params.stats.activeCampaigns}</div>
              <div class="stat-label">Active Campaigns</div>
            </div>
          </div>

          <p><a href="https://app.meet-sam.com" style="color:#8907FF;">View Full Dashboard →</a></p>

          <p style="margin-top:32px;">Best,<br><strong>SAM</strong></p>
        </div>
      </body>
      </html>
    `,
    MessageStream: 'outbound',
    Tag: 'sam-daily-digest'
  })
}
