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
 * Client workspace IDs that route to the client replies channel
 * These workspaces send notifications to GOOGLE_CHAT_CLIENT_REPLIES_WEBHOOK_URL
 */
const CLIENT_REPLIES_WORKSPACE_IDS = [
  '5b81ee67-4d41-4997-b5a4-e1432e060d12', // Stan Bounev
  'dea5a7f2-673c-4429-972d-6ba5fca473fb', // Samantha Truman
  '8a720935-db68-43e2-b16d-34383ec6c3e8', // Rony Chatterjee
];

/**
 * Client workspace-specific Google Chat webhook URLs
 * Maps workspace IDs to their dedicated notification channels
 * NOTE: Webhook URLs are stored in env vars to avoid secret exposure
 */
const CLIENT_WORKSPACE_WEBHOOKS: Record<string, string> = {
  // ChillMine (CM1) - Brian Neirby - uses GOOGLE_CHAT_CHILLMINE_WEBHOOK_URL env var
  'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7': process.env.GOOGLE_CHAT_CHILLMINE_WEBHOOK_URL || '',
};

/**
 * Send a Reply Agent HITL approval request to Google Chat
 * Routes to different channels based on workspace:
 * - IA workspaces (IA1-IA6) → GOOGLE_CHAT_REPLIES_WEBHOOK_URL (Campaign Replies)
 * - Client replies workspaces (Stan, Samantha, Rony) → GOOGLE_CHAT_CLIENT_REPLIES_WEBHOOK_URL
 * - Client workspaces with dedicated channel → CLIENT_WORKSPACE_WEBHOOKS
 * - Other client workspaces → GOOGLE_CHAT_CLIENT_WEBHOOK_URL (QC channel)
 */
