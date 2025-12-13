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
 * Simple seeded random number generator (Mulberry32)
 */
function seededRandom(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Convert workspace ID to numeric seed
 */
function workspaceToSeed(workspaceId: string): number {
  let hash = 0;
  for (let i = 0; i < workspaceId.length; i++) {
    const char = workspaceId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Get workspace-specific variance context
 * Each workspace gets a unique but consistent pattern:
 * - Different type preferences (some more question-heavy, some more statement-heavy)
 * - Different length preferences (some prefer shorter, some prefer longer)
 */
export function getWorkspaceVarianceContext(workspaceId: string): CommentVarianceContext {
  // Create workspace-specific RNG
  const baseSeed = workspaceToSeed(workspaceId);
  const dateSeed = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const rng = seededRandom(baseSeed + parseInt(dateSeed.slice(-4)));

  // Workspace-specific type bias (shifts probabilities by ±15%)
  const typeBias = (rng() - 0.5) * 0.30; // -0.15 to +0.15
  const adjustedTypeDistribution = { ...COMMENT_TYPE_DISTRIBUTION };

  // Shift question probability for this workspace
  const questionShift = typeBias;
  adjustedTypeDistribution.question = Math.max(0.10, Math.min(0.40, adjustedTypeDistribution.question + questionShift));
  adjustedTypeDistribution.statement = Math.max(0.15, Math.min(0.45, adjustedTypeDistribution.statement - questionShift * 0.5));

  // Get comment type with workspace bias
  const typeRand = rng();
  let cumulative = 0;
  let commentType: CommentType = 'statement';

  for (const [type, probability] of Object.entries(adjustedTypeDistribution)) {
    cumulative += probability;
    if (typeRand <= cumulative) {
      commentType = type as CommentType;
      break;
    }
  }

  // Workspace-specific length bias (some workspaces prefer shorter/longer)
  const lengthBias = (rng() - 0.5) * 0.30;
  const adjustedLengthDistribution = { ...COMMENT_LENGTH_DISTRIBUTION };

  if (lengthBias > 0) {
    // Prefer longer comments
    adjustedLengthDistribution.short.probability -= lengthBias * 0.5;
    adjustedLengthDistribution.long.probability += lengthBias * 0.5;
  } else {
    // Prefer shorter comments
    adjustedLengthDistribution.short.probability += Math.abs(lengthBias) * 0.5;
    adjustedLengthDistribution.long.probability -= Math.abs(lengthBias) * 0.5;
  }

  // Get length with workspace bias
  const lengthRand = rng();
  let lengthCumulative = 0;
  let lengthCategory: CommentLengthCategory = 'medium';
  let targetLength = 150;

  for (const [category, range] of Object.entries(adjustedLengthDistribution)) {
    lengthCumulative += range.probability;
    if (lengthRand <= lengthCumulative) {
      lengthCategory = category as CommentLengthCategory;
      targetLength = range.min + Math.floor(rng() * (range.max - range.min));
      break;
    }
  }

  return {
    targetLength,
    lengthCategory,
    commentType,
    typePrompt: getCommentTypePrompt(commentType),
    scheduledGapMinutes: getRandomCommentGap(),
  };
}

/**
 * Build variance instructions for AI prompt
 */
export function buildVariancePromptInstructions(context: CommentVarianceContext): string {
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
- Use different phrasings for similar ideas
`;
}
