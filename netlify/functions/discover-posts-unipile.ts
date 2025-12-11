/**
 * Netlify Scheduled Function: Discover LinkedIn Posts via Unipile API
 *
 * Discovers new posts from LinkedIn hashtags using Unipile's authenticated search.
 * Runs every 4 hours to find fresh content for commenting.
 *
 * ANTI-DETECTION: Uses randomization to avoid pattern detection:
 * - Random 0-20 minute delay before starting
 * - 8% chance to skip run entirely
 *
 * Schedule: Every 4 hours (6 times/day)
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

// Inline randomizer config for discovery (moderate sensitivity)
const DISCOVERY_CONFIG = {
  maxDelayMs: 20 * 60 * 1000,      // 0-20 minute delay before starting
  skipProbability: 0.08,            // 8% chance to skip entirely
};

function getRandomStartDelay(): number {
  return Math.floor(Math.random() * DISCOVERY_CONFIG.maxDelayMs);
}

function shouldSkipRun(): boolean {
  return Math.random() < DISCOVERY_CONFIG.skipProbability;
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📅 Netlify scheduled function triggered: discover-posts-hashtag');
  console.log(`   Time: ${new Date().toISOString()}`);

  // ANTI-DETECTION: Random skip
  if (shouldSkipRun()) {
    console.log(`   🎲 Random skip triggered (8% probability)`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        skipped: true,
        reason: 'Random skip for anti-detection',
        timestamp: new Date().toISOString()
      })
    };
  }

  // ANTI-DETECTION: Random delay before starting (0-20 minutes)
  const delayMs = getRandomStartDelay();
  const delayMinutes = Math.round(delayMs / 60000);
  console.log(`   🎲 Random start delay: ${delayMinutes} minutes (${Math.round(delayMs / 1000)}s)`);

  if (delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  try {
    const apiUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('❌ CRON_SECRET not set in environment');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'CRON_SECRET not configured' })
      };
    }

    console.log(`📨 Calling: ${apiUrl}/api/linkedin-commenting/discover-posts-hashtag`);

    const response = await fetch(`${apiUrl}/api/linkedin-commenting/discover-posts-hashtag`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
        'x-netlify-scheduled': 'true'
      }
    });

    const result = await response.json();

    console.log('✅ Unipile hashtag discovery result:', {
      status: response.status,
      keywords_searched: result.keywords_searched,
      posts_discovered: result.posts_discovered,
      posts_saved: result.posts_saved,
      message: result.message,
      randomDelayApplied: delayMinutes
    });

    return {
      statusCode: response.status,
      body: JSON.stringify({
        ...result,
        antiDetection: {
          randomDelayMs: delayMs,
          randomDelayMinutes: delayMinutes
        }
      })
    };

  } catch (error) {
    console.error('❌ Scheduled function error:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Hashtag discovery failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
