/**
 * Message Variance System for Anti-Detection
 *
 * LinkedIn detects bot patterns by looking for:
 * - Fixed follow-up intervals (exactly 5 days every time = bot)
 * - Same message length patterns (always 200 chars = bot)
 * - Same opening styles ("Hi {name}," every time = bot)
 * - No delay between actions (instant send = bot)
 * - Same time of day patterns (always 9am = bot)
 * - Mechanical A/B testing (every other person = bot)
 *
 * This module adds human-like variance to LinkedIn campaign messaging.
 */

// ============================================
// FOLLOW-UP INTERVAL VARIANCE
// Current: Fixed [5, 7, 5, 7] days (detectable pattern!)
// Human: Random variance around base intervals
// ============================================

export interface FollowUpIntervalConfig {
  baseIntervals: number[];  // Base days between follow-ups
  varianceRange: number;    // +/- days variance
  skipProbability: number;  // Chance to skip a follow-up entirely
}

// Human-like follow-up intervals with variance
export const FOLLOW_UP_CONFIG: FollowUpIntervalConfig = {
  baseIntervals: [5, 7, 5, 7],  // FU1: +5d, FU2: +7d, FU3: +5d, FU4: +7d
  varianceRange: 2,             // +/- 2 days variance
  skipProbability: 0.05,        // 5% chance to skip a follow-up (human hesitation)
};

/**
 * Get randomized follow-up interval for a specific follow-up number
 * @param followUpIndex 0 = FU1, 1 = FU2, etc.
 * @returns Days to wait, or -1 if should skip this follow-up
 */
export function getRandomizedFollowUpInterval(followUpIndex: number): number {
  // Check if we should skip this follow-up (human hesitation)
  if (Math.random() < FOLLOW_UP_CONFIG.skipProbability) {
    return -1; // Skip this follow-up
  }

  const baseInterval = FOLLOW_UP_CONFIG.baseIntervals[followUpIndex] || 7;
  const variance = FOLLOW_UP_CONFIG.varianceRange;

  // Random variance: baseInterval +/- variance days
  // Using gaussian-like distribution (more likely to be near base)
  const randomVariance = (Math.random() + Math.random() - 1) * variance;
  const days = Math.round(baseInterval + randomVariance);

  // Ensure minimum 3 days, maximum 14 days
  return Math.max(3, Math.min(14, days));
}

/**
 * Get all follow-up intervals for a campaign at once
 * Pre-generates variance for consistency within a campaign
 */
export function generateCampaignFollowUpSchedule(): number[] {
  return FOLLOW_UP_CONFIG.baseIntervals.map((_, index) =>
    getRandomizedFollowUpInterval(index)
  );
}

// ============================================
// MESSAGE LENGTH VARIANCE
// LinkedIn DMs should vary in length like human messages
// ============================================

export type MessageLengthCategory = 'brief' | 'short' | 'medium' | 'detailed' | 'comprehensive';

export interface MessageLengthRange {
  min: number;
  max: number;
  probability: number;
}

// Human DM length distribution (connection requests and follow-ups)
// Most messages are short-medium (LinkedIn has 300 char limit for CRs)
export const MESSAGE_LENGTH_DISTRIBUTION: Record<MessageLengthCategory, MessageLengthRange> = {
  brief: { min: 50, max: 100, probability: 0.15 },         // 15% - Quick, direct
  short: { min: 100, max: 150, probability: 0.30 },        // 30% - Concise
  medium: { min: 150, max: 220, probability: 0.35 },       // 35% - Standard
  detailed: { min: 220, max: 280, probability: 0.15 },     // 15% - Thorough
  comprehensive: { min: 280, max: 300, probability: 0.05 }, // 5% - Near limit
};

/**
 * Get a random target message length
 */
export function getRandomMessageLength(): { category: MessageLengthCategory; targetLength: number } {
  const rand = Math.random();
  let cumulative = 0;

  for (const [category, range] of Object.entries(MESSAGE_LENGTH_DISTRIBUTION)) {
    cumulative += range.probability;
    if (rand <= cumulative) {
      const targetLength = range.min + Math.floor(Math.random() * (range.max - range.min));
      return { category: category as MessageLengthCategory, targetLength };
    }
  }

  return { category: 'medium', targetLength: 180 };
}

