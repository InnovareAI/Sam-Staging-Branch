/**
 * Comment Variance System for Anti-Detection
 *
 * LinkedIn detects bot patterns by looking for:
 * - Consistent comment lengths (always 50-100 chars = bot)
 * - Same comment type (always statements = bot)
 * - Fixed posting times (same hour daily = bot)
 * - Fixed frequency (every day without breaks = bot)
 * - Same volume (same number daily = bot)
 *
 * This module adds human-like variance to all these dimensions.
 */

// ============================================
// COMMENT LENGTH VARIANCE
// ============================================

export type CommentLengthCategory = 'very_short' | 'short' | 'medium' | 'long' | 'very_long';

export interface CommentLengthRange {
  min: number;
  max: number;
  probability: number; // 0-1, how often to use this length
}

// Human comment length distribution (based on real data)
// Most comments are medium length, with some variation
export const COMMENT_LENGTH_DISTRIBUTION: Record<CommentLengthCategory, CommentLengthRange> = {
  very_short: { min: 15, max: 50, probability: 0.10 },   // 10% - quick reactions
  short: { min: 50, max: 100, probability: 0.25 },       // 25% - brief thoughts
  medium: { min: 100, max: 200, probability: 0.35 },     // 35% - standard comments
  long: { min: 200, max: 350, probability: 0.20 },       // 20% - detailed insights
  very_long: { min: 350, max: 500, probability: 0.10 },  // 10% - mini-essays
};

/**
 * Get a random comment length target based on natural distribution
 */
export function getRandomCommentLength(): { category: CommentLengthCategory; targetLength: number } {
  const rand = Math.random();
  let cumulative = 0;

  for (const [category, range] of Object.entries(COMMENT_LENGTH_DISTRIBUTION)) {
    cumulative += range.probability;
    if (rand <= cumulative) {
      const targetLength = range.min + Math.floor(Math.random() * (range.max - range.min));
      return { category: category as CommentLengthCategory, targetLength };
    }
  }

  // Fallback to medium
  const medium = COMMENT_LENGTH_DISTRIBUTION.medium;
  return {
    category: 'medium',
    targetLength: medium.min + Math.floor(Math.random() * (medium.max - medium.min))
  };
}

// ============================================
// COMMENT TYPE VARIANCE (Questions vs Statements)
// ============================================

export type CommentType = 'question' | 'statement' | 'observation' | 'story' | 'agreement';

// Natural mix of comment types
export const COMMENT_TYPE_DISTRIBUTION: Record<CommentType, number> = {
  question: 0.25,      // 25% end with questions
  statement: 0.30,     // 30% are declarative statements
  observation: 0.20,   // 20% share observations
  story: 0.15,         // 15% tell brief stories
  agreement: 0.10,     // 10% express agreement + add
};

/**
 * Get a random comment type based on natural distribution
 */
export function getRandomCommentType(): CommentType {
  const rand = Math.random();
  let cumulative = 0;

  for (const [type, probability] of Object.entries(COMMENT_TYPE_DISTRIBUTION)) {
    cumulative += probability;
    if (rand <= cumulative) {
      return type as CommentType;
    }
  }

  return 'statement';
}

/**
 * Get prompt modifier for comment type
 */
export function getCommentTypePrompt(type: CommentType): string {
  const prompts: Record<CommentType, string> = {
    question: 'End your comment with a thoughtful question that invites discussion.',
    statement: 'Make a confident statement sharing your perspective. Do NOT ask a question.',
    observation: 'Share an observation or insight. Keep it declarative, no questions.',
    story: 'Share a brief personal story or example (1-2 sentences max). No questions.',
    agreement: 'Express genuine agreement with the author and add one small insight. No questions.',
  };
  return prompts[type];
}

// ============================================
// DAILY VOLUME VARIANCE
// ============================================

export interface DailyVolumeConfig {
  baseMin: number;           // Minimum comments per day
  baseMax: number;           // Maximum comments per day
  skipDayProbability: number; // Probability of skipping a day entirely
}

// Human-like daily volume (most people don't comment same amount every day)
// UPDATED Dec 11, 2025: WARMUP MODE after LinkedIn detection warning
// Starting conservative, will gradually increase over weeks
// Current phase: 1-5 comments/day with 20% skip probability
export const DAILY_VOLUME_CONFIG: DailyVolumeConfig = {
  baseMin: 1,              // Start with just 1 comment minimum
  baseMax: 5,              // Maximum 5 comments per day (cap requested by user)
  skipDayProbability: 0.20, // 20% chance to skip a day
};

/**
 * Get random daily comment limit
 * Returns 0 if this should be a skip day
 */
