/**
 * Google Chat Webhook Notification Helper
 *
 * Sends formatted messages to Google Chat spaces via incoming webhooks.
 *
 * Setup:
 * 1. Open Google Chat space → Apps & Integrations → Webhooks → Create
 * 2. Copy the webhook URL and add to .env.local as GOOGLE_CHAT_WEBHOOK_URL
 */

// REMOVED: Hardcoded IA workspace IDs - now queries ALL workspaces dynamically
// OLD: const IA_WORKSPACE_IDS = ['ia1-xxx', 'ia2-xxx', ...]

/**
 * Get ALL active workspace IDs
 * Previously hardcoded to InnovareAI workspaces only
 * Now returns ALL workspaces to enable multi-tenant monitoring
 */
export function getIAWorkspaceIds(): string[] {
  // DEPRECATED: This function name is misleading
  // Returns empty array - agents should query workspaces directly from database
  // Kept for backwards compatibility, but agents updated to use getAllActiveWorkspaces()
  console.warn('⚠️ getIAWorkspaceIds() is deprecated - use getAllActiveWorkspaces() instead');
  return [];
}

export interface DailyCampaignSummary {
  date: string;
  totalConnectionRequests: number;
  totalAccepted: number;
  totalMessages: number;
  totalReplies: number;
  acceptRate: number;
  replyRate: number;
  byIntent?: Record<string, number>;
  workspaceBreakdown?: Array<{
    workspaceId: string;
    workspaceName: string;
    connectionRequests: number;
    accepted: number;
    replies: number;
    messages: number;
  }>;
}

interface GoogleChatMessage {
  text?: string;
  cards?: GoogleChatCard[];
  cardsV2?: GoogleChatCardV2[];
}

interface GoogleChatCard {
  header?: {
    title: string;
    subtitle?: string;
    imageUrl?: string;
  };
  sections: {
    header?: string;
    widgets: any[];
  }[];
}

interface GoogleChatCardV2 {
  cardId: string;
  card: {
    header?: {
      title: string;
      subtitle?: string;
      imageUrl?: string;
      imageType?: 'CIRCLE' | 'SQUARE';
    };
    sections: {
      header?: string;
      widgets: any[];
    }[];
  };
}

export interface HealthCheckNotification {
  type: 'daily-health-check' | 'qa-monitor' | 'rate-limit' | 'data-quality';
  status: 'healthy' | 'warning' | 'critical';
  summary: string;
  checks?: {
    name: string;
    status: string;
    details: string;
  }[];
  recommendations?: string[];
  duration_ms?: number;
  timestamp?: string;
}

/**
 * Send a notification to Google Chat
 */
export async function sendGoogleChatNotification(
  message: GoogleChatMessage
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('⚠️ GOOGLE_CHAT_WEBHOOK_URL not configured - skipping notification');
    return { success: false, error: 'Webhook URL not configured' };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Google Chat notification failed:', errorText);
      return { success: false, error: errorText };
    }

    console.log('✅ Google Chat notification sent');
    return { success: true };
  } catch (error) {
    console.error('❌ Google Chat notification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send a health check status notification with a formatted card
 */
export async function sendHealthCheckNotification(
  notification: HealthCheckNotification
): Promise<{ success: boolean; error?: string }> {
  const statusEmoji = {
    healthy: '✅',
    warning: '⚠️',
    critical: '🚨',
  }[notification.status];

  const statusColor = {
    healthy: '#34a853',
    warning: '#fbbc04',
    critical: '#ea4335',
  }[notification.status];

  const sections: any[] = [
    {
      header: 'Summary',
      widgets: [
        {
          textParagraph: {
            text: notification.summary,
          },
        },
      ],
    },
  ];

  // Add checks if provided
  if (notification.checks && notification.checks.length > 0) {
    const checkWidgets = notification.checks.map((check) => ({
      decoratedText: {
        topLabel: check.name,
        text: check.details,
        startIcon: {
          knownIcon: check.status === 'pass' ? 'STAR' : check.status === 'fail' ? 'BOOKMARK' : 'CLOCK',
        },
      },
    }));

    sections.push({
      header: 'Check Results',
      widgets: checkWidgets,
    });
  }

  // Add recommendations if provided
  if (notification.recommendations && notification.recommendations.length > 0) {
    sections.push({
      header: 'Recommendations',
      widgets: [
        {
          textParagraph: {
            text: notification.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n'),
          },
        },
      ],
    });
  }

  const message: GoogleChatMessage = {
    cardsV2: [
      {
        cardId: `health-check-${Date.now()}`,
        card: {
          header: {
            title: `${statusEmoji} ${notification.type.toUpperCase()}`,
            subtitle: notification.timestamp || new Date().toISOString(),
            imageType: 'CIRCLE',
          },
          sections,
        },
      },
    ],
  };

  return sendGoogleChatNotification(message);
}

/**
 * Send a daily campaign summary notification
 */
export async function sendDailyCampaignSummary(
  summary: DailyCampaignSummary
): Promise<{ success: boolean; error?: string }> {
  const sections: any[] = [
    {
      header: 'Overall Metrics',
      widgets: [
        {
          decoratedText: {
            topLabel: 'Connection Requests',
            text: `<b>${summary.totalConnectionRequests}</b>`,
            startIcon: { knownIcon: 'PERSON' },
          },
        },
        {
          decoratedText: {
            topLabel: 'Accepted',
            text: `<b>${summary.totalAccepted}</b> (${summary.acceptRate}%)`,
            startIcon: { knownIcon: 'STAR' },
          },
        },
        {
          decoratedText: {
            topLabel: 'Messages Sent',
            text: `<b>${summary.totalMessages}</b>`,
            startIcon: { knownIcon: 'EMAIL' },
          },
        },
        {
          decoratedText: {
            topLabel: 'Replies',
            text: `<b>${summary.totalReplies}</b> (${summary.replyRate}%)`,
            startIcon: { knownIcon: 'CHAT' },
          },
        },
      ],
    },
  ];

  // Add workspace breakdown if provided
  if (summary.workspaceBreakdown && summary.workspaceBreakdown.length > 0) {
    const workspaceWidgets = summary.workspaceBreakdown.map((ws) => ({
      decoratedText: {
        topLabel: ws.workspaceName,
        text: `CR: ${ws.connectionRequests} | Acc: ${ws.accepted} | Msg: ${ws.messages} | Rep: ${ws.replies}`,
      },
    }));

    sections.push({
      header: 'By Workspace',
      widgets: workspaceWidgets,
    });
  }

  const message: GoogleChatMessage = {
    cardsV2: [
      {
        cardId: `campaign-summary-${Date.now()}`,
        card: {
          header: {
            title: '📊 Daily Campaign Summary',
            subtitle: summary.date,
            imageType: 'CIRCLE',
          },
          sections,
        },
      },
    ],
  };

  return sendGoogleChatNotification(message);
}
