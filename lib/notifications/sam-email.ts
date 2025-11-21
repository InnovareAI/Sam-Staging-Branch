/**
 * SAM Email Notification System
 * Centralized email handling for SAM AI
 *
 * NOTE: Email functionality temporarily disabled for Vercel deployment
 */

// SAM's email configuration
export const SAM_EMAIL = {
  innovareai: 'SAM AI <sam@innovareai.com>',
  '3cubed': 'SAM AI <sam@3cubed.ai>'
}

// Get SAM email based on company
export function getSamEmail(company: 'innovareai' | '3cubed' = 'innovareai') {
  return SAM_EMAIL[company]
}

/**
 * Send approval notification when prospects are ready for review
 * STUBBED: Email functionality disabled
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
  console.log('[STUBBED] Would send approval notification to:', params.userEmail)
  // TODO: Re-enable when Postmark is configured
}

/**
 * Send notification when a prospect replies to outreach
 * STUBBED: Email functionality disabled
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
  console.log('[STUBBED] Would send reply notification to:', params.userEmail)
  // TODO: Re-enable when Postmark is configured
}

/**
 * Send campaign launch notification
 * STUBBED: Email functionality disabled
 */
export async function sendCampaignLaunchNotification(params: {
  userEmail: string
  userName: string
  campaignName: string
  campaignId: string
  prospectCount: number
  company?: 'innovareai' | '3cubed'
}) {
  console.log('[STUBBED] Would send campaign launch notification to:', params.userEmail)
  // TODO: Re-enable when Postmark is configured
}

/**
 * Send daily digest of campaign activity
 * STUBBED: Email functionality disabled
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
  console.log('[STUBBED] Would send daily digest to:', params.userEmail)
  // TODO: Re-enable when Postmark is configured
}