// ============================================
// MESSAGE STYLE VARIANCE
// Different opening styles, tones, and structures
// ============================================

export type MessageTone = 'friendly' | 'professional' | 'casual' | 'direct' | 'warm';
export type OpeningStyle = 'name_first' | 'greeting_first' | 'context_first' | 'question_first' | 'observation_first';

export const MESSAGE_TONE_DISTRIBUTION: Record<MessageTone, number> = {
  friendly: 0.30,      // 30% - Approachable
  professional: 0.25,  // 25% - Business-like
  casual: 0.20,        // 20% - Relaxed
  direct: 0.15,        // 15% - To the point
  warm: 0.10,          // 10% - Personal
};

export const OPENING_STYLE_DISTRIBUTION: Record<OpeningStyle, number> = {
  name_first: 0.35,       // 35% - "Hi Sarah,"
  greeting_first: 0.25,   // 25% - "Hey there! I noticed..."
  context_first: 0.20,    // 20% - "I came across your profile..."
  question_first: 0.10,   // 10% - "Are you still working on...?"
  observation_first: 0.10, // 10% - "Interesting background in..."
};

/**
 * Get random message tone
 */
export function getRandomMessageTone(): MessageTone {
  const rand = Math.random();
  let cumulative = 0;

  for (const [tone, probability] of Object.entries(MESSAGE_TONE_DISTRIBUTION)) {
    cumulative += probability;
    if (rand <= cumulative) {
      return tone as MessageTone;
    }
  }

  return 'friendly';
}

/**
 * Get random opening style
 */
export function getRandomOpeningStyle(): OpeningStyle {
  const rand = Math.random();
  let cumulative = 0;

  for (const [style, probability] of Object.entries(OPENING_STYLE_DISTRIBUTION)) {
    cumulative += probability;
    if (rand <= cumulative) {
      return style as OpeningStyle;
    }
  }

  return 'name_first';
}

/**
 * Get opening style prompt instructions for AI
 */
export function getOpeningStylePrompt(style: OpeningStyle): string {
  const prompts: Record<OpeningStyle, string> = {
    name_first: 'Start with their name directly (e.g., "Hi [Name]," or "[Name] -")',
    greeting_first: 'Start with a greeting before their name (e.g., "Hey there!" or "Hello!")',
    context_first: 'Start with context/observation before greeting (e.g., "I came across your profile..." or "Noticed your work at...")',
    question_first: 'Start with a relevant question (e.g., "Are you still focused on...?" or "Quick question -")',
    observation_first: 'Start with an observation about them (e.g., "Interesting background in..." or "Your experience with...")',
  };
  return prompts[style];
}

/**
 * Get tone prompt instructions for AI
 */
export function getTonePrompt(tone: MessageTone): string {
  const prompts: Record<MessageTone, string> = {
    friendly: 'Use a friendly, approachable tone. Be personable but professional.',
    professional: 'Use a professional, business-focused tone. Be respectful and formal.',
    casual: 'Use a casual, relaxed tone. Write like you are messaging a colleague.',
    direct: 'Be direct and to the point. Skip pleasantries, focus on value.',
    warm: 'Use a warm, personal tone. Show genuine interest in connecting.',
  };
  return prompts[tone];
}

// ============================================
// HUMAN-LIKE DELAYS FOR MESSAGING
// Simulate reading profile, composing message
// ============================================

/**
 * Get delay before sending a connection request (ms)
 * Simulates: viewing profile, reading about them, composing message
 */
export function getPreSendDelayMs(): number {
  // 30-90 seconds (30000-90000ms)
  // Humans take time to read a profile before reaching out
  return 30000 + Math.floor(Math.random() * 60000);
}

/**
 * Get delay for composing a message (ms)
 * Simulates: thinking about what to say, typing
 */
export function getComposingDelayMs(messageLength: number): number {
  // Base: 20-40 seconds
  // Plus: ~50ms per character (typing speed ~20 wpm with pauses)
  const baseDelay = 20000 + Math.floor(Math.random() * 20000);
  const typingDelay = messageLength * 50;
  return baseDelay + typingDelay;
}