export function getRandomDailyLimit(): number {
  // Check if we should skip today entirely
  if (Math.random() < DAILY_VOLUME_CONFIG.skipDayProbability) {
    return 0; // Skip day
  }

  // Random limit within range
  const { baseMin, baseMax } = DAILY_VOLUME_CONFIG;
  return baseMin + Math.floor(Math.random() * (baseMax - baseMin + 1));
}

/**
 * Should we skip today entirely?
 * This is decided once per day and stored
 */
export function shouldSkipToday(dayOfWeek: number): { skip: boolean; reason?: string } {
  // Always more likely to skip weekends (people comment less)
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const skipProbability = isWeekend ? 0.40 : 0.12;

  if (Math.random() < skipProbability) {
    return {
      skip: true,
      reason: isWeekend ? 'Weekend skip (40% probability)' : 'Random skip day (12% probability)'
    };
  }

  return { skip: false };
}

// ============================================
// POSTING TIME VARIANCE
// ============================================

export interface PostingTimeWindow {
  startHour: number;  // 24-hour format
  endHour: number;
  probability: number;
}

// Natural posting time distribution (when humans actually comment)
export const POSTING_TIME_WINDOWS: PostingTimeWindow[] = [
  { startHour: 6, endHour: 8, probability: 0.10 },    // 10% - early morning
  { startHour: 8, endHour: 10, probability: 0.20 },   // 20% - morning commute
  { startHour: 10, endHour: 12, probability: 0.15 }, // 15% - late morning
  { startHour: 12, endHour: 14, probability: 0.20 }, // 20% - lunch break
  { startHour: 14, endHour: 17, probability: 0.15 }, // 15% - afternoon
  { startHour: 17, endHour: 19, probability: 0.15 }, // 15% - evening commute
  { startHour: 19, endHour: 22, probability: 0.05 }, // 5% - evening
];

/**
 * Get a random posting hour based on natural distribution
 */
export function getRandomPostingHour(): number {
  const rand = Math.random();
  let cumulative = 0;

  for (const window of POSTING_TIME_WINDOWS) {
    cumulative += window.probability;
    if (rand <= cumulative) {
      // Random hour within this window
      return window.startHour + Math.floor(Math.random() * (window.endHour - window.startHour));
    }
  }

  // Fallback to noon
  return 12;
}

/**
 * Get random minute (spread throughout the hour)
 */
export function getRandomPostingMinute(): number {
  return Math.floor(Math.random() * 60);
}

/**
 * Calculate next posting time with variance
 * Returns a Date object for when the next comment should be scheduled
 */
export function getNextPostingTime(
  timezone: string,
  lastPostTime?: Date,
  commentsPostedToday: number = 0
): Date {
  const now = new Date();

  // If we've already posted a lot today, increase the gap
  const minGapMinutes = commentsPostedToday > 5 ? 60 : 30;
  const maxGapMinutes = commentsPostedToday > 5 ? 180 : 90;

  const gapMinutes = minGapMinutes + Math.floor(Math.random() * (maxGapMinutes - minGapMinutes));

  // If there was a last post, add gap from that
  if (lastPostTime) {
    const nextTime = new Date(lastPostTime.getTime() + gapMinutes * 60 * 1000);
    // But not more than 4 hours out
    const maxFuture = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    return nextTime > maxFuture ? maxFuture : nextTime;
  }

  // Otherwise, schedule based on current time + gap
  return new Date(now.getTime() + gapMinutes * 60 * 1000);
}

// ============================================
// GAP BETWEEN COMMENTS VARIANCE
// ============================================

/**
 * Get random gap between comments in minutes
 * Humans don't comment at fixed intervals
 */
export function getRandomCommentGap(): number {
  // Distribution: mostly 30-60 min gaps, occasional quick bursts, occasional long gaps
  const rand = Math.random();

  if (rand < 0.10) {
    // 10% - Quick follow-up (5-15 min)
    return 5 + Math.floor(Math.random() * 10);
  } else if (rand < 0.70) {
    // 60% - Normal gap (30-90 min)
    return 30 + Math.floor(Math.random() * 60);
  } else if (rand < 0.90) {
    // 20% - Longer gap (90-180 min)
    return 90 + Math.floor(Math.random() * 90);
  } else {
    // 10% - Very long gap (3-6 hours)
    return 180 + Math.floor(Math.random() * 180);
  }
}

// ============================================
// FULL VARIANCE CONTEXT FOR AI
// ============================================

export interface CommentVarianceContext {
  targetLength: number;
  lengthCategory: CommentLengthCategory;
  commentType: CommentType;
  typePrompt: string;
  scheduledGapMinutes: number;
}

/**
 * Get full variance context for generating a comment
 */
