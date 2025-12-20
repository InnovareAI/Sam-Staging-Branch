/**
 * Link Tracking Service
 * Creates unique tracked links per recipient for agentic follow-up
 *
 * Flow:
 * 1. Reply Agent generates message with links
 * 2. This service wraps links with unique tracked URLs
 * 3. When prospect clicks, we log it and trigger agent actions
 *
 * Created: December 20, 2025
 */

import { createClient } from '@supabase/supabase-js';

// ============================================
// TYPES
// ============================================

export type LinkType = 'calendar' | 'demo_video' | 'one_pager' | 'case_study' | 'trial' | 'website' | 'other';

export interface TrackedLink {
  id: string;
  shortCode: string;
  destinationUrl: string;
  linkType: LinkType;
  prospectId: string;
  campaignId?: string;
  workspaceId: string;
  trackedUrl: string;  // The full URL to use in messages
}

export interface LinkClickEvent {
  trackedLinkId: string;
  prospectId: string;
  linkType: LinkType;
  destinationUrl: string;
  isFirstClick: boolean;
  clickedAt: Date;
}

// ============================================
// CONFIGURATION
// ============================================

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';
const TRACKING_PATH = '/t';  // Short path for tracked links

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// LINK TYPE DETECTION
// ============================================

const LINK_TYPE_PATTERNS: Array<{ type: LinkType; patterns: RegExp[] }> = [
  {
    type: 'calendar',
    patterns: [
      /calendly\.com/i,
      /cal\.com/i,
      /hubspot\.com\/meetings/i,
      /acuityscheduling\.com/i,
      /outlook\.office365\.com\/owa\/calendar/i,
      /calendar\.google\.com\/calendar\/appointments/i,
      /links\.innovareai\.com\/SamAIDemo/i,  // Our custom calendar link
    ],
  },
  {
    type: 'demo_video',
    patterns: [
      /loom\.com/i,
      /youtube\.com/i,
      /youtu\.be/i,
      /vimeo\.com/i,
      /wistia\.com/i,
      /vidyard\.com/i,
      /demo/i,
    ],
  },
  {
    type: 'one_pager',
    patterns: [
      /\.pdf$/i,
      /one-pager/i,
      /onepager/i,
      /fact-sheet/i,
      /brochure/i,
      /docsend\.com/i,
    ],
  },
  {
    type: 'case_study',
    patterns: [
      /case-study/i,
      /casestudy/i,
      /success-story/i,
      /customer-story/i,
    ],
  },
  {
    type: 'trial',
    patterns: [
      /trial/i,
      /signup/i,
      /sign-up/i,
      /get-started/i,
      /start-free/i,
    ],
  },
];

/**
 * Detect link type from URL
 */
export function detectLinkType(url: string): LinkType {
  for (const { type, patterns } of LINK_TYPE_PATTERNS) {
    if (patterns.some(pattern => pattern.test(url))) {
      return type;
    }
  }
  return 'website';
}

// ============================================
// TRACKED LINK CREATION
// ============================================

/**
 * Generate a unique short code
 */
function generateShortCode(length: number = 8): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';  // No confusing chars
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Create a tracked link for a specific prospect
 * Returns existing link if one already exists for this prospect + URL combo
 */
