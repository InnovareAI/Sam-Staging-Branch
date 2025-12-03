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
  auto_fixes?: {
    issue: string;
    attempted: boolean;
    success: boolean;
    count?: number;
    error?: string;
    details: string;
  }[];
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

  // Add auto-fix results if provided
  if (notification.auto_fixes && notification.auto_fixes.length > 0) {
    const fixWidgets = notification.auto_fixes.map((fix) => ({
      decoratedText: {
        topLabel: fix.issue,
        text: fix.details + (fix.count ? ` (${fix.count} items)` : ''),
        startIcon: {
          knownIcon: fix.success ? 'STAR' : 'BOOKMARK',
        },
      },
    }));

    sections.push({
      header: '🔧 Auto-Fixes Applied',
      widgets: fixWidgets,
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
 * Reply Agent HITL notification interface
 */
export interface ReplyAgentHITLNotification {
  draftId: string;
  approvalToken: string;
  prospectName: string;
  prospectTitle?: string;
  prospectCompany?: string;
  inboundMessage: string;
  draftReply: string;
  intent: string;
  appUrl: string;
}

/**
 * Send a Reply Agent HITL approval request to Google Chat
 * Uses dedicated GOOGLE_CHAT_REPLIES_WEBHOOK_URL for Campaign Replies channel
 * Includes Approve/Reject buttons that link to the approval endpoint
 */
export async function sendReplyAgentHITLNotification(
  notification: ReplyAgentHITLNotification
): Promise<{ success: boolean; error?: string }> {
  // Use dedicated Campaign Replies channel
  const repliesWebhookUrl = process.env.GOOGLE_CHAT_REPLIES_WEBHOOK_URL;

  if (!repliesWebhookUrl) {
    console.warn('⚠️ GOOGLE_CHAT_REPLIES_WEBHOOK_URL not configured - skipping Reply Agent notification');
    return { success: false, error: 'Replies webhook URL not configured' };
  }

  const approveUrl = `${notification.appUrl}/api/reply-agent/approve?token=${notification.approvalToken}&action=approve`;
  const rejectUrl = `${notification.appUrl}/api/reply-agent/approve?token=${notification.approvalToken}&action=reject`;
  const editUrl = `${notification.appUrl}/reply-agent/edit?id=${notification.draftId}&token=${notification.approvalToken}`;
  const instructionsUrl = `${notification.appUrl}/reply-agent/instructions?id=${notification.draftId}&token=${notification.approvalToken}`;

  const intentEmoji: Record<string, string> = {
    'INTERESTED': '🔥',
    'QUESTION': '❓',
    'OBJECTION': '⚡',
    'TIMING': '⏰',
    'VAGUE_POSITIVE': '👍',
    'UNCLEAR': '🤔',
    'NOT_INTERESTED': '❌',
  };

  const message: GoogleChatMessage = {
    cardsV2: [
      {
        cardId: `reply-agent-${notification.draftId}`,
        card: {
          header: {
            title: `📬 New Reply from ${notification.prospectName}`,
            subtitle: `${notification.prospectTitle || ''} at ${notification.prospectCompany || 'Unknown'}`,
            imageType: 'CIRCLE',
          },
          sections: [
            {
              header: `Intent: ${intentEmoji[notification.intent] || '💬'} ${notification.intent}`,
              widgets: [
                {
                  textParagraph: {
                    text: `<b>Their Message:</b>\n"${notification.inboundMessage}"`,
                  },
                },
              ],
            },
            {
              header: '💡 SAM\'s Draft Reply',
              widgets: [
                {
                  textParagraph: {
                    text: notification.draftReply,
                  },
                },
              ],
            },
            {
              widgets: [
                {
                  buttonList: {
                    buttons: [
                      {
                        text: '✓ Approve & Send',
                        onClick: {
                          openLink: {
                            url: approveUrl,
                          },
                        },
                        color: {
                          red: 0.063,
                          green: 0.722,
                          blue: 0.506,
                          alpha: 1,
                        },
                      },
                      {
                        text: '✗ Reject',
                        onClick: {
                          openLink: {
                            url: rejectUrl,
                          },
                        },
                        color: {
                          red: 0.937,
                          green: 0.267,
                          blue: 0.267,
                          alpha: 1,
                        },
                      },
                    ],
                  },
                },
                {
                  buttonList: {
                    buttons: [
                      {
                        text: '✏️ Edit Reply',
                        onClick: {
                          openLink: {
                            url: editUrl,
                          },
                        },
                        color: {
                          red: 0.42,
                          green: 0.48,
                          blue: 0.54,
                          alpha: 1,
                        },
                      },
                      {
                        text: '💬 Add Instructions',
                        onClick: {
                          openLink: {
                            url: instructionsUrl,
                          },
                        },
                        color: {
                          red: 0.4,
                          green: 0.31,
                          blue: 0.64,
                          alpha: 1,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };

  // Send directly to Campaign Replies channel (not the generic webhook)
  try {
    const response = await fetch(repliesWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Campaign Replies notification failed:', errorText);
      return { success: false, error: errorText };
    }

    console.log('✅ Campaign Replies notification sent');
    return { success: true };
  } catch (error) {
    console.error('❌ Campaign Replies notification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
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
