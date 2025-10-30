/**
 * Calendar Link Helper
 * Detects calendar intent in prospect messages and injects calendar links
 */

export interface CalendarSettings {
  calendar_enabled: boolean;
  calendar_provider: 'calendly' | 'cal.com' | 'google' | 'outlook';
  calendar_link: string;
  booking_instructions?: string;
  auto_include_on_intent: boolean;
  calendar_intent_keywords?: string[];
  exclude_keywords?: string[];
}

/**
 * Detect if prospect message indicates calendar/scheduling intent
 */
export function detectCalendarIntent(
  prospectMessage: string,
  settings?: CalendarSettings
): {
  has_intent: boolean;
  confidence: number;
  matched_keywords: string[];
} {
  const messageLower = prospectMessage.toLowerCase();

  // Default keywords if not provided
  const intentKeywords = settings?.calendar_intent_keywords || [
    'schedule', 'call', 'meeting', 'book', 'available',
    'free', 'time', 'calendar', 'discuss', 'talk',
    'chat', 'connect', 'demo', 'when', 'setup'
  ];

  const excludeKeywords = settings?.exclude_keywords || [
    'not interested', 'no thanks', 'remove', 'unsubscribe',
    'stop', 'not now', 'later', 'busy'
  ];

  // Check for exclusions first
  const hasExclusion = excludeKeywords.some(keyword =>
    messageLower.includes(keyword.toLowerCase())
  );

  if (hasExclusion) {
    return {
      has_intent: false,
      confidence: 0,
      matched_keywords: []
    };
  }

  // Check for calendar intent keywords
  const matchedKeywords = intentKeywords.filter(keyword =>
    messageLower.includes(keyword.toLowerCase())
  );

  // Calculate confidence based on number of matches
  const confidence = Math.min(matchedKeywords.length / 2, 1); // Cap at 2 matches = 100%

  // Strong phrases that indicate high intent
  const strongPhrases = [
    'let\'s schedule',
    'when can we',
    'book a time',
    'set up a call',
    'hop on a call',
    'when are you available',
    'find a time',
    'calendar link'
  ];

  const hasStrongPhrase = strongPhrases.some(phrase =>
    messageLower.includes(phrase)
  );

  if (hasStrongPhrase) {
    return {
      has_intent: true,
      confidence: 1.0,
      matched_keywords: matchedKeywords
    };
  }

  return {
    has_intent: matchedKeywords.length >= 1,
    confidence,
    matched_keywords: matchedKeywords
  };
}

/**
 * Format calendar link for inclusion in message
 */
export function formatCalendarLinkForMessage(
  calendarLink: string,
  bookingInstructions?: string
): string {
  const instructions = bookingInstructions || 'Feel free to book a time that works for you:';

  return `${instructions}\n${calendarLink}`;
}

/**
 * Add calendar link to AI draft based on intent
 */
export function enhanceDraftWithCalendarLink(
  draft: string,
  calendarSettings: CalendarSettings,
  prospectMessage: string
): {
  enhanced_draft: string;
  calendar_included: boolean;
  reason?: string;
} {
  // Check if calendar is enabled
  if (!calendarSettings.calendar_enabled || !calendarSettings.calendar_link) {
    return {
      enhanced_draft: draft,
      calendar_included: false,
      reason: 'Calendar not enabled or link not configured'
    };
  }

  // Detect calendar intent
  const intent = detectCalendarIntent(prospectMessage, calendarSettings);

  // If no intent or auto-include is disabled, return original draft
  if (!intent.has_intent) {
    return {
      enhanced_draft: draft,
      calendar_included: false,
      reason: 'No calendar intent detected'
    };
  }

  if (!calendarSettings.auto_include_on_intent) {
    return {
      enhanced_draft: draft,
      calendar_included: false,
      reason: 'Auto-include disabled'
    };
  }

  // Check if draft already includes the calendar link
  if (draft.includes(calendarSettings.calendar_link)) {
    return {
      enhanced_draft: draft,
      calendar_included: true,
      reason: 'Calendar link already in draft'
    };
  }

  // Add calendar link to end of draft
  const calendarSection = formatCalendarLinkForMessage(
    calendarSettings.calendar_link,
    calendarSettings.booking_instructions
  );

  const enhancedDraft = `${draft.trim()}\n\n${calendarSection}`;

  return {
    enhanced_draft: enhancedDraft,
    calendar_included: true,
    reason: `Calendar intent detected (confidence: ${(intent.confidence * 100).toFixed(0)}%)`
  };
}

/**
 * Get calendar settings for workspace
 */
export async function getWorkspaceCalendarSettings(
  workspaceId: string,
  supabase: any
): Promise<CalendarSettings | null> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('calendar_settings')
    .eq('id', workspaceId)
    .single();

  if (error || !data || !data.calendar_settings) {
    console.log('No calendar settings found for workspace:', workspaceId);
    return null;
  }

  return data.calendar_settings as CalendarSettings;
}

/**
 * Update AI system prompt to mention calendar link availability
 */
export function enhanceSystemPromptWithCalendar(
  originalPrompt: string,
  calendarSettings: CalendarSettings
): string {
  if (!calendarSettings.calendar_enabled || !calendarSettings.calendar_link) {
    return originalPrompt;
  }

  const calendarInstructions = `\n\n## Calendar Availability
You have a calendar link available: ${calendarSettings.calendar_link}

If the prospect indicates interest in scheduling a call/meeting (keywords: schedule, call, meeting, book, available, time), mention that you'd be happy to connect and naturally transition to suggesting they book a time.

Examples:
- "I'd love to discuss this further! Feel free to grab a time on my calendar: [link]"
- "Let's hop on a quick call to walk through this. Here's my calendar: [link]"
- "Happy to show you a demo! You can book a time here: [link]"

DO NOT force the calendar link if they're not interested in scheduling. Only include it when relevant to the conversation flow.`;

  return originalPrompt + calendarInstructions;
}

/**
 * Validate calendar link format
 */
export function validateCalendarLink(link: string, provider: string): {
  valid: boolean;
  error?: string;
} {
  try {
    const url = new URL(link);

    switch (provider) {
      case 'calendly':
        if (!url.hostname.includes('calendly.com')) {
          return { valid: false, error: 'Invalid Calendly URL' };
        }
        break;

      case 'cal.com':
        if (!url.hostname.includes('cal.com')) {
          return { valid: false, error: 'Invalid Cal.com URL' };
        }
        break;

      case 'google':
        if (!url.hostname.includes('google.com') && !url.hostname.includes('calendar.google.com')) {
          return { valid: false, error: 'Invalid Google Calendar URL' };
        }
        break;

      case 'outlook':
        if (!url.hostname.includes('outlook.com') && !url.hostname.includes('office.com')) {
          return { valid: false, error: 'Invalid Outlook Calendar URL' };
        }
        break;
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}