export function getCommentVarianceContext(): CommentVarianceContext {
  const { category, targetLength } = getRandomCommentLength();
  const commentType = getRandomCommentType();

  return {
    targetLength,
    lengthCategory: category,
    commentType,
    typePrompt: getCommentTypePrompt(commentType),
    scheduledGapMinutes: getRandomCommentGap(),
  };
}

/**
 * Build variance instructions for AI prompt
 */
export function buildVariancePromptInstructions(context: CommentVarianceContext): string {
  // Emoji variance: 30% chance to include emoji instruction
  const includeEmoji = Math.random() < 0.30;
  const emojiInstruction = includeEmoji
    ? '\n- Include 1-2 relevant emojis naturally (not at the start)'
    : '\n- Do NOT use any emojis in this comment';

  return `
## VARIANCE INSTRUCTIONS (CRITICAL FOR ANTI-DETECTION)

**Length Target**: Aim for approximately ${context.targetLength} characters (category: ${context.lengthCategory})
- Short comments are okay and often more impactful
- Long comments should add significant value
- Don't force length - natural is best

**Comment Type**: ${context.commentType.toUpperCase()}
${context.typePrompt}

**Style Variation**:
- Vary your opening style (don't always start with "Great point!" or similar)
- Mix up sentence structure
- Use different phrasings for similar ideas${emojiInstruction}
`;
}

// ============================================
// TYPING DELAY SIMULATION
// Simulates human reading post + typing comment
// ============================================

/**
 * Get random typing delay in milliseconds
 * Simulates time spent reading post and typing comment
 * Humans take 15-45 seconds to read a post and type a thoughtful response
 */
export function getTypingDelayMs(): number {
  // 15-45 seconds delay (15000-45000ms)
  return 15000 + Math.floor(Math.random() * 30000);
}

// ============================================
// BUSINESS HOURS WEIGHTING
// 80% of comments during business hours (8am-6pm)
// ============================================

/**
 * Check if current time is within business hours
 * Returns adjustment factor for scheduling
 */
export function isBusinessHours(hour: number): boolean {
  return hour >= 8 && hour < 18;
}

/**
 * Get scheduling adjustment based on time of day
 * Delays non-business hour posts to next business window
 */
export function getBusinessHoursDelay(): number {
  const now = new Date();
  const hour = now.getHours();

  // 80% chance to enforce business hours
  if (Math.random() < 0.80) {
    if (hour < 8) {
      // Before 8am - delay to 8am + random minutes
      const minutesToEight = (8 - hour) * 60 - now.getMinutes();
      return minutesToEight + Math.floor(Math.random() * 60);
    } else if (hour >= 18) {
      // After 6pm - delay to next day 8am + random
      const minutesToMidnight = (24 - hour) * 60 - now.getMinutes();
      const minutesTo8am = 8 * 60;
      return minutesToMidnight + minutesTo8am + Math.floor(Math.random() * 60);
    }
  }

  return 0; // No delay needed
}

// ============================================
// SESSION-BASED ACTIVITY
// Comments come in bursts, not evenly spread
// ============================================

export interface SessionConfig {
  isInSession: boolean;
  commentsInSession: number;
  sessionGapMinutes: number;
}

/**
 * Determine if we should start a new session or continue existing
 * Sessions are 2-4 comments with short gaps, then long break
 */
export function getSessionBehavior(commentsToday: number): SessionConfig {
  // Session size: 2-4 comments
  const sessionSize = 2 + Math.floor(Math.random() * 3);

  // Are we mid-session?
  const positionInSession = commentsToday % sessionSize;
  const isInSession = positionInSession > 0 && positionInSession < sessionSize;

  if (isInSession) {
    // Short gap within session (5-20 min)
    return {
      isInSession: true,
      commentsInSession: positionInSession,
      sessionGapMinutes: 5 + Math.floor(Math.random() * 15)
    };
  } else {
    // Long gap between sessions (2-4 hours)
    return {
      isInSession: false,
      commentsInSession: 0,
      sessionGapMinutes: 120 + Math.floor(Math.random() * 120)
    };
  }
}

// ============================================
// HOLIDAY SKIPPING
// Skip major US/EU holidays
// ============================================

const HOLIDAYS_2024_2025 = [
  // 2024
  '2024-12-24', '2024-12-25', '2024-12-26', // Christmas
  '2024-12-31', // New Year's Eve
  // 2025
  '2025-01-01', // New Year's Day
  '2025-01-20', // MLK Day
  '2025-02-17', // Presidents Day
  '2025-04-18', '2025-04-21', // Easter weekend
  '2025-05-26', // Memorial Day
  '2025-07-04', // Independence Day
  '2025-09-01', // Labor Day
  '2025-10-13', // Columbus Day
  '2025-11-11', // Veterans Day
  '2025-11-27', '2025-11-28', // Thanksgiving
  '2025-12-24', '2025-12-25', '2025-12-26', // Christmas
  '2025-12-31', // New Year's Eve
  '2026-01-01', // New Year's Day
];

