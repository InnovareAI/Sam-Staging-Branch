/**
 * Unified Notification Router
 *
 * Routes notifications to Slack OR Google Chat based on workspace preferences.
 * Checks workspace_integrations table to determine which channel is configured.
 *
 * Priority:
 * 1. Slack (if configured and active)
 * 2. Google Chat (always available as fallback for admin notifications)
 *
 * Created: December 16, 2025
 */

import { pool } from '@/lib/db';
import { slackService } from '@/lib/slack';
import {
  sendRateLimitNotification as sendGoogleChatRateLimitNotification,
  sendFailedProspectsAlert as sendGoogleChatFailedProspectsAlert,
} from '@/lib/notifications/google-chat';

export type NotificationChannel = 'slack' | 'google_chat' | 'none';

interface WorkspaceNotificationConfig {
  channel: NotificationChannel;
  slackConfigured: boolean;
  googleChatConfigured: boolean;
}

/**
 * Get the notification channel preference for a workspace
 */
export async function getWorkspaceNotificationChannel(
  workspaceId: string
): Promise<WorkspaceNotificationConfig> {
  try {
    // Check if Slack is configured and active
    const { data: slackConfig } = await supabase
      .from('slack_app_config')
      .select('status, bot_token')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .single();

    const slackConfigured = !!(slackConfig?.bot_token && slackConfig?.status === 'active');

    // Google Chat is available if the webhook URL is set (admin-level config)
    const googleChatConfigured = !!process.env.GOOGLE_CHAT_WEBHOOK_URL;

    // Priority: Slack > Google Chat
    let channel: NotificationChannel = 'none';
    if (slackConfigured) {
      channel = 'slack';
    } else if (googleChatConfigured) {
      channel = 'google_chat';
    }

    return {
      channel,
      slackConfigured,
      googleChatConfigured,
    };
  } catch (error) {
    console.warn('Error checking notification config:', error);
    // Fall back to Google Chat if available
    return {
      channel: process.env.GOOGLE_CHAT_WEBHOOK_URL ? 'google_chat' : 'none',
      slackConfigured: false,
      googleChatConfigured: !!process.env.GOOGLE_CHAT_WEBHOOK_URL,
    };
  }
}

export interface RateLimitNotificationData {
  workspaceId: string;
  accountName: string;
  limitType: 'connection_request' | 'message';
  current: number;
  limit: number;
  pendingCount: number;
  workspaceName?: string;
}

/**
 * Send a rate limit notification to the appropriate channel
 */
export async function sendRateLimitNotification(
  data: RateLimitNotificationData
): Promise<{ success: boolean; channel: NotificationChannel; error?: string }> {
  const config = await getWorkspaceNotificationChannel(data.workspaceId);

  console.log(`📬 Rate limit notification for workspace ${data.workspaceId.substring(0, 8)}... → ${config.channel}`);

  if (config.channel === 'slack') {
    try {
      const result = await slackService.notifyRateLimitReached(
        data.workspaceId,
        data.accountName,
        data.limitType,
        data.current,
        data.limit,
        data.pendingCount
      );
      return { success: result.success, channel: 'slack', error: result.error };
    } catch (error) {
      console.warn('Slack notification failed, trying Google Chat:', error);
      // Fall back to Google Chat if Slack fails
      if (config.googleChatConfigured) {
        const gcResult = await sendGoogleChatRateLimitNotification({
          accountName: data.accountName,
          limitType: data.limitType,
          current: data.current,
          limit: data.limit,
          pendingCount: data.pendingCount,
          workspaceName: data.workspaceName,
        });
        return { success: gcResult.success, channel: 'google_chat', error: gcResult.error };
      }
      return {
        success: false,
        channel: 'none',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  if (config.channel === 'google_chat') {
    const result = await sendGoogleChatRateLimitNotification({
      accountName: data.accountName,
      limitType: data.limitType,
      current: data.current,
      limit: data.limit,
      pendingCount: data.pendingCount,
      workspaceName: data.workspaceName,
    });
    return { success: result.success, channel: 'google_chat', error: result.error };
  }

  console.warn('⚠️ No notification channel configured for workspace');
  return { success: false, channel: 'none', error: 'No notification channel configured' };
}

export interface FailedProspectsNotificationData {
  workspaceId: string;
  campaignId: string;
  campaignName: string;
  workspaceName: string;
  failedCount: number;
  totalProspects: number;
  topErrors: { error: string; count: number }[];
  appUrl: string;
}

/**
 * Send a failed prospects alert to the appropriate channel (Slack or Google Chat)
 */
export async function sendFailedProspectsAlert(
  data: FailedProspectsNotificationData
): Promise<{ success: boolean; channel: NotificationChannel; error?: string }> {
  const config = await getWorkspaceNotificationChannel(data.workspaceId);

  console.log(`📬 Failed prospects alert for workspace ${data.workspaceId.substring(0, 8)}... → ${config.channel}`);

  if (config.channel === 'slack') {
    try {
      const result = await slackService.notifyFailedProspects(
        data.workspaceId,
        data.campaignId,
        data.campaignName,
        data.failedCount,
        data.totalProspects,
        data.topErrors,
        data.appUrl
      );
      return { success: result.success, channel: 'slack', error: result.error };
    } catch (error) {
      console.warn('Slack notification failed, trying Google Chat:', error);
      // Fall back to Google Chat if Slack fails
      if (config.googleChatConfigured) {
        const gcResult = await sendGoogleChatFailedProspectsAlert({
          campaignId: data.campaignId,
          campaignName: data.campaignName,
          workspaceName: data.workspaceName,
          failedCount: data.failedCount,
          totalProspects: data.totalProspects,
          topErrors: data.topErrors,
          appUrl: data.appUrl,
        });
        return { success: gcResult.success, channel: 'google_chat', error: gcResult.error };
      }
      return {
        success: false,
        channel: 'none',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  if (config.channel === 'google_chat') {
    const result = await sendGoogleChatFailedProspectsAlert({
      campaignId: data.campaignId,
      campaignName: data.campaignName,
      workspaceName: data.workspaceName,
      failedCount: data.failedCount,
      totalProspects: data.totalProspects,
      topErrors: data.topErrors,
      appUrl: data.appUrl,
    });
    return { success: result.success, channel: 'google_chat', error: result.error };
  }

  console.warn('⚠️ No notification channel configured for workspace');
  return { success: false, channel: 'none', error: 'No notification channel configured' };
}

// Re-export for convenience
export { sendGoogleChatRateLimitNotification, sendGoogleChatFailedProspectsAlert };
