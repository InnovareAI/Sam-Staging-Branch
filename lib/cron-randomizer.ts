/**
 * Cron Randomizer Utility
 *
 * Adds random delays to cron job execution to avoid detection by LinkedIn
 * and other platforms that flag predictable automated patterns.
 *
 * LinkedIn's anti-bot detection looks for:
 * - Fixed interval actions (every 30 min exactly)
 * - Consistent timing patterns
 * - Machine-like precision
 *
 * This utility adds human-like randomness to:
 * - Delay before execution (0-15 minutes)
 * - Jitter between actions
 * - Occasional "skip" behavior (simulates human busy/away)
 */

export interface RandomizerConfig {
  // Maximum random delay before starting (in milliseconds)
  maxDelayMs: number;
  // Probability of skipping this run entirely (0-1, e.g., 0.1 = 10% skip rate)
  skipProbability: number;
  // Minimum delay between actions within a run (in milliseconds)
  minActionDelayMs: number;
  // Maximum delay between actions within a run (in milliseconds)
  maxActionDelayMs: number;
}

// Default configs for different activity types
export const RANDOMIZER_CONFIGS = {
  // LinkedIn commenting - most sensitive, needs highest randomization
  commenting: {
    maxDelayMs: 15 * 60 * 1000,      // 0-15 minute delay before starting
    skipProbability: 0.15,            // 15% chance to skip entirely
    minActionDelayMs: 45 * 1000,      // 45 seconds min between comments
    maxActionDelayMs: 180 * 1000,     // 3 minutes max between comments
  },
  // LinkedIn messages - also sensitive
  messaging: {
    maxDelayMs: 10 * 60 * 1000,      // 0-10 minute delay
    skipProbability: 0.1,             // 10% skip rate
    minActionDelayMs: 30 * 1000,      // 30 seconds min between messages
    maxActionDelayMs: 120 * 1000,     // 2 minutes max
  },
  // Connection requests - moderate sensitivity
  connections: {
    maxDelayMs: 8 * 60 * 1000,       // 0-8 minute delay
    skipProbability: 0.08,            // 8% skip rate
    minActionDelayMs: 20 * 1000,      // 20 seconds min
    maxActionDelayMs: 90 * 1000,      // 90 seconds max
  },
  // Discovery/polling - low sensitivity
  discovery: {
    maxDelayMs: 5 * 60 * 1000,       // 0-5 minute delay
    skipProbability: 0.05,            // 5% skip rate
    minActionDelayMs: 5 * 1000,       // 5 seconds min
    maxActionDelayMs: 30 * 1000,      // 30 seconds max
  },
  // Email operations - lowest sensitivity
  email: {
    maxDelayMs: 3 * 60 * 1000,       // 0-3 minute delay
    skipProbability: 0.02,            // 2% skip rate
    minActionDelayMs: 2 * 1000,       // 2 seconds min
    maxActionDelayMs: 15 * 1000,      // 15 seconds max
  },
} as const;

/**
 * Get a random delay before starting cron execution
 * Returns delay in milliseconds
 */
export function getRandomStartDelay(config: RandomizerConfig): number {
  return Math.floor(Math.random() * config.maxDelayMs);
}

/**
 * Determine if this cron run should be skipped
 * Simulates human being away/busy
 */
export function shouldSkipRun(config: RandomizerConfig): boolean {
  return Math.random() < config.skipProbability;
}

/**
 * Get random delay between actions
 * Returns delay in milliseconds
 */
export function getRandomActionDelay(config: RandomizerConfig): number {
  const range = config.maxActionDelayMs - config.minActionDelayMs;
  return config.minActionDelayMs + Math.floor(Math.random() * range);
}

/**
 * Sleep for a random delay
 */
export async function randomDelay(config: RandomizerConfig, type: 'start' | 'action'): Promise<void> {
  const delayMs = type === 'start'
    ? getRandomStartDelay(config)
    : getRandomActionDelay(config);

  console.log(`   ⏳ Random ${type} delay: ${Math.round(delayMs / 1000)}s`);
  await new Promise(resolve => setTimeout(resolve, delayMs));
}

/**
 * Main entry point for cron randomization
 * Returns { proceed: boolean, delayMs: number }
 */
export async function applyRandomization(
  activityType: keyof typeof RANDOMIZER_CONFIGS
): Promise<{ proceed: boolean; delayMs: number; reason?: string }> {
  const config = RANDOMIZER_CONFIGS[activityType];

  // Check if we should skip this run
  if (shouldSkipRun(config)) {
    const reason = `Random skip triggered (${Math.round(config.skipProbability * 100)}% probability)`;
    console.log(`   🎲 ${reason}`);
    return { proceed: false, delayMs: 0, reason };
  }

  // Apply random start delay
  const delayMs = getRandomStartDelay(config);
  console.log(`   🎲 Random start delay: ${Math.round(delayMs / 1000)}s`);

  if (delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  return { proceed: true, delayMs };
}

/**
 * Wrap an async function with randomization
 * Usage: await withRandomization('commenting', async () => { ... })
 */
export async function withRandomization<T>(
  activityType: keyof typeof RANDOMIZER_CONFIGS,
  fn: () => Promise<T>
): Promise<T | { skipped: true; reason: string }> {
  const { proceed, reason } = await applyRandomization(activityType);

  if (!proceed) {
    return { skipped: true, reason: reason! };
  }

  return fn();
}

/**
 * Get human-readable stats about the randomizer
 */
export function getRandomizerStats(activityType: keyof typeof RANDOMIZER_CONFIGS): {
  maxDelayMinutes: number;
  skipPercentage: number;
  actionDelayRange: string;
} {
  const config = RANDOMIZER_CONFIGS[activityType];
  return {
    maxDelayMinutes: Math.round(config.maxDelayMs / 60000),
    skipPercentage: Math.round(config.skipProbability * 100),
    actionDelayRange: `${Math.round(config.minActionDelayMs / 1000)}-${Math.round(config.maxActionDelayMs / 1000)}s`,
  };
}