export async function sendReplyAgentHITLNotification(
  notification: ReplyAgentHITLNotification
): Promise<{ success: boolean; error?: string }> {
  const isIAWorkspace = notification.workspaceId && INNOVAREAI_WORKSPACE_IDS.includes(notification.workspaceId);
  const isClientRepliesWorkspace = notification.workspaceId && CLIENT_REPLIES_WORKSPACE_IDS.includes(notification.workspaceId);
  const hasClientWebhook = notification.workspaceId && CLIENT_WORKSPACE_WEBHOOKS[notification.workspaceId];

  let webhookUrl: string | undefined;
  let channelName: string;

  if (isIAWorkspace) {
    webhookUrl = process.env.GOOGLE_CHAT_REPLIES_WEBHOOK_URL;
    channelName = 'Campaign Replies';
    if (!webhookUrl) {
      console.warn('⚠️ GOOGLE_CHAT_REPLIES_WEBHOOK_URL not configured - skipping IA notification');
      return { success: false, error: 'IA webhook URL not configured' };
    }
  } else if (isClientRepliesWorkspace) {
    // Client workspace routed to client replies channel
    webhookUrl = process.env.GOOGLE_CHAT_CLIENT_REPLIES_WEBHOOK_URL;
    channelName = `Client Replies: ${notification.clientName || notification.workspaceId}`;
    if (!webhookUrl) {
      console.warn('⚠️ GOOGLE_CHAT_CLIENT_REPLIES_WEBHOOK_URL not configured - skipping client replies notification');
      return { success: false, error: 'Client replies webhook URL not configured' };
    }
  } else if (hasClientWebhook) {
    // Client has dedicated notification channel
    webhookUrl = CLIENT_WORKSPACE_WEBHOOKS[notification.workspaceId!];
    channelName = `Client: ${notification.clientName || notification.workspaceId}`;
  } else {
    webhookUrl = process.env.GOOGLE_CHAT_CLIENT_WEBHOOK_URL;
    channelName = 'QC';
    if (!webhookUrl) {
      console.warn('⚠️ GOOGLE_CHAT_CLIENT_WEBHOOK_URL not configured - skipping client notification');
      return { success: false, error: 'Client webhook URL not configured' };
    }
  }

  console.log(`📬 Sending notification to ${channelName} channel for workspace ${notification.workspaceId}`);

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

  // Build sections array - always include campaign info and LinkedIn link
  const sections: any[] = [];

  // Campaign info section with LinkedIn link (always shown)
  const infoWidgets: any[] = [];

  if (notification.clientName) {
    infoWidgets.push({
      decoratedText: {
        topLabel: 'Workspace',
        text: notification.clientName,
        startIcon: { knownIcon: 'PERSON' },
      },
    });
  }

  if (notification.campaignName) {
    infoWidgets.push({
      decoratedText: {
        topLabel: 'Campaign',
        text: notification.campaignName,
        startIcon: { knownIcon: 'BOOKMARK' },
      },
    });
  }

  // LinkedIn link - ALWAYS shown
  if (notification.prospectLinkedInUrl) {
    infoWidgets.push({
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

  if (infoWidgets.length > 0) {
    sections.push({
      header: '📋 Campaign Info',
      widgets: infoWidgets,
    });
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

  // For IA workspaces, client replies workspaces, and clients with dedicated webhooks: Include SAM's draft reply and action buttons
  // For other client workspaces: Just a notification (no SAM reply, no buttons)
  const finalSections = [...sections];

  if (isIAWorkspace || isClientRepliesWorkspace || hasClientWebhook) {
    // Add SAM's draft reply section
    finalSections.push({
      header: '💡 SAM\'s Draft Reply',
      widgets: [
        {
          textParagraph: {
            text: notification.draftReply,
          },
        },
      ],
    });

    // Add action buttons section - all in one row: Approve | Edit | Reject
    finalSections.push({
      widgets: [
        {
          buttonList: {
            buttons: [
              {
                text: '✅ Approve',
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
                text: '✏️ Edit',
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
                text: '❌ Reject',
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
      ],
    });
  }

  const message: GoogleChatMessage = {
    // Add @all mention for client workspaces to notify everyone
    text: (hasClientWebhook || isClientRepliesWorkspace) ? '<users/all> 🔔 New reply needs review' : undefined,
    cardsV2: [
      {
        cardId: `reply-agent-${notification.draftId}`,
        card: {
          header: {
            title: `📬 New Reply from ${notification.prospectName}`,
            subtitle: `${notification.prospectTitle || ''} at ${notification.prospectCompany || 'Unknown'}`,
            imageType: 'CIRCLE',
          },
          sections: finalSections,
        },
      },
    ],
  };

  // Send to Campaign Replies channel
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
      console.error(`❌ Reply notification failed:`, errorText);
      return { success: false, error: errorText };
    }

    console.log(`✅ Reply notification sent to Google Chat`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Reply notification error:`, error);
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

/**
 * Send Email Reply Notification
 * Used by ReachInbox webhook handler to notify about incoming email replies
 */
export async function sendEmailReplyNotification(data: {
  prospectEmail: string;
  prospectName?: string;
  campaignName?: string;
  messageText: string;
  intent?: string;
  country?: string;
  emailAccount?: string;
}): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = process.env.GOOGLE_CHAT_REPLIES_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('⚠️ GOOGLE_CHAT_REPLIES_WEBHOOK_URL not configured - skipping email notification');
    return { success: false, error: 'Webhook URL not configured' };
  }

  const intentEmoji: Record<string, string> = {
    'interested': '🔥',
    'booking_request': '📅',
    'question': '❓',
    'timing': '⏰',
    'not_interested': '❌',
    'wrong_person': '🚫',
    'no_response': '📤',
  };

  const emoji = data.intent ? (intentEmoji[data.intent] || '💬') : '📧';

  const sections: any[] = [];

  // Email details section
  const emailWidgets: any[] = [
    {
      decoratedText: {
        topLabel: 'From',
        text: `<b>${data.prospectName || 'Unknown'}</b> &lt;${data.prospectEmail}&gt;`,
        startIcon: { knownIcon: 'PERSON' },
      },
    },
  ];

  if (data.emailAccount) {
    emailWidgets.push({
      decoratedText: {
        topLabel: 'To',
        text: data.emailAccount,
        startIcon: { knownIcon: 'EMAIL' },
      },
    });
  }

  if (data.campaignName) {
    emailWidgets.push({
      decoratedText: {
        topLabel: 'Campaign',
        text: data.campaignName,
        startIcon: { knownIcon: 'BOOKMARK' },
      },
    });
  }

  if (data.country) {
    emailWidgets.push({
      decoratedText: {
        topLabel: 'Region',
        text: data.country,
        startIcon: { knownIcon: 'MAP_PIN' },
      },
    });
  }

  sections.push({
    header: 'Email Details',
    widgets: emailWidgets,
  });

  // Message content section
  const messagePreview = data.messageText.length > 500
    ? data.messageText.substring(0, 500) + '...'
    : data.messageText;

  sections.push({
    header: data.intent ? `Intent: ${emoji} ${data.intent.replace('_', ' ').toUpperCase()}` : 'Message',
    widgets: [
      {
        textParagraph: {
          text: messagePreview,
        },
      },
    ],
  });

  // Add reply action button
  const replyUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(data.prospectEmail)}`;
  sections.push({
    widgets: [
      {
        buttonList: {
          buttons: [
            {
              text: '📧 Reply in Gmail',
              onClick: {
                openLink: { url: replyUrl },
              },
              color: {
                red: 0.063,
                green: 0.722,
                blue: 0.506,
                alpha: 1,
              },
            },
          ],
        },
      },
    ],
  });

  const message: GoogleChatMessage = {
    cardsV2: [
      {
        cardId: `email-reply-${Date.now()}`,
        card: {
          header: {
            title: `📧 New Email Reply from ${data.prospectName || data.prospectEmail}`,
            subtitle: new Date().toLocaleString(),
            imageType: 'CIRCLE',
          },
          sections,
        },
      },
    ],
  };

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
      console.error('❌ Email notification failed:', errorText);
      return { success: false, error: errorText };
    }

    console.log('✅ Email notification sent to Google Chat');
    return { success: true };
  } catch (error) {
    console.error('❌ Email notification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send Campaign Reply Notification (placeholder - to be implemented)
 * Used by Unipile messages webhook handler
 */
export async function sendCampaignReplyNotification(data: {
  from: string;
  message: string;
  campaignName?: string;
  platform?: string;
}): Promise<{ success: boolean; error?: string }> {
  // TODO: Implement campaign reply notification
  console.log("[Campaign Reply Notification]", data);
  return { success: true };
}

/**
 * Send Failed Prospects Alert to Google Chat
 * Includes download link for CSV of failed prospects
 */
export async function sendFailedProspectsAlert(data: {
  campaignId: string;
  campaignName: string;
  workspaceName: string;
  failedCount: number;
  totalProspects: number;
  topErrors: { error: string; count: number }[];
  appUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  // Dedicated webhook for failed prospects downloads
  // NOTE: Webhook URL stored in env var to avoid secret exposure
  const webhookUrl = process.env.GOOGLE_CHAT_DOWNLOADS_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('⚠️ GOOGLE_CHAT_WEBHOOK_URL not configured - skipping failed prospects alert');
    return { success: false, error: 'Webhook URL not configured' };
  }

  const downloadUrl = `${data.appUrl}/api/campaigns/${data.campaignId}/failed-prospects-csv`;
  const resetUrl = `${data.appUrl}/api/campaigns/${data.campaignId}/reset-failed`;
  const failRate = ((data.failedCount / data.totalProspects) * 100).toFixed(1);

  const errorWidgets = data.topErrors.slice(0, 3).map(e => ({
    decoratedText: {
      topLabel: `${e.count}x`,
      text: e.error,
      startIcon: { knownIcon: 'BOOKMARK' },
    },
  }));

  const message: GoogleChatMessage = {
    cardsV2: [
      {
        cardId: `failed-prospects-${Date.now()}`,
        card: {
          header: {
            title: '⚠️ Failed Prospects Alert',
            subtitle: new Date().toLocaleString(),
            imageType: 'CIRCLE',
          },
          sections: [
            {
              widgets: [
                {
                  decoratedText: {
                    topLabel: 'Campaign',
                    text: `<b>${data.campaignName}</b>`,
                    startIcon: { knownIcon: 'BOOKMARK' },
                  },
                },
                {
                  decoratedText: {
                    topLabel: 'Workspace',
                    text: data.workspaceName,
                    startIcon: { knownIcon: 'PERSON' },
                  },
                },
                {
                  decoratedText: {
                    topLabel: 'Failed',
                    text: `<b>${data.failedCount}</b> of ${data.totalProspects} (${failRate}%)`,
                    startIcon: { knownIcon: 'CLOCK' },
                  },
                },
              ],
            },
            ...(errorWidgets.length > 0 ? [{
              header: 'Top Errors',
              widgets: errorWidgets,
            }] : []),
            {
              widgets: [
                {
                  buttonList: {
                    buttons: [
                      {
                        text: '📥 Download CSV',
                        onClick: {
                          openLink: { url: downloadUrl },
                        },
                        color: {
                          red: 0.063,
                          green: 0.722,
                          blue: 0.506,
                          alpha: 1,
                        },
                      },
                      {
                        text: '🔄 Reset & Retry',
                        onClick: {
                          openLink: { url: resetUrl },
                        },
                        color: {
                          red: 0.937,
                          green: 0.604,
                          blue: 0.063,
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

  return sendGoogleChatNotification(message);
}

/**
 * Send Rate Limit Notification to Google Chat
 * Notifies when a LinkedIn account hits its daily sending limit
 */
export async function sendRateLimitNotification(data: {
  accountName: string;
  limitType: 'connection_request' | 'message';
  current: number;
  limit: number;
  pendingCount: number;
  workspaceName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const limitTypeLabel = data.limitType === 'connection_request' ? 'Connection Requests' : 'Messages';
  const emoji = data.limitType === 'connection_request' ? '🔗' : '💬';

  const message: GoogleChatMessage = {
    cardsV2: [
      {
        cardId: `rate-limit-${Date.now()}`,
        card: {
          header: {
            title: `${emoji} Daily Limit Reached`,
            subtitle: new Date().toLocaleString(),
            imageType: 'CIRCLE',
          },
          sections: [
            {
              widgets: [
                {
                  decoratedText: {
                    topLabel: 'Account',
                    text: `<b>${data.accountName}</b>`,
                    startIcon: { knownIcon: 'PERSON' },
                  },
                },
                ...(data.workspaceName ? [{
                  decoratedText: {
                    topLabel: 'Workspace',
                    text: data.workspaceName,
                    startIcon: { knownIcon: 'BOOKMARK' },
                  },
                }] : []),
                {
                  decoratedText: {
                    topLabel: 'Type',
                    text: limitTypeLabel,
                    startIcon: { knownIcon: 'EMAIL' },
                  },
                },
                {
                  decoratedText: {
                    topLabel: 'Today\'s Usage',
                    text: `<b>${data.current}/${data.limit}</b>`,
                    startIcon: { knownIcon: 'CLOCK' },
                  },
                },
              ],
            },
            {
              widgets: [
                {
                  textParagraph: {
                    text: `<i>${data.pendingCount} messages queued and will resume tomorrow.</i>`,
                  },
                },
                {
                  textParagraph: {
                    text: `<font color="#888888">This is normal behavior to protect your LinkedIn account. Limits reset at midnight.</font>`,
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };

  return sendGoogleChatNotification(message);
}