/**
 * Get delay between messages in a session (ms)
 * When sending multiple CRs, humans don't do them back-to-back
 */
export function getBetweenMessageDelayMs(): number {
  // 2-5 minutes between messages in a session
  // Distribution: mostly 2-3 min, occasionally longer
  const rand = Math.random();

  if (rand < 0.60) {
    // 60% - Short gap (2-3 min)
    return 120000 + Math.floor(Math.random() * 60000);
  } else if (rand < 0.90) {
    // 30% - Medium gap (3-5 min)
    return 180000 + Math.floor(Math.random() * 120000);
  } else {
    // 10% - Long gap (5-10 min) - got distracted
    return 300000 + Math.floor(Math.random() * 300000);
  }
}

// ============================================
// IMPROVED A/B TESTING DISTRIBUTION
// Current: Even/odd = 50/50 split (too mechanical)
// Human: Natural distribution with primary bias
// ============================================

export interface ABTestResult {
  variant: 'A' | 'B';
  reason: string;
}

/**
 * Get A/B test variant with human-like distribution
 * NOT a mechanical 50/50 split
 */
export function getABTestVariant(prospectIndex: number, seed?: string): ABTestResult {
  // Use multiple factors to determine variant, not just even/odd

  // Factor 1: Base random chance (60/40 instead of 50/50)
  const baseChance = Math.random();

  // Factor 2: Time-based variation (different hours = different bias)
  const hour = new Date().getHours();
  const hourBias = hour < 12 ? 0.05 : -0.05; // Slightly more A in morning

  // Factor 3: Day-based variation
  const dayOfWeek = new Date().getDay();
  const dayBias = dayOfWeek % 2 === 0 ? 0.03 : -0.03;

  // Combined probability for variant A
  const probA = 0.55 + hourBias + dayBias;

  if (baseChance < probA) {
    return { variant: 'A', reason: 'Primary variant (natural distribution)' };
  } else {
    return { variant: 'B', reason: 'Alternate variant (natural distribution)' };
  }
}

// ============================================
// MESSAGE SCHEDULING VARIANCE
// When to send messages throughout the day
// ============================================

export interface MessageScheduleConfig {
  preferredHours: number[];  // Preferred hours to send
  avoidHours: number[];      // Hours to avoid
  weekendBehavior: 'skip' | 'reduce' | 'normal';
}

export const MESSAGE_SCHEDULE_CONFIG: MessageScheduleConfig = {
  preferredHours: [9, 10, 11, 14, 15, 16], // Business hours
  avoidHours: [0, 1, 2, 3, 4, 5, 6, 22, 23], // Night hours
  weekendBehavior: 'reduce', // Reduce activity on weekends
};

/**
 * Get optimal send time with variance
 */
export function getOptimalSendTime(baseDate: Date = new Date()): Date {
  const result = new Date(baseDate);

  // Pick a random preferred hour
  const preferredHours = MESSAGE_SCHEDULE_CONFIG.preferredHours;
  const randomHour = preferredHours[Math.floor(Math.random() * preferredHours.length)];

  // Add random minutes (not always :00)
  const randomMinute = Math.floor(Math.random() * 60);

  result.setHours(randomHour, randomMinute, 0, 0);

  // If result is in the past, move to next day
  if (result <= baseDate) {
    result.setDate(result.getDate() + 1);
  }

  // Weekend handling
  const dayOfWeek = result.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    if (MESSAGE_SCHEDULE_CONFIG.weekendBehavior === 'skip') {
      // Move to Monday
      const daysToAdd = dayOfWeek === 0 ? 1 : 2;
      result.setDate(result.getDate() + daysToAdd);
    } else if (MESSAGE_SCHEDULE_CONFIG.weekendBehavior === 'reduce') {
      // 70% chance to skip weekends
      if (Math.random() < 0.70) {
        const daysToAdd = dayOfWeek === 0 ? 1 : 2;
        result.setDate(result.getDate() + daysToAdd);
      }
    }
  }

  return result;
}

// ============================================
// PER-PROSPECT VARIANCE CONSISTENCY
// Same prospect should get consistent style within campaign
// ============================================

