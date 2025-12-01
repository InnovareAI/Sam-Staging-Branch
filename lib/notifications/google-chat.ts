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
