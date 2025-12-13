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
  workspaceId?: string; // Used to filter which workspaces send to which channels
  // Additional fields for client notifications
  campaignName?: string;
  prospectLinkedInUrl?: string;
  clientName?: string; // Workspace name
}

/**
 * InnovareAI workspace IDs (IA1-IA6)
 * Only these workspaces send Reply Agent notifications to the IA Google Chat channel
 */
const INNOVAREAI_WORKSPACE_IDS = [
  'babdcab8-1a78-4b2f-913e-6e9fd9821009', // IA1 - Thorsten
  '04666209-fce8-4d71-8eaf-01278edfc73b', // IA2 - Michelle
  '96c03b38-a2f4-40de-9e16-43098599e1d4', // IA3 - Irish
  '7f0341da-88db-476b-ae0a-fc0da5b70861', // IA4 - Charissa
  'cd57981a-e63b-401c-bde1-ac71752c2293', // IA5 - Jennifer
  '2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c', // IA6 - Chona
];

/**
 * Send a Reply Agent HITL approval request to Google Chat
 * Routes to different webhooks based on workspace:
 * - InnovareAI workspaces (IA1-IA6) → GOOGLE_CHAT_REPLIES_WEBHOOK_URL
 * - Client workspaces → GOOGLE_CHAT_CLIENT_WEBHOOK_URL
 */
export async function sendReplyAgentHITLNotification(
  notification: ReplyAgentHITLNotification
): Promise<{ success: boolean; error?: string }> {
  const isIAWorkspace = notification.workspaceId && INNOVAREAI_WORKSPACE_IDS.includes(notification.workspaceId);

  // Determine which webhook to use based on workspace
  let webhookUrl: string | undefined;
  if (isIAWorkspace) {
    webhookUrl = process.env.GOOGLE_CHAT_REPLIES_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn('⚠️ GOOGLE_CHAT_REPLIES_WEBHOOK_URL not configured - skipping IA notification');
      return { success: false, error: 'IA webhook URL not configured' };
    }
  } else {
    webhookUrl = process.env.GOOGLE_CHAT_CLIENT_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn('⚠️ GOOGLE_CHAT_CLIENT_WEBHOOK_URL not configured - skipping client notification');
      return { success: false, error: 'Client webhook URL not configured' };
    }
  }

  const workspaceType = isIAWorkspace ? 'IA' : 'Client';
  console.log(`📬 Sending ${workspaceType} notification to Google Chat for workspace ${notification.workspaceId}`);

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
    'WRONG_PERSON': '🚫',
  };

  // Build sections array - add client info section for non-IA workspaces (QC channel)
  const sections: any[] = [];

  // For client notifications (QC channel), add client/campaign info at the top
  if (!isIAWorkspace) {
    const clientInfoWidgets: any[] = [];

    if (notification.clientName) {
      clientInfoWidgets.push({
        decoratedText: {
          topLabel: 'Client',
          text: notification.clientName,
          startIcon: { knownIcon: 'PERSON' },
        },
      });
    }

    if (notification.campaignName) {
      clientInfoWidgets.push({
        decoratedText: {
          topLabel: 'Campaign',
          text: notification.campaignName,
          startIcon: { knownIcon: 'BOOKMARK' },
        },
      });
    }

    if (notification.prospectLinkedInUrl) {
      clientInfoWidgets.push({
        decoratedText: {
          topLabel: 'LinkedIn',
          text: notification.prospectLinkedInUrl,
          startIcon: { knownIcon: 'MEMBERSHIP' },
          button: {
            text: 'View Profile',
            onClick: {
              openLink: { url: notification.prospectLinkedInUrl },
            },
          },
        },
      });
    }

    if (clientInfoWidgets.length > 0) {
      sections.push({
        header: '📋 Client Info',
        widgets: clientInfoWidgets,
      });
    }
  }

  // Add intent and message section
  sections.push({
    header: `Intent: ${intentEmoji[notification.intent] || '💬'} ${notification.intent}`,
    widgets: [
      {
        textParagraph: {
          text: `<b>Their Message:</b>\n"${notification.inboundMessage}"`,
        },
      },
    ],
  });

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
            ...sections,
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

  // Send to the appropriate webhook (IA or Client QC channel)
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
      console.error(`❌ ${workspaceType} notification failed:`, errorText);
      return { success: false, error: errorText };
    }

    console.log(`✅ ${workspaceType} notification sent to Google Chat`);
    return { success: true };
  } catch (error) {
    console.error(`❌ ${workspaceType} notification error:`, error);
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