/**
 * Generate a deterministic but varied style based on prospect ID
 * This ensures the same prospect gets consistent messaging style
 */
export function getProspectStyle(prospectId: string): {
  tone: MessageTone;
  openingStyle: OpeningStyle;
  lengthBias: 'shorter' | 'normal' | 'longer';
} {
  // Use prospect ID to seed consistent randomness
  const hash = simpleHash(prospectId);

  // Deterministic tone based on hash
  const tones: MessageTone[] = ['friendly', 'professional', 'casual', 'direct', 'warm'];
  const tone = tones[hash % tones.length];

  // Deterministic opening style
  const styles: OpeningStyle[] = ['name_first', 'greeting_first', 'context_first', 'question_first', 'observation_first'];
  const openingStyle = styles[(hash >> 4) % styles.length];

  // Length bias
  const biases: ('shorter' | 'normal' | 'longer')[] = ['shorter', 'normal', 'longer'];
  const lengthBias = biases[(hash >> 8) % biases.length];

  return { tone, openingStyle, lengthBias };
}

/**
 * Simple hash function for prospect ID
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// ============================================
// HARD LIMITS FOR MESSAGING
// ============================================

export const MESSAGE_HARD_LIMITS = {
  // Daily limits per LinkedIn account
  MAX_CONNECTION_REQUESTS_PER_DAY: 25,
  MAX_MESSAGES_PER_DAY: 50,

  // Weekly limits
  MAX_CONNECTION_REQUESTS_PER_WEEK: 100, // LinkedIn's known limit
  MAX_MESSAGES_PER_WEEK: 200,

  // Monthly limits
  MAX_OPEN_INMAILS_PER_MONTH: 100, // LinkedIn Sales Navigator limit

  // Hourly limits (burst protection)
  MAX_CONNECTION_REQUESTS_PER_HOUR: 5,
  MAX_MESSAGES_PER_HOUR: 10,

  // Minimum gaps
  MIN_CR_GAP_MINUTES: 20,      // At least 20 min between CRs
  MIN_MESSAGE_GAP_MINUTES: 5,  // At least 5 min between messages

  // Error handling
  MAX_ERRORS_BEFORE_PAUSE: 3,
  PAUSE_DURATION_HOURS: 24,
};

/**
 * Check if messaging limits are reached
 */
export function shouldStopMessaging(stats: {
  crsToday: number;
  crsThisWeek: number;
  crsThisHour: number;
  messagesToday: number;
  messagesThisHour: number;
  consecutiveErrors: number;
}): { stop: boolean; reason?: string } {
  if (stats.crsToday >= MESSAGE_HARD_LIMITS.MAX_CONNECTION_REQUESTS_PER_DAY) {
    return { stop: true, reason: `Daily CR limit (${stats.crsToday}/${MESSAGE_HARD_LIMITS.MAX_CONNECTION_REQUESTS_PER_DAY})` };
  }

  if (stats.crsThisWeek >= MESSAGE_HARD_LIMITS.MAX_CONNECTION_REQUESTS_PER_WEEK) {
    return { stop: true, reason: `Weekly CR limit (${stats.crsThisWeek}/${MESSAGE_HARD_LIMITS.MAX_CONNECTION_REQUESTS_PER_WEEK})` };
  }

  if (stats.crsThisHour >= MESSAGE_HARD_LIMITS.MAX_CONNECTION_REQUESTS_PER_HOUR) {
    return { stop: true, reason: `Hourly CR limit (${stats.crsThisHour}/${MESSAGE_HARD_LIMITS.MAX_CONNECTION_REQUESTS_PER_HOUR})` };
  }

  if (stats.messagesToday >= MESSAGE_HARD_LIMITS.MAX_MESSAGES_PER_DAY) {
    return { stop: true, reason: `Daily message limit (${stats.messagesToday}/${MESSAGE_HARD_LIMITS.MAX_MESSAGES_PER_DAY})` };
  }

  if (stats.consecutiveErrors >= MESSAGE_HARD_LIMITS.MAX_ERRORS_BEFORE_PAUSE) {
    return { stop: true, reason: `Too many errors (${stats.consecutiveErrors}), pausing` };
  }

  return { stop: false };
}

// ============================================
// FULL MESSAGE VARIANCE CONTEXT
// ============================================

