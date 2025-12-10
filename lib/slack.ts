/**
 * Slack Integration Service
 * Send notifications to Slack channels via webhooks
 */

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

interface SlackMessage {
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  channel?: string;
  username?: string;
  icon_emoji?: string;
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: any[];
  accessory?: any;
}

interface SlackAttachment {
  color?: string;
  title?: string;
  text?: string;
  fields?: { title: string; value: string; short?: boolean }[];
  footer?: string;
  ts?: number;
}

class SlackService {
  private webhookUrl: string | null = null;

  private initialize() {
    if (!this.webhookUrl) {
      this.webhookUrl = process.env.SLACK_WEBHOOK_URL || null;
    }
  }

  async sendMessage(message: SlackMessage): Promise<{ success: boolean; error?: string }> {
    this.initialize();

    if (!this.webhookUrl) {
      console.warn('SLACK_WEBHOOK_URL not configured');
      return { success: false, error: 'Slack webhook not configured' };
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Slack API error:', error);
        return { success: false, error };
      }

      return { success: true };
    } catch (error) {
      console.error('Slack send failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Quick notification helpers
  async notifyNewLead(name: string, source: string, intent?: string) {
    return this.sendMessage({
      text: `🎯 New Lead: ${name}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: '🎯 New Lead', emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: `*${name}*\nSource: ${source}${intent ? `\nIntent: ${intent}` : ''}` } },
      ],
    });
  }

  async notifyReplyReceived(prospectName: string, campaignName: string, preview: string) {
    return this.sendMessage({
      text: `💬 Reply from ${prospectName}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: '💬 New Reply', emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: `*${prospectName}* replied to *${campaignName}*` } },
        { type: 'section', text: { type: 'mrkdwn', text: `> ${preview.slice(0, 200)}${preview.length > 200 ? '...' : ''}` } },
      ],
    });
  }

  async notifyCommentPending(postAuthor: string, commentPreview: string, approveUrl: string) {
    return this.sendMessage({
      text: `📝 Comment pending approval`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: '📝 Comment Pending', emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: `Post by *${postAuthor}*` } },
        { type: 'section', text: { type: 'mrkdwn', text: `> ${commentPreview.slice(0, 150)}...` } },
        { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Review' }, url: approveUrl, style: 'primary' }] },
      ],
    });
  }

  async notifyCampaignUpdate(campaignName: string, status: string, stats?: { sent?: number; accepted?: number; replied?: number }) {
    const statsText = stats ? `\nSent: ${stats.sent || 0} | Accepted: ${stats.accepted || 0} | Replied: ${stats.replied || 0}` : '';
    return this.sendMessage({
      text: `📊 Campaign: ${campaignName} - ${status}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: '📊 Campaign Update', emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: `*${campaignName}*\nStatus: ${status}${statsText}` } },
      ],
    });
  }

  async notifyError(source: string, errorMessage: string) {
    return this.sendMessage({
      text: `🚨 Error in ${source}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: '🚨 Error Alert', emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: `*Source:* ${source}\n*Error:* ${errorMessage}` } },
      ],
    });
  }
}

export const slackService = new SlackService();