/**
 * Check if today is a holiday
 */
export function isHoliday(date: Date = new Date()): { isHoliday: boolean; holidayName?: string } {
  const dateStr = date.toISOString().split('T')[0];

  if (HOLIDAYS_2024_2025.includes(dateStr)) {
    // Get holiday name
    const month = date.getMonth();
    const day = date.getDate();

    if (month === 11 && (day >= 24 && day <= 26)) return { isHoliday: true, holidayName: 'Christmas' };
    if (month === 11 && day === 31) return { isHoliday: true, holidayName: "New Year's Eve" };
    if (month === 0 && day === 1) return { isHoliday: true, holidayName: "New Year's Day" };
    if (month === 10 && (day === 27 || day === 28)) return { isHoliday: true, holidayName: 'Thanksgiving' };
    if (month === 6 && day === 4) return { isHoliday: true, holidayName: 'Independence Day' };

    return { isHoliday: true, holidayName: 'Holiday' };
  }

  return { isHoliday: false };
}

// ============================================
// ACCOUNT WARM-UP MODE
// New accounts start slow and gradually increase
// ============================================

export interface WarmupConfig {
  accountAgeDays: number;
  maxCommentsPerDay: number;
  isWarmupMode: boolean;
}

/**
 * Get warm-up configuration based on account age
 * Week 1: 1 comment/day
 * Week 2: 2 comments/day
 * Week 3: 3 comments/day
 * Week 4+: Normal limits
 */
export function getWarmupConfig(accountCreatedAt: Date): WarmupConfig {
  const now = new Date();
  const ageMs = now.getTime() - accountCreatedAt.getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  if (ageDays < 7) {
    return { accountAgeDays: ageDays, maxCommentsPerDay: 1, isWarmupMode: true };
  } else if (ageDays < 14) {
    return { accountAgeDays: ageDays, maxCommentsPerDay: 2, isWarmupMode: true };
  } else if (ageDays < 21) {
    return { accountAgeDays: ageDays, maxCommentsPerDay: 3, isWarmupMode: true };
  } else if (ageDays < 28) {
    return { accountAgeDays: ageDays, maxCommentsPerDay: 4, isWarmupMode: true };
  }

  return { accountAgeDays: ageDays, maxCommentsPerDay: 5, isWarmupMode: false };
}

// ============================================
// LIKE-BEFORE-COMMENT
// Sometimes like the post before commenting
// ============================================

/**
 * Should we like the post before commenting?
 * 50% chance to like first
 */
export function shouldLikeBeforeComment(): boolean {
  return Math.random() < 0.50;
}

/**
 * Get delay between liking and commenting (if liking first)
 * 10-30 seconds - simulates continued reading after liking before typing
 */
export function getLikeToCommentDelayMs(): number {
  return 10000 + Math.floor(Math.random() * 20000);
}

// ============================================
// PROFILE VIEW SIMULATION
// Sometimes view author profile before commenting
// ============================================

/**
 * Should we view the author's profile before commenting?
 * 40% chance to view profile first
 */
export function shouldViewProfileFirst(): boolean {
  return Math.random() < 0.40;
}

/**
 * Get delay after viewing profile before commenting
 * 20-60 seconds - simulates thoroughly reading someone's profile
 */
export function getProfileViewDelayMs(): number {
  return 20000 + Math.floor(Math.random() * 40000);
}

// ============================================
// COMBINED ANTI-DETECTION CONTEXT
// ============================================

export interface AntiDetectionContext {
  typingDelayMs: number;
  businessHoursDelayMinutes: number;
  session: SessionConfig;
  shouldLikeFirst: boolean;
  likeToCommentDelayMs: number;
  shouldViewProfile: boolean;
  profileViewDelayMs: number;
  includeEmoji: boolean;
}

/**
 * Get full anti-detection context for a comment
 */
export function getAntiDetectionContext(commentsToday: number = 0): AntiDetectionContext {
  const shouldLikeFirst = shouldLikeBeforeComment();
  const shouldViewProfile = shouldViewProfileFirst();

  return {
    typingDelayMs: getTypingDelayMs(),
    businessHoursDelayMinutes: getBusinessHoursDelay(),
    session: getSessionBehavior(commentsToday),
    shouldLikeFirst,
    likeToCommentDelayMs: shouldLikeFirst ? getLikeToCommentDelayMs() : 0,
    shouldViewProfile,
    profileViewDelayMs: shouldViewProfile ? getProfileViewDelayMs() : 0,
    includeEmoji: Math.random() < 0.30,
  };
}