export interface MessageVarianceContext {
  // Timing
  preSendDelayMs: number;
  composingDelayMs: number;
  betweenMessageDelayMs: number;

  // Style
  tone: MessageTone;
  tonePrompt: string;
  openingStyle: OpeningStyle;
  openingPrompt: string;

  // Length
  targetLength: number;
  lengthCategory: MessageLengthCategory;

  // A/B testing
  abVariant: 'A' | 'B';

  // Follow-up scheduling
  followUpIntervalDays: number;

  // Skip probability
  shouldSkip: boolean;
  skipReason?: string;
}

/**
 * Get full variance context for a message
 */
export function getMessageVarianceContext(
  prospectId: string,
  followUpIndex: number = 0,
  messageLength: number = 150
): MessageVarianceContext {
  // Get prospect-consistent style
  const prospectStyle = getProspectStyle(prospectId);

  // Get random length with prospect bias
  const { category, targetLength } = getRandomMessageLength();
  const adjustedLength = adjustLengthForBias(targetLength, prospectStyle.lengthBias);

  // Check if we should skip (human hesitation)
  const skipRoll = Math.random();
  const shouldSkip = skipRoll < 0.02; // 2% skip rate for individual messages

  return {
    // Timing
    preSendDelayMs: getPreSendDelayMs(),
    composingDelayMs: getComposingDelayMs(messageLength),
    betweenMessageDelayMs: getBetweenMessageDelayMs(),

    // Style (use prospect-consistent style)
    tone: prospectStyle.tone,
    tonePrompt: getTonePrompt(prospectStyle.tone),
    openingStyle: prospectStyle.openingStyle,
    openingPrompt: getOpeningStylePrompt(prospectStyle.openingStyle),

    // Length
    targetLength: adjustedLength,
    lengthCategory: category,

    // A/B testing
    abVariant: getABTestVariant(0, prospectId).variant,

    // Follow-up scheduling
    followUpIntervalDays: getRandomizedFollowUpInterval(followUpIndex),

    // Skip
    shouldSkip,
    skipReason: shouldSkip ? 'Random skip (human hesitation)' : undefined,
  };
}

/**
 * Adjust target length based on prospect's length bias
 */
function adjustLengthForBias(targetLength: number, bias: 'shorter' | 'normal' | 'longer'): number {
  switch (bias) {
    case 'shorter':
      return Math.max(50, Math.round(targetLength * 0.85));
    case 'longer':
      return Math.min(300, Math.round(targetLength * 1.15));
    default:
      return targetLength;
  }
}

/**
 * Build variance instructions for AI prompt
 */
export function buildMessageVariancePrompt(context: MessageVarianceContext): string {
  return `
## MESSAGE VARIANCE INSTRUCTIONS (ANTI-DETECTION)

**Tone**: ${context.tone.toUpperCase()}
${context.tonePrompt}

**Opening Style**: ${context.openingStyle.replace('_', ' ')}
${context.openingPrompt}

**Length Target**: ~${context.targetLength} characters (${context.lengthCategory})
- Stay within ${context.targetLength - 30} to ${context.targetLength + 30} chars
- Don't pad for length - natural is better
- LinkedIn CR limit is 300 chars

**Style Tips**:
- Vary sentence structure
- Don't always start with "I"
- Mix short and medium sentences
- Sound human, not templated
`;
}

// ============================================
// LINKEDIN WARNING DETECTION (MESSAGING)
// Same patterns as commenting, applied to messages
// ============================================

const MESSAGE_WARNING_PATTERNS = [
  'unusual activity',
  'temporarily restricted',
  'invitation limit',
  'weekly limit',
  'too many requests',
  'slow down',
  'action blocked',
  'pending invitations',
  'can\'t send more',
];

/**
 * Check if a LinkedIn API response indicates a messaging warning
 */
export function isMessageWarning(responseText: string): { isWarning: boolean; pattern?: string } {
  const lowerText = responseText.toLowerCase();

  for (const pattern of MESSAGE_WARNING_PATTERNS) {
    if (lowerText.includes(pattern)) {
      return { isWarning: true, pattern };
    }
  }

  return { isWarning: false };
}
