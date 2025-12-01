/**
 * Google Chat Webhook Notification Helper
 *
 * Sends formatted messages to Google Chat spaces via incoming webhooks.
 *
 * Setup:
 * 1. Open Google Chat space → Apps & Integrations → Webhooks → Create
 * 2. Copy the webhook URL and add to .env.local as GOOGLE_CHAT_WEBHOOK_URL
 */

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

  const typeLabels: Record<string, string> = {
    'daily-health-check': 'Daily Health Check',
    'qa-monitor': 'QA Monitor',
    'rate-limit': 'Rate Limit Monitor',
    'data-quality': 'Data Quality Check',
  };

  const timestamp = notification.timestamp || new Date().toISOString();
  const formattedTime = new Date(timestamp).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Build check results section
  const checkWidgets: any[] = [];
  if (notification.checks && notification.checks.length > 0) {
    notification.checks.forEach((check) => {
      const checkEmoji = check.status === 'healthy' || check.status === 'pass' ? '✅' :
                         check.status === 'warning' ? '⚠️' : '❌';
      checkWidgets.push({
        decoratedText: {
          topLabel: check.name,
          text: `${checkEmoji} ${check.details}`,
        },
      });
    });
  }

  // Build recommendations section
  const recommendationWidgets: any[] = [];
  if (notification.recommendations && notification.recommendations.length > 0) {
    notification.recommendations.forEach((rec, idx) => {
      recommendationWidgets.push({
        decoratedText: {
          text: `${idx + 1}. ${rec}`,
        },
      });
    });
  }

  const sections: any[] = [
    {
      widgets: [
        {
          decoratedText: {
            topLabel: 'Status',
            text: `<font color="${statusColor}"><b>${notification.status.toUpperCase()}</b></font>`,
          },
        },
        {
          decoratedText: {
            topLabel: 'Summary',
            text: notification.summary,
          },
        },
        {
          decoratedText: {
            topLabel: 'Timestamp',
            text: `${formattedTime} PT`,
          },
        },
      ],
    },
  ];

  // Add checks section if present
  if (checkWidgets.length > 0) {
    sections.push({
      header: 'Check Results',
      widgets: checkWidgets.slice(0, 10), // Limit to 10 checks
    });
  }

  // Add recommendations section if present
  if (recommendationWidgets.length > 0) {
    sections.push({
      header: '📋 Recommendations',
      widgets: recommendationWidgets.slice(0, 5), // Limit to 5 recommendations
    });
  }

  // Add duration if present
  if (notification.duration_ms) {
    sections[0].widgets.push({
      decoratedText: {
        topLabel: 'Duration',
        text: `${(notification.duration_ms / 1000).toFixed(1)}s`,
      },
    });
  }

  const message: GoogleChatMessage = {
    cardsV2: [
      {
        cardId: `health-check-${Date.now()}`,
        card: {
          header: {
            title: `${statusEmoji} SAM ${typeLabels[notification.type] || notification.type}`,
            subtitle: `Status: ${notification.status.toUpperCase()}`,
            imageUrl: 'https://app.meet-sam.com/sam-icon.png',
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
 * Send a simple text notification
 */
export async function sendGoogleChatText(text: string): Promise<{ success: boolean; error?: string }> {
  return sendGoogleChatNotification({ text });
}

// ============================================
// CAMPAIGN REPLY NOTIFICATIONS
// ============================================

// Workspace IDs for IA1-IA7 (InnovareAI workspaces)
const IA_WORKSPACE_IDS = [
  'babdcab8-1a78-4b2f-913e-6e9fd9821009', // IA1
  '04666209-fce8-4d71-8eaf-01278edfc73b', // IA2
  '96c03b38-a2f4-40de-9e16-43098599e1d4', // IA3
  '7f0341da-88db-476b-ae0a-fc0da5b70861', // IA4
  'cd57981a-e63b-401c-bde1-ac71752c2293', // IA5
  '2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c', // IA6
  // IA7 - add when created
];

export interface CampaignReplyNotification {
  workspaceId: string;
  workspaceName?: string;
  prospectName: string;
  prospectCompany?: string;
  messageText: string;
  intent?: string;
  intentConfidence?: number;
  draft?: string;
  isFromCampaign: boolean;
  replyId?: string;
  linkedInAccountName?: string;
}

/**
 * Check if workspace should receive Google Chat reply notifications
 */
export function shouldSendReplyNotification(workspaceId: string): boolean {
  return IA_WORKSPACE_IDS.includes(workspaceId);
}

/**
 * Send a campaign reply notification to the dedicated replies channel
 * Only sends for IA1-IA7 workspaces
 */
export async function sendCampaignReplyNotification(
  notification: CampaignReplyNotification
): Promise<{ success: boolean; error?: string }> {
  // Only send for IA workspaces
  if (!shouldSendReplyNotification(notification.workspaceId)) {
    console.log(`📭 Skipping Google Chat notification - workspace ${notification.workspaceId} not in IA1-IA7`);
    return { success: true, error: 'Workspace not configured for notifications' };
  }

  const webhookUrl = process.env.GOOGLE_CHAT_REPLIES_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('⚠️ GOOGLE_CHAT_REPLIES_WEBHOOK_URL not configured - skipping reply notification');
    return { success: false, error: 'Replies webhook URL not configured' };
  }

  // Determine intent emoji and color
  const intentEmoji = {
    interested: '🟢',
    booking_request: '🔥',
    question: '❓',
    not_interested: '🔴',
    out_of_office: '🏖️',
    other: '💬',
  }[notification.intent || 'other'] || '💬';

  const intentColor = {
    interested: '#34a853',
    booking_request: '#ea4335',
    question: '#4285f4',
    not_interested: '#9e9e9e',
    out_of_office: '#fbbc04',
    other: '#5f6368',
  }[notification.intent || 'other'] || '#5f6368';

  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Build the notification card
  const sections: any[] = [
    {
      widgets: [
        {
          decoratedText: {
            topLabel: 'From',
            text: `<b>${notification.prospectName}</b>${notification.prospectCompany ? ` at ${notification.prospectCompany}` : ''}`,
          },
        },
        {
          decoratedText: {
            topLabel: notification.isFromCampaign ? 'Campaign Reply' : '🌟 Organic Lead',
            text: notification.isFromCampaign
              ? 'Responded to outreach campaign'
              : 'Not in any campaign - reached out directly',
          },
        },
      ],
    },
    {
      header: '💬 Message',
      widgets: [
        {
          textParagraph: {
            text: notification.messageText.length > 500
              ? notification.messageText.substring(0, 500) + '...'
              : notification.messageText,
          },
        },
      ],
    },
  ];

  // Add intent section if available
  if (notification.intent) {
    sections[0].widgets.push({
      decoratedText: {
        topLabel: 'Intent',
        text: `<font color="${intentColor}"><b>${notification.intent.replace('_', ' ').toUpperCase()}</b></font>${notification.intentConfidence ? ` (${(notification.intentConfidence * 100).toFixed(0)}%)` : ''}`,
      },
    });
  }

  // Add draft section if available
  if (notification.draft) {
    sections.push({
      header: '✍️ Suggested Reply',
      widgets: [
        {
          textParagraph: {
            text: notification.draft.length > 400
              ? notification.draft.substring(0, 400) + '...'
              : notification.draft,
          },
        },
      ],
    });
  }

  // Add footer with workspace and timestamp
  sections.push({
    widgets: [
      {
        decoratedText: {
          topLabel: 'Workspace',
          text: notification.workspaceName || notification.workspaceId.substring(0, 8),
        },
      },
      {
        decoratedText: {
          topLabel: 'Time',
          text: `${timestamp} PT`,
        },
      },
      ...(notification.replyId ? [{
        buttonList: {
          buttons: [
            {
              text: 'View in SAM',
              onClick: {
                openLink: {
                  url: `https://app.meet-sam.com/replies/${notification.replyId}`,
                },
              },
            },
          ],
        },
      }] : []),
    ],
  });

  const titleEmoji = notification.isFromCampaign ? intentEmoji : '🌟';
  const title = notification.isFromCampaign
    ? `${intentEmoji} Campaign Reply`
    : '🌟 New Organic Lead';

  const message: GoogleChatMessage = {
    cardsV2: [
      {
        cardId: `reply-${Date.now()}`,
        card: {
          header: {
            title,
            subtitle: notification.prospectName,
            imageUrl: 'https://app.meet-sam.com/sam-icon.png',
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
      console.error('❌ Google Chat reply notification failed:', errorText);
      return { success: false, error: errorText };
    }

    console.log('✅ Google Chat reply notification sent for', notification.prospectName);
    return { success: true };
  } catch (error) {
    console.error('❌ Google Chat reply notification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// DAILY CAMPAIGN SUMMARY NOTIFICATIONS
// ============================================

export interface DailyCampaignSummary {
  period: string; // e.g., "Last 24 hours"
  totalConnectionRequests: number;
  totalAccepted: number;
  totalReplies: number;
  totalMessages: number;
  acceptRate: number;
  replyRate: number;
  byWorkspace: {
    workspaceId: string;
    workspaceName: string;
    connectionRequests: number;
    accepted: number;
    replies: number;
    messages: number;
  }[];
  byIntent?: {
    intent: string;
    count: number;
  }[];
  topPerformingCampaigns?: {
    name: string;
    acceptRate: number;
    replyRate: number;
  }[];
}

/**
 * Send daily campaign summary to the replies channel
 */
export async function sendDailyCampaignSummary(
  summary: DailyCampaignSummary
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = process.env.GOOGLE_CHAT_REPLIES_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('⚠️ GOOGLE_CHAT_REPLIES_WEBHOOK_URL not configured - skipping summary');
    return { success: false, error: 'Replies webhook URL not configured' };
  }

  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Build workspace breakdown
  const workspaceWidgets: any[] = summary.byWorkspace.map((ws) => ({
    decoratedText: {
      topLabel: ws.workspaceName,
      text: `📤 ${ws.connectionRequests} CRs | ✅ ${ws.accepted} accepts | 💬 ${ws.replies} replies`,
    },
  }));

  // Build intent breakdown if available
  const intentWidgets: any[] = [];
  if (summary.byIntent && summary.byIntent.length > 0) {
    const intentEmojis: Record<string, string> = {
      interested: '🟢',
      booking_request: '🔥',
      question: '❓',
      not_interested: '🔴',
      out_of_office: '🏖️',
      other: '💬',
    };

    summary.byIntent.forEach((item) => {
      intentWidgets.push({
        decoratedText: {
          text: `${intentEmojis[item.intent] || '💬'} ${item.intent.replace('_', ' ')}: ${item.count}`,
        },
      });
    });
  }

  const sections: any[] = [
    {
      widgets: [
        {
          decoratedText: {
            topLabel: 'Period',
            text: summary.period,
          },
        },
        {
          decoratedText: {
            topLabel: 'Connection Requests Sent',
            text: `<b>${summary.totalConnectionRequests}</b>`,
          },
        },
        {
          decoratedText: {
            topLabel: 'Connections Accepted',
            text: `<b>${summary.totalAccepted}</b> (${summary.acceptRate.toFixed(1)}% rate)`,
          },
        },
        {
          decoratedText: {
            topLabel: 'Replies Received',
            text: `<b>${summary.totalReplies}</b> (${summary.replyRate.toFixed(1)}% rate)`,
          },
        },
        {
          decoratedText: {
            topLabel: 'Follow-up Messages Sent',
            text: `<b>${summary.totalMessages}</b>`,
          },
        },
      ],
    },
  ];

  // Add workspace breakdown
  if (workspaceWidgets.length > 0) {
    sections.push({
      header: '📊 By Workspace',
      widgets: workspaceWidgets.slice(0, 7), // Max 7 workspaces
    });
  }

  // Add intent breakdown
  if (intentWidgets.length > 0) {
    sections.push({
      header: '🎯 Reply Intents',
      widgets: intentWidgets.slice(0, 6), // Max 6 intents
    });
  }

  // Add timestamp
  sections.push({
    widgets: [
      {
        decoratedText: {
          topLabel: 'Report Generated',
          text: `${timestamp} PT`,
        },
      },
    ],
  });

  const message: GoogleChatMessage = {
    cardsV2: [
      {
        cardId: `daily-summary-${Date.now()}`,
        card: {
          header: {
            title: '📈 Daily Campaign Summary',
            subtitle: summary.period,
            imageUrl: 'https://app.meet-sam.com/sam-icon.png',
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
      console.error('❌ Google Chat daily summary failed:', errorText);
      return { success: false, error: errorText };
    }

    console.log('✅ Google Chat daily campaign summary sent');
    return { success: true };
  } catch (error) {
    console.error('❌ Google Chat daily summary error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get the list of IA workspace IDs for summary queries
 */
export function getIAWorkspaceIds(): string[] {
  return [...IA_WORKSPACE_IDS];
}

// ============================================
// EMAIL CAMPAIGN REPLY NOTIFICATIONS (ReachInbox)
// ============================================

export interface EmailReplyNotification {
  prospectEmail: string;
  prospectName: string;
  campaignName: string;
  messageText: string;
  intent: string;
  country?: string;
  emailAccount?: string;
}

/**
 * Send an email campaign reply notification to Google Chat
 * Used for ReachInbox cold email replies
 */
export async function sendEmailReplyNotification(
  notification: EmailReplyNotification
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = process.env.GOOGLE_CHAT_REPLIES_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('⚠️ GOOGLE_CHAT_REPLIES_WEBHOOK_URL not configured - skipping email reply notification');
    return { success: false, error: 'Replies webhook URL not configured' };
  }

  // Determine intent emoji and color
  const intentEmoji = {
    interested: '🟢',
    booking_request: '🔥',
    question: '❓',
    not_interested: '🔴',
    timing: '⏰',
    wrong_person: '👤',
    other: '💬',
  }[notification.intent || 'other'] || '💬';

  const intentColor = {
    interested: '#34a853',
    booking_request: '#ea4335',
    question: '#4285f4',
    not_interested: '#9e9e9e',
    timing: '#fbbc04',
    wrong_person: '#ff9800',
    other: '#5f6368',
  }[notification.intent || 'other'] || '#5f6368';

  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'Europe/Berlin',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Truncate message for display
  const truncatedMessage = notification.messageText.length > 500
    ? notification.messageText.substring(0, 500) + '...'
    : notification.messageText;

  const sections: any[] = [
    {
      widgets: [
        {
          decoratedText: {
            topLabel: 'From',
            text: `<b>${notification.prospectName}</b>`,
          },
        },
        {
          decoratedText: {
            topLabel: 'Email',
            text: notification.prospectEmail,
          },
        },
        {
          decoratedText: {
            topLabel: 'Intent',
            text: `<font color="${intentColor}"><b>${notification.intent.replace('_', ' ').toUpperCase()}</b></font>`,
          },
        },
      ],
    },
    {
      header: '💬 Reply Message',
      widgets: [
        {
          textParagraph: {
            text: truncatedMessage,
          },
        },
      ],
    },
    {
      widgets: [
        {
          decoratedText: {
            topLabel: 'Campaign',
            text: notification.campaignName,
          },
        },
        ...(notification.country ? [{
          decoratedText: {
            topLabel: 'Region',
            text: notification.country,
          },
        }] : []),
        {
          decoratedText: {
            topLabel: 'Time',
            text: `${timestamp} CET`,
          },
        },
      ],
    },
  ];

  // Determine if this is a positive/hot lead
  const isPositive = ['interested', 'booking_request', 'question'].includes(notification.intent);
  const title = isPositive
    ? `${intentEmoji} Hot Email Lead!`
    : `${intentEmoji} Email Reply`;

  const message: GoogleChatMessage = {
    cardsV2: [
      {
        cardId: `email-reply-${Date.now()}`,
        card: {
          header: {
            title,
            subtitle: `${notification.prospectName} - ${notification.campaignName}`,
            imageUrl: 'https://app.meet-sam.com/sam-icon.png',
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
      console.error('❌ Google Chat email reply notification failed:', errorText);
      return { success: false, error: errorText };
    }

    console.log('✅ Google Chat email reply notification sent for', notification.prospectEmail);
    return { success: true };
  } catch (error) {
    console.error('❌ Google Chat email reply notification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
