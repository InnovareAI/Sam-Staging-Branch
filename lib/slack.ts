/**
 * Slack Integration Service
 * Full two-way communication with Slack via Bot API
 *
 * Features:
 * - Send notifications (outbound via webhooks or Bot API)
 * - Receive messages (inbound via Events API)
 * - Interactive buttons (approve/reject flows)
 * - Thread replies (conversation threading)
 * - Channel management
 *
 * KILL SWITCH: Set PAUSE_NOTIFICATIONS=true to disable ALL notifications
 */

import { supabaseAdmin } from '@/app/lib/supabase';

// Global kill switch - set PAUSE_NOTIFICATIONS=true to pause all notifications
const NOTIFICATIONS_PAUSED = process.env.PAUSE_NOTIFICATIONS === 'true';

// ============================================================================
// TYPES
// ============================================================================

interface SlackMessage {
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  channel?: string;
  thread_ts?: string;
  username?: string;
  icon_emoji?: string;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
}

interface SlackBlock {
  type: string;
  block_id?: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: SlackElement[];
  accessory?: SlackElement;
  fields?: { type: string; text: string }[];
}

interface SlackElement {
  type: string;
  action_id?: string;
  text?: { type: string; text: string; emoji?: boolean };
  value?: string;
  url?: string;
  style?: 'primary' | 'danger';
  confirm?: SlackConfirm;
}

interface SlackConfirm {
  title: { type: string; text: string };
  text: { type: string; text: string };
  confirm: { type: string; text: string };
  deny: { type: string; text: string };
}

interface SlackAttachment {
  color?: string;
  title?: string;
  text?: string;
  fields?: { title: string; value: string; short?: boolean }[];
  footer?: string;
  ts?: number;
}

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  ts?: string;
  channel?: string;
  message?: any;
}

interface SlackAppConfig {
  bot_token: string;
  signing_secret?: string;
  team_id?: string;
  team_name?: string;
}

// ============================================================================
// SLACK SERVICE CLASS
// ============================================================================

class SlackService {
  private webhookUrl: string | null = null;

  private initialize() {
    if (!this.webhookUrl) {
      this.webhookUrl = process.env.SLACK_WEBHOOK_URL || null;
    }
  }

  // ==========================================================================
  // BOT API METHODS (for two-way communication)
  // ==========================================================================

  /**
   * Get Slack app config for a workspace
   */
  async getAppConfig(workspaceId: string): Promise<SlackAppConfig | null> {
    const { data, error } = await supabaseAdmin()
      .from('slack_app_config')
      .select('bot_token, signing_secret, slack_team_id, slack_team_name')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .single();

    if (error || !data?.bot_token) {
      return null;
    }

    return {
      bot_token: data.bot_token,
      signing_secret: data.signing_secret,
      team_id: data.slack_team_id,
      team_name: data.slack_team_name,
    };
  }

