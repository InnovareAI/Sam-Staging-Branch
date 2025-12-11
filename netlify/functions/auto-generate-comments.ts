/**
 * Netlify Scheduled Function: Auto-Generate Comments
 *
 * Generates AI comments for discovered posts that need comments
 * Runs every 30 minutes to keep comment queue flowing
 *
 * ANTI-DETECTION: Uses randomization to avoid pattern detection:
 * - Random 0-10 minute delay before starting
 * - 10% chance to skip run entirely
 *
 * Scheduled to run: every 30 minutes via netlify.toml
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

// Inline randomizer config for comment generation (less sensitive than posting)
const GENERATION_CONFIG = {
  maxDelayMs: 10 * 60 * 1000,      // 0-10 minute delay before starting
  skipProbability: 0.10,            // 10% chance to skip entirely
};

function getRandomStartDelay(): number {
  return Math.floor(Math.random() * GENERATION_CONFIG.maxDelayMs);
}

function shouldSkipRun(): boolean {
  return Math.random() < GENERATION_CONFIG.skipProbability;
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📅 Netlify scheduled function triggered: auto-generate-comments');
  console.log(`   Time: ${new Date().toISOString()}`);

  // ANTI-DETECTION: Random skip
  if (shouldSkipRun()) {
    console.log(`   🎲 Random skip triggered (10% probability)`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        skipped: true,
        reason: 'Random skip for anti-detection',
        timestamp: new Date().toISOString()
      })
    };
  }

  // ANTI-DETECTION: Random delay before starting (0-10 minutes)
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

    console.log(`📨 Calling: ${apiUrl}/api/cron/auto-generate-comments`);

    const response = await fetch(`${apiUrl}/api/cron/auto-generate-comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
        'x-netlify-scheduled': 'true'
      }
    });

    const result = await response.json();

    console.log('✅ Comment generation result:', {
      status: response.status,
      comments_generated: result.comments_generated,
      posts_processed: result.posts_processed,
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
        error: 'Comment generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