export async function createTrackedLink(params: {
  destinationUrl: string;
  prospectId: string;
  workspaceId: string;
  campaignId?: string;
  sourceType?: 'reply_agent' | 'follow_up_agent' | 'campaign_sequence' | 'manual';
  sourceId?: string;
  linkType?: LinkType;  // Override auto-detection
}): Promise<TrackedLink> {
  const linkType = params.linkType || detectLinkType(params.destinationUrl);

  // Check if we already have a tracked link for this prospect + destination
  const { data: existing } = await supabase
    .from('tracked_links')
    .select('*')
    .eq('prospect_id', params.prospectId)
    .eq('destination_url', params.destinationUrl)
    .single();

  if (existing) {
    return {
      id: existing.id,
      shortCode: existing.short_code,
      destinationUrl: existing.destination_url,
      linkType: existing.link_type,
      prospectId: existing.prospect_id,
      campaignId: existing.campaign_id,
      workspaceId: existing.workspace_id,
      trackedUrl: `${APP_URL}${TRACKING_PATH}/${existing.short_code}`,
    };
  }

  // Create new tracked link
  let shortCode = generateShortCode();
  let attempts = 0;

  // Ensure unique short code
  while (attempts < 5) {
    const { data: existing } = await supabase
      .from('tracked_links')
      .select('id')
      .eq('short_code', shortCode)
      .single();

    if (!existing) break;
    shortCode = generateShortCode();
    attempts++;
  }

  const { data: newLink, error } = await supabase
    .from('tracked_links')
    .insert({
      short_code: shortCode,
      destination_url: params.destinationUrl,
      link_type: linkType,
      prospect_id: params.prospectId,
      campaign_id: params.campaignId,
      workspace_id: params.workspaceId,
      source_type: params.sourceType,
      source_id: params.sourceId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create tracked link: ${error.message}`);
  }

  console.log(`Created tracked link: ${shortCode} → ${params.destinationUrl} (${linkType})`);

  return {
    id: newLink.id,
    shortCode: newLink.short_code,
    destinationUrl: newLink.destination_url,
    linkType: newLink.link_type,
    prospectId: newLink.prospect_id,
    campaignId: newLink.campaign_id,
    workspaceId: newLink.workspace_id,
    trackedUrl: `${APP_URL}${TRACKING_PATH}/${newLink.short_code}`,
  };
}

/**
 * Replace all trackable links in a message with tracked versions
 */
export async function wrapLinksWithTracking(params: {
  message: string;
  prospectId: string;
  workspaceId: string;
  campaignId?: string;
  sourceType?: 'reply_agent' | 'follow_up_agent' | 'campaign_sequence' | 'manual';
  sourceId?: string;
}): Promise<{ message: string; trackedLinks: TrackedLink[] }> {
  const urlPattern = /https?:\/\/[^\s"<>\)]+/gi;
  const urls = params.message.match(urlPattern) || [];
  const trackedLinks: TrackedLink[] = [];

  let newMessage = params.message;

  for (const url of urls) {
    // Clean URL (remove trailing punctuation)
    const cleanUrl = url.replace(/[.,;:!?'")\]}>]+$/, '');

    // Skip our own tracking URLs
    if (cleanUrl.includes(`${APP_URL}${TRACKING_PATH}/`)) continue;

    // Skip certain URLs that shouldn't be tracked
    if (shouldSkipTracking(cleanUrl)) continue;

    try {
      const trackedLink = await createTrackedLink({
        destinationUrl: cleanUrl,
        prospectId: params.prospectId,
        workspaceId: params.workspaceId,
        campaignId: params.campaignId,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
      });

      // Replace URL in message
      newMessage = newMessage.replace(cleanUrl, trackedLink.trackedUrl);
      trackedLinks.push(trackedLink);
    } catch (err) {
      console.error(`Failed to create tracked link for ${cleanUrl}:`, err);
      // Keep original URL if tracking fails
    }
  }

  return { message: newMessage, trackedLinks };
}

/**
 * URLs that shouldn't be tracked
 */
function shouldSkipTracking(url: string): boolean {
  const skipPatterns = [
    /linkedin\.com\/in\//i,      // LinkedIn profile URLs (not trackable)
    /linkedin\.com\/company\//i, // LinkedIn company URLs
    /mailto:/i,                  // Email links
    /tel:/i,                     // Phone links
    /unsubscribe/i,              // Unsubscribe links
    /privacy/i,                  // Privacy policy
    /terms/i,                    // Terms of service
  ];

  return skipPatterns.some(pattern => pattern.test(url));
}

// ============================================
// CLICK RECORDING
// ============================================

/**
 * Record a link click and trigger agent actions
 */
export async function recordLinkClick(params: {
  shortCode: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
}): Promise<{ destinationUrl: string; linkClickEvent: LinkClickEvent } | null> {
  // Find the tracked link
  const { data: trackedLink, error: findError } = await supabase
    .from('tracked_links')
    .select('*')
    .eq('short_code', params.shortCode)
    .single();

  if (findError || !trackedLink) {
    console.error(`Tracked link not found: ${params.shortCode}`);
    return null;
  }

  // Check if this is the first click
  const { count } = await supabase
    .from('link_clicks')
    .select('*', { count: 'exact', head: true })
    .eq('tracked_link_id', trackedLink.id);

  const isFirstClick = count === 0;

  // Record the click
  const { error: clickError } = await supabase
    .from('link_clicks')
    .insert({
      tracked_link_id: trackedLink.id,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      referrer: params.referrer,
      is_first_click: isFirstClick,
    });

  if (clickError) {
    console.error(`Failed to record click: ${clickError.message}`);
  }

  // Update prospect engagement metrics
  await updateProspectEngagement(trackedLink.prospect_id, trackedLink.link_type, isFirstClick);

  const clickEvent: LinkClickEvent = {
    trackedLinkId: trackedLink.id,
    prospectId: trackedLink.prospect_id,
    linkType: trackedLink.link_type,
    destinationUrl: trackedLink.destination_url,
    isFirstClick,
    clickedAt: new Date(),
  };

  // Trigger agent actions for significant clicks
  if (isFirstClick) {
    await triggerAgentOnClick(clickEvent, trackedLink.workspace_id);
  }

  console.log(`Link click recorded: ${params.shortCode} (${trackedLink.link_type}) - first: ${isFirstClick}`);

  return {
    destinationUrl: trackedLink.destination_url,
    linkClickEvent: clickEvent,
  };
}

/**
 * Update prospect engagement metrics based on click
 */
async function updateProspectEngagement(
  prospectId: string,
  linkType: LinkType,
  isFirstClick: boolean
): Promise<void> {
  const updates: Record<string, any> = {
    total_link_clicks: supabase.rpc('increment', { row_id: prospectId, column_name: 'total_link_clicks' }),
    last_link_click_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Update first-click timestamps for specific link types
  if (isFirstClick) {
    switch (linkType) {
      case 'calendar':
        updates.first_calendar_click_at = new Date().toISOString();
        break;
      case 'demo_video':
        updates.first_demo_click_at = new Date().toISOString();
        break;
      case 'one_pager':
      case 'case_study':
        updates.first_pdf_click_at = new Date().toISOString();
        break;
    }
  }

  // Simple update (increment handled separately)
  await supabase
    .from('campaign_prospects')
    .update({
      last_link_click_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(isFirstClick && linkType === 'calendar' ? { first_calendar_click_at: new Date().toISOString() } : {}),
      ...(isFirstClick && linkType === 'demo_video' ? { first_demo_click_at: new Date().toISOString() } : {}),
      ...(isFirstClick && (linkType === 'one_pager' || linkType === 'case_study') ? { first_pdf_click_at: new Date().toISOString() } : {}),
    })
    .eq('id', prospectId);

  // Increment total clicks
  await supabase.rpc('increment_link_clicks', { prospect_id: prospectId });
}

/**
 * Trigger agent actions based on link click
 */
async function triggerAgentOnClick(
  clickEvent: LinkClickEvent,
  workspaceId: string
): Promise<void> {
  console.log(`Agent trigger: ${clickEvent.linkType} clicked by prospect ${clickEvent.prospectId}`);

  // Different actions based on link type
  switch (clickEvent.linkType) {
    case 'calendar':
      // High intent! Prospect clicked calendar but may not have booked
      // Calendar Agent will follow up if no booking detected
      await supabase
        .from('campaign_prospects')
        .update({
          conversation_stage: 'calendar_clicked_pending_booking',
          // Set follow-up for 24 hours from now (give them time to book)
          calendar_follow_up_due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', clickEvent.prospectId);
      console.log(`Calendar clicked - will follow up in 24h if no booking`);
      break;

    case 'demo_video':
      // Good engagement signal
      await supabase
        .from('campaign_prospects')
        .update({
          conversation_stage: 'engaged_watching_demo',
          updated_at: new Date().toISOString(),
        })
        .eq('id', clickEvent.prospectId);
      console.log(`Demo video clicked - prospect is engaged`);
      break;

    case 'one_pager':
    case 'case_study':
      // Research phase - they're evaluating
      await supabase
        .from('campaign_prospects')
        .update({
          conversation_stage: 'engaged_researching',
          updated_at: new Date().toISOString(),
        })
        .eq('id', clickEvent.prospectId);
      console.log(`Document clicked - prospect is researching`);
      break;

    case 'trial':
      // Very high intent!
      await supabase
        .from('campaign_prospects')
        .update({
          conversation_stage: 'trial_started',
          updated_at: new Date().toISOString(),
        })
        .eq('id', clickEvent.prospectId);
      console.log(`Trial clicked - very high intent!`);
      break;
  }
}

// ============================================
// ANALYTICS
// ============================================

/**
 * Get click analytics for a prospect
 */
export async function getProspectClickAnalytics(prospectId: string): Promise<{
  totalClicks: number;
  clicksByType: Record<LinkType, number>;
  firstClickAt: Date | null;
  lastClickAt: Date | null;
  clickedCalendar: boolean;
  clickedDemo: boolean;
  clickedDocument: boolean;
}> {
  const { data: clicks } = await supabase
    .from('link_clicks')
    .select(`
      clicked_at,
      tracked_links!inner (
        link_type,
        prospect_id
      )
    `)
    .eq('tracked_links.prospect_id', prospectId)
    .order('clicked_at', { ascending: true });

  const clicksByType: Record<LinkType, number> = {
    calendar: 0,
    demo_video: 0,
    one_pager: 0,
    case_study: 0,
    trial: 0,
    website: 0,
    other: 0,
  };

  if (!clicks || clicks.length === 0) {
    return {
      totalClicks: 0,
      clicksByType,
      firstClickAt: null,
      lastClickAt: null,
      clickedCalendar: false,
      clickedDemo: false,
      clickedDocument: false,
    };
  }

  for (const click of clicks) {
    const linkType = (click.tracked_links as any).link_type as LinkType;
    clicksByType[linkType]++;
  }

  return {
    totalClicks: clicks.length,
    clicksByType,
    firstClickAt: new Date(clicks[0].clicked_at),
    lastClickAt: new Date(clicks[clicks.length - 1].clicked_at),
    clickedCalendar: clicksByType.calendar > 0,
    clickedDemo: clicksByType.demo_video > 0,
    clickedDocument: clicksByType.one_pager > 0 || clicksByType.case_study > 0,
  };
}

// ============================================
// EXPORTS
// ============================================

export default {
  detectLinkType,
  createTrackedLink,
  wrapLinksWithTracking,
  recordLinkClick,
  getProspectClickAnalytics,
};