  /**
   * Send a message using the Slack Bot API
   */
  async sendBotMessage(
    workspaceId: string,
    channel: string,
    message: SlackMessage
  ): Promise<{ success: boolean; ts?: string; error?: string }> {
    // Kill switch - skip all notifications when paused
    if (NOTIFICATIONS_PAUSED) {
      console.log('⏸️ Notifications paused (PAUSE_NOTIFICATIONS=true) - skipping Slack Bot message');
      return { success: true, error: 'Notifications paused' };
    }

    const config = await this.getAppConfig(workspaceId);
    if (!config) {
      return { success: false, error: 'Slack not configured for this workspace' };
    }

    try {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.bot_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel,
          ...message,
        }),
      });

      const result: SlackApiResponse = await response.json();

      if (!result.ok) {
        console.error('Slack Bot API error:', result.error);
        return { success: false, error: result.error };
      }

      // Log the outbound message
      await this.logMessage(workspaceId, {
        channel_id: channel,
        message_ts: result.ts!,
        direction: 'outbound',
        sender_type: 'sam',
        content: message.text || JSON.stringify(message.blocks),
      });

      return { success: true, ts: result.ts };
    } catch (error) {
      console.error('Slack send failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Reply in a thread
   */
  async replyInThread(
    workspaceId: string,
    channel: string,
    threadTs: string,
    message: SlackMessage
  ): Promise<{ success: boolean; ts?: string; error?: string }> {
    return this.sendBotMessage(workspaceId, channel, {
      ...message,
      thread_ts: threadTs,
    });
  }

  /**
   * Update an existing message
   */
  async updateMessage(
    workspaceId: string,
    channel: string,
    messageTs: string,
    message: SlackMessage
  ): Promise<{ success: boolean; error?: string }> {
    const config = await this.getAppConfig(workspaceId);
    if (!config) {
      return { success: false, error: 'Slack not configured for this workspace' };
    }

    try {
      const response = await fetch('https://slack.com/api/chat.update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.bot_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel,
          ts: messageTs,
          ...message,
        }),
      });

      const result: SlackApiResponse = await response.json();

      if (!result.ok) {
        console.error('Slack update error:', result.error);
        return { success: false, error: result.error };
      }

      return { success: true };
    } catch (error) {
      console.error('Slack update failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Add a reaction to a message
   */
  async addReaction(
    workspaceId: string,
    channel: string,
    messageTs: string,
    emoji: string
  ): Promise<{ success: boolean; error?: string }> {
    const config = await this.getAppConfig(workspaceId);
    if (!config) {
      return { success: false, error: 'Slack not configured for this workspace' };
    }

    try {
      const response = await fetch('https://slack.com/api/reactions.add', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.bot_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel,
          timestamp: messageTs,
          name: emoji,
        }),
      });

      const result: SlackApiResponse = await response.json();
      return { success: result.ok, error: result.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get user info from Slack
   */
  async getUserInfo(
    workspaceId: string,
    userId: string
  ): Promise<{ success: boolean; user?: any; error?: string }> {
    const config = await this.getAppConfig(workspaceId);
    if (!config) {
      return { success: false, error: 'Slack not configured' };
    }

    try {
      const response = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
        headers: {
          'Authorization': `Bearer ${config.bot_token}`,
        },
      });

      const result = await response.json();
      if (!result.ok) {
        return { success: false, error: result.error };
      }

      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * List channels the bot is in
   */
  async listChannels(workspaceId: string): Promise<{ success: boolean; channels?: any[]; error?: string }> {
    const config = await this.getAppConfig(workspaceId);
    if (!config) {
      return { success: false, error: 'Slack not configured' };
    }

    try {
      const response = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel', {
        headers: {
          'Authorization': `Bearer ${config.bot_token}`,
        },
      });

      const result = await response.json();
      if (!result.ok) {
        return { success: false, error: result.error };
      }

      return { success: true, channels: result.channels };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ==========================================================================
  // WEBHOOK METHODS (for simple one-way notifications)
  // ==========================================================================

  async sendMessage(message: SlackMessage): Promise<{ success: boolean; error?: string }> {
    // Kill switch - skip all notifications when paused
    if (NOTIFICATIONS_PAUSED) {
      console.log('⏸️ Notifications paused (PAUSE_NOTIFICATIONS=true) - skipping Slack webhook');
      return { success: true, error: 'Notifications paused' };
    }

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

  /**
   * Send via workspace-specific webhook (from workspace_integrations table)
   */
  async sendWorkspaceWebhook(
    workspaceId: string,
    message: SlackMessage
  ): Promise<{ success: boolean; error?: string }> {
    const { data } = await supabaseAdmin()
      .from('workspace_integrations')
      .select('config')
      .eq('workspace_id', workspaceId)
      .eq('integration_type', 'slack')
      .eq('status', 'active')
      .single();

    if (!data?.config?.webhook_url) {
      return { success: false, error: 'Slack webhook not configured for workspace' };
    }

    try {
      const response = await fetch(data.config.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ==========================================================================
  // DATABASE LOGGING
  // ==========================================================================

  async logMessage(
    workspaceId: string,
    message: {
      channel_id: string;
      message_ts: string;
      direction: 'inbound' | 'outbound';
      sender_type: 'user' | 'bot' | 'sam';
      content: string;
      sender_id?: string;
      sender_name?: string;
      thread_ts?: string;
      raw_event?: any;
    }
  ): Promise<void> {
    try {
      await supabaseAdmin().from('slack_messages').upsert({
        workspace_id: workspaceId,
        channel_id: message.channel_id,
        message_ts: message.message_ts,
        direction: message.direction,
        sender_type: message.sender_type,
        content: message.content,
        sender_id: message.sender_id,
        sender_name: message.sender_name,
        thread_ts: message.thread_ts,
        raw_event: message.raw_event,
      }, {
        onConflict: 'workspace_id,message_ts',
      });
    } catch (error) {
      console.error('Failed to log Slack message:', error);
    }
  }

  // ==========================================================================
  // NOTIFICATION HELPERS
  // ==========================================================================

  async notifyNewLead(workspaceId: string, name: string, source: string, intent?: string) {
    const message: SlackMessage = {
      text: `New Lead: ${name}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: 'New Lead', emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: `*${name}*\nSource: ${source}${intent ? `\nIntent: ${intent}` : ''}` } },
      ],
    };

    // Try Bot API first, fall back to webhook
    const botResult = await this.sendBotMessage(workspaceId, await this.getDefaultChannel(workspaceId), message);
    if (!botResult.success) {
      return this.sendWorkspaceWebhook(workspaceId, message);
    }
    return botResult;
  }

  async notifyReplyReceived(workspaceId: string, prospectName: string, campaignName: string, preview: string) {
    const message: SlackMessage = {
      text: `Reply from ${prospectName}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: 'New Reply', emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: `*${prospectName}* replied to *${campaignName}*` } },
        { type: 'section', text: { type: 'mrkdwn', text: `> ${preview.slice(0, 200)}${preview.length > 200 ? '...' : ''}` } },
      ],
    };

    const botResult = await this.sendBotMessage(workspaceId, await this.getDefaultChannel(workspaceId), message);
    if (!botResult.success) {
      return this.sendWorkspaceWebhook(workspaceId, message);
    }
    return botResult;
  }

  async notifyCommentPending(
    workspaceId: string,
    postAuthor: string,
    commentPreview: string,
    commentId: string
  ) {
    const approveUrl = `https://app.meet-sam.com/workspace/${workspaceId}/commenting?highlight=${commentId}`;

    const message: SlackMessage = {
      text: `Comment pending approval`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: 'Comment Pending Approval', emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: `Post by *${postAuthor}*` } },
        { type: 'section', text: { type: 'mrkdwn', text: `> ${commentPreview.slice(0, 150)}...` } },
        {
          type: 'actions',
          block_id: `comment_actions_${commentId}`,
          elements: [
            {
              type: 'button',
              action_id: 'approve_comment',
              text: { type: 'plain_text', text: 'Approve', emoji: true },
              value: commentId,
              style: 'primary',
            },
            {
              type: 'button',
              action_id: 'reject_comment',
              text: { type: 'plain_text', text: 'Reject', emoji: true },
              value: commentId,
              style: 'danger',
            },
            {
              type: 'button',
              action_id: 'view_comment',
              text: { type: 'plain_text', text: 'View in SAM', emoji: true },
              url: approveUrl,
            },
          ],
        },
      ],
    };

    const channel = await this.getDefaultChannel(workspaceId);
    const botResult = await this.sendBotMessage(workspaceId, channel, message);

    // Store pending action for button handling
    if (botResult.success && botResult.ts) {
      await supabaseAdmin().from('slack_pending_actions').insert({
        workspace_id: workspaceId,
        action_type: 'approve_comment',
        resource_type: 'comment',
        resource_id: commentId,
        channel_id: channel,
        message_ts: botResult.ts,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h expiry
      });
    }

    if (!botResult.success) {
      return this.sendWorkspaceWebhook(workspaceId, message);
    }
    return botResult;
  }

  async notifyFollowUpPending(
    workspaceId: string,
    prospectName: string,
    messagePreview: string,
    draftId: string
  ) {
    const message: SlackMessage = {
      text: `Follow-up pending for ${prospectName}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: 'Follow-Up Ready for Review', emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: `Prospect: *${prospectName}*` } },
        { type: 'section', text: { type: 'mrkdwn', text: `> ${messagePreview.slice(0, 200)}...` } },
        {
          type: 'actions',
          block_id: `followup_actions_${draftId}`,
          elements: [
            {
              type: 'button',
              action_id: 'approve_followup',
              text: { type: 'plain_text', text: 'Approve & Send', emoji: true },
              value: draftId,
              style: 'primary',
            },
            {
              type: 'button',
              action_id: 'reject_followup',
              text: { type: 'plain_text', text: 'Reject', emoji: true },
              value: draftId,
              style: 'danger',
            },
            {
              type: 'button',
              action_id: 'edit_followup',
              text: { type: 'plain_text', text: 'Edit in SAM', emoji: true },
              url: `https://app.meet-sam.com/workspace/${workspaceId}/follow-ups?draft=${draftId}`,
            },
          ],
        },
      ],
    };

    const channel = await this.getDefaultChannel(workspaceId);
    return this.sendBotMessage(workspaceId, channel, message);
  }

  async notifyCampaignUpdate(workspaceId: string, campaignName: string, status: string, stats?: { sent?: number; accepted?: number; replied?: number }) {
    const statsText = stats ? `\nSent: ${stats.sent || 0} | Accepted: ${stats.accepted || 0} | Replied: ${stats.replied || 0}` : '';
    const message: SlackMessage = {
      text: `Campaign: ${campaignName} - ${status}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: 'Campaign Update', emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: `*${campaignName}*\nStatus: ${status}${statsText}` } },
      ],
    };

    const botResult = await this.sendBotMessage(workspaceId, await this.getDefaultChannel(workspaceId), message);
    if (!botResult.success) {
      return this.sendWorkspaceWebhook(workspaceId, message);
    }
    return botResult;
  }

  async notifyError(workspaceId: string, source: string, errorMessage: string) {
    const message: SlackMessage = {
      text: `Error in ${source}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: 'Error Alert', emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: `*Source:* ${source}\n*Error:* ${errorMessage}` } },
      ],
    };

    const botResult = await this.sendBotMessage(workspaceId, await this.getDefaultChannel(workspaceId), message);
    if (!botResult.success) {
      return this.sendWorkspaceWebhook(workspaceId, message);
    }
    return botResult;
  }

  /**
   * Notify about failed prospects in a campaign
   */
  async notifyFailedProspects(
    workspaceId: string,
    campaignId: string,
    campaignName: string,
    failedCount: number,
    totalProspects: number,
    topErrors: { error: string; count: number }[],
    appUrl: string = 'https://app.meet-sam.com'
  ) {
    const failRate = totalProspects > 0 ? ((failedCount / totalProspects) * 100).toFixed(1) : '0';
    const downloadUrl = `${appUrl}/api/campaigns/${campaignId}/failed-prospects-csv`;
    const resetUrl = `${appUrl}/api/campaigns/${campaignId}/reset-failed`;

    const errorFields = topErrors.slice(0, 3).map(e => ({
      type: 'mrkdwn',
      text: `*${e.count}x* ${e.error}`,
    }));

    const message: SlackMessage = {
      text: `Failed Prospects Alert: ${campaignName}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: 'Failed Prospects Alert', emoji: true } },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Campaign*\n${campaignName}` },
            { type: 'mrkdwn', text: `*Failed*\n${failedCount} of ${totalProspects} (${failRate}%)` },
          ],
        },
        ...(errorFields.length > 0 ? [{
          type: 'section' as const,
          text: { type: 'mrkdwn' as const, text: '*Top Errors:*' },
          fields: errorFields as { type: string; text: string }[],
        }] : []),
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Download CSV', emoji: true },
              url: downloadUrl,
              style: 'primary',
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Reset & Retry', emoji: true },
              url: resetUrl,
            },
          ],
        },
      ],
    };

    const channel = await this.getDefaultChannel(workspaceId);
    const botResult = await this.sendBotMessage(workspaceId, channel, message);
    if (!botResult.success) {
      return this.sendWorkspaceWebhook(workspaceId, message);
    }
    return botResult;
  }

  /**
   * Notify when a LinkedIn connection is accepted
   */
  async notifyConnectionAccepted(
    workspaceId: string,
    prospectName: string,
    prospectTitle: string,
    prospectCompany: string,
    campaignName: string,
    prospectId: string
  ) {
    const message: SlackMessage = {
      text: `Connection accepted: ${prospectName}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: 'Connection Accepted!', emoji: true } },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${prospectName}*\n${prospectTitle} at ${prospectCompany}\n\nCampaign: _${campaignName}_`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View Prospect', emoji: true },
              url: `https://app.meet-sam.com/workspace/${workspaceId}/prospects?id=${prospectId}`,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Send Follow-up Now', emoji: true },
              action_id: 'quick_followup',
              value: prospectId,
              style: 'primary',
            },
          ],
        },
      ],
    };

    const channel = await this.getDefaultChannel(workspaceId);
    return this.sendBotMessage(workspaceId, channel, message);
  }

  /**
   * Notify when a LinkedIn reply is received (with quick actions)
   */
  async notifyReplyWithActions(
    workspaceId: string,
    prospectName: string,
    prospectTitle: string,
    campaignName: string,
    messagePreview: string,
    messageId: string,
    prospectId: string
  ) {
    const message: SlackMessage = {
      text: `New reply from ${prospectName}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: 'New LinkedIn Reply!', emoji: true } },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${prospectName}*\n${prospectTitle}\nCampaign: _${campaignName}_`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `> ${messagePreview.slice(0, 300)}${messagePreview.length > 300 ? '...' : ''}`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View & Reply', emoji: true },
              url: `https://app.meet-sam.com/workspace/${workspaceId}/messages?prospect=${prospectId}`,
              style: 'primary',
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Mark as Hot Lead', emoji: true },
              action_id: 'mark_hot_lead',
              value: prospectId,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Archive', emoji: true },
              action_id: 'archive_conversation',
              value: messageId,
              style: 'danger',
            },
          ],
        },
      ],
    };

    const channel = await this.getDefaultChannel(workspaceId);
    return this.sendBotMessage(workspaceId, channel, message);
  }

  /**
   * Send daily digest summary
   */
  async sendDailyDigest(
    workspaceId: string,
    stats: {
      crSent: number;
      crAccepted: number;
      repliesReceived: number;
      followUpsSent: number;
      activeCampaigns: number;
      hotLeads: number;
      topCampaign?: { name: string; acceptRate: number };
      pendingActions: number;
    },
    targetChannel?: string // Optional: specify channel name or ID
  ) {
    const acceptRate = stats.crSent > 0 ? ((stats.crAccepted / stats.crSent) * 100).toFixed(1) : '0';

    const message: SlackMessage = {
      text: 'Daily SAM Digest',
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: '📊 Daily SAM Digest', emoji: true } },
        { type: 'divider' },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Connection Requests Sent*\n${stats.crSent}` },
            { type: 'mrkdwn', text: `*Connections Accepted*\n${stats.crAccepted} (${acceptRate}%)` },
            { type: 'mrkdwn', text: `*Replies Received*\n${stats.repliesReceived}` },
            { type: 'mrkdwn', text: `*Follow-ups Sent*\n${stats.followUpsSent}` },
          ],
        },
        { type: 'divider' },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Active Campaigns*\n${stats.activeCampaigns}` },
            { type: 'mrkdwn', text: `*Hot Leads*\n${stats.hotLeads}` },
          ],
        },
        ...(stats.topCampaign ? [{
          type: 'section' as const,
          text: {
            type: 'mrkdwn' as const,
            text: `🏆 *Top Performing Campaign:* ${stats.topCampaign.name} (${stats.topCampaign.acceptRate.toFixed(1)}% accept rate)`,
          },
        }] : []),
        ...(stats.pendingActions > 0 ? [{
          type: 'section' as const,
          text: {
            type: 'mrkdwn' as const,
            text: `⚠️ *Action Required:* ${stats.pendingActions} items awaiting your approval`,
          },
        }] : []),
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Open Dashboard', emoji: true },
              url: `https://app.meet-sam.com/workspace/${workspaceId}`,
              style: 'primary',
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View All Campaigns', emoji: true },
              url: `https://app.meet-sam.com/workspace/${workspaceId}/campaign-hub`,
            },
          ],
        },
      ],
    };

    // Determine channel - use specified, find by name, or fall back to default
    let channel: string;
    if (targetChannel) {
      // Check if it's a channel ID (starts with C) or a name
      if (targetChannel.startsWith('C')) {
        channel = targetChannel;
      } else {
        const foundChannel = await this.findChannelByName(workspaceId, targetChannel);
        channel = foundChannel || await this.getDefaultChannel(workspaceId);
      }
    } else {
      channel = await this.getDefaultChannel(workspaceId);
    }

    return this.sendBotMessage(workspaceId, channel, message);
  }

  /**
   * Notify when a LinkedIn account hits its daily rate limit
   */
  async notifyRateLimitReached(
    workspaceId: string,
    accountName: string,
    limitType: 'connection_request' | 'message',
    current: number,
    limit: number,
    pendingCount: number
  ) {
    const limitTypeLabel = limitType === 'connection_request' ? 'Connection Requests' : 'Messages';
    const emoji = limitType === 'connection_request' ? '🔗' : '💬';

    const message: SlackMessage = {
      text: `Rate limit reached for ${accountName}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: `${emoji} Daily Limit Reached`, emoji: true } },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Account:* ${accountName}\n*Type:* ${limitTypeLabel}\n*Today:* ${current}/${limit}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `_${pendingCount} messages queued and will resume tomorrow._`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `This is normal behavior to protect your LinkedIn account. Limits reset at midnight.`,
            },
          ],
        },
      ],
    };

    const channel = await this.getDefaultChannel(workspaceId);
    return this.sendBotMessage(workspaceId, channel, message);
  }

  /**
   * Send campaign milestone notification
   */
  async notifyCampaignMilestone(
    workspaceId: string,
    campaignName: string,
    milestone: string,
    details: string
  ) {
    const message: SlackMessage = {
      text: `Campaign milestone: ${campaignName}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: 'Campaign Milestone!', emoji: true } },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${campaignName}*\n\n${milestone}\n${details}`,
          },
        },
      ],
    };

    const channel = await this.getDefaultChannel(workspaceId);
    return this.sendBotMessage(workspaceId, channel, message);
  }

  /**
   * Send a message to a specific user via DM
   */
  async sendDirectMessage(
    workspaceId: string,
    slackUserId: string,
    message: SlackMessage
  ): Promise<{ success: boolean; ts?: string; error?: string }> {
    const config = await this.getAppConfig(workspaceId);
    if (!config) {
      return { success: false, error: 'Slack not configured for this workspace' };
    }

    try {
      // Open a DM channel with the user
      const openResponse = await fetch('https://slack.com/api/conversations.open', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.bot_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ users: slackUserId }),
      });

      const openResult = await openResponse.json();
      if (!openResult.ok) {
        return { success: false, error: openResult.error };
      }

      // Send the message to the DM channel
      return this.sendBotMessage(workspaceId, openResult.channel.id, message);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ==========================================================================
  // CHANNEL HELPERS
  // ==========================================================================

  /**
   * Find channel by name using Slack API
   */
  async findChannelByName(workspaceId: string, channelName: string): Promise<string | null> {
    const config = await this.getAppConfig(workspaceId);
    if (!config) {
      return null;
    }

    try {
      // List all channels and find by name
      const response = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200', {
        headers: {
          'Authorization': `Bearer ${config.bot_token}`,
        },
      });

      const result = await response.json();
      if (!result.ok) {
        console.error('Failed to list channels:', result.error);
        return null;
      }

      // Normalize channel name (remove # if present)
      const normalizedName = channelName.replace(/^#/, '').toLowerCase();
      const channel = result.channels?.find((c: any) => c.name.toLowerCase() === normalizedName);

      return channel?.id || null;
    } catch (error) {
      console.error('Error finding channel:', error);
      return null;
    }
  }

  /**
   * Get the default channel for a workspace
   */
  async getDefaultChannel(workspaceId: string): Promise<string> {
    const { data } = await supabaseAdmin()
      .from('slack_channels')
      .select('channel_id')
      .eq('workspace_id', workspaceId)
      .eq('is_default', true)
      .single();

    if (data?.channel_id) {
      return data.channel_id;
    }

    // Fall back to config in workspace_integrations
    const { data: integration } = await supabaseAdmin()
      .from('workspace_integrations')
      .select('config')
      .eq('workspace_id', workspaceId)
      .eq('integration_type', 'slack')
      .single();

    return integration?.config?.channel_id || 'general';
  }

  /**
   * Set the default channel for a workspace
   */
  async setDefaultChannel(workspaceId: string, channelId: string, channelName?: string): Promise<void> {
    // Remove default from existing
    await supabaseAdmin()
      .from('slack_channels')
      .update({ is_default: false })
      .eq('workspace_id', workspaceId);

    // Set new default
    await supabaseAdmin()
      .from('slack_channels')
      .upsert({
        workspace_id: workspaceId,
        channel_id: channelId,
        channel_name: channelName,
        is_default: true,
      }, {
        onConflict: 'workspace_id,channel_id',
      });
  }

  // ==========================================================================
  // SIGNATURE VERIFICATION
  // ==========================================================================

  /**
   * Verify Slack request signature
   */
  async verifySignature(
    workspaceId: string,
    signature: string,
    timestamp: string,
    body: string
  ): Promise<boolean> {
    const config = await this.getAppConfig(workspaceId);
    if (!config?.signing_secret) {
      console.warn('No signing secret configured');
      return false;
    }

    const baseString = `v0:${timestamp}:${body}`;

    // Use Web Crypto API for HMAC
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(config.signing_secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(baseString)
    );

    const computedSignature = 'v0=' + Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return computedSignature === signature;
  }
}

export const slackService = new SlackService();
