/**
 * Netlify Scheduled Function: Process Comment Queue
 *
 * Runs every 30-45 minutes to post scheduled LinkedIn comments
 * Comments are approved by user and queued for spread-out posting
 *
 * ANTI-DETECTION: Uses randomization to avoid LinkedIn's bot detection:
 * - Random 0-15 minute delay before starting
 * - 15% chance to skip run entirely (simulates human being away)
 * - Random delays between actions
 *
 * Schedule: every 45 minutes via netlify.toml
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

// Inline randomizer to avoid import issues in Netlify functions
const COMMENTING_CONFIG = {
  maxDelayMs: 15 * 60 * 1000,      // 0-15 minute delay before starting
  skipProbability: 0.15,            // 15% chance to skip entirely
};

function getRandomStartDelay(): number {
  return Math.floor(Math.random() * COMMENTING_CONFIG.maxDelayMs);
}

function shouldSkipRun(): boolean {
  return Math.random() < COMMENTING_CONFIG.skipProbability;
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📤 Netlify scheduled function triggered: process-comment-queue');
  console.log(`   Time: ${new Date().toISOString()}`);

  // ANTI-DETECTION: Random skip (simulates human being away)
  if (shouldSkipRun()) {
    console.log(`   🎲 Random skip triggered (15% probability) - simulating human away`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        skipped: true,
        reason: 'Random skip for anti-detection',
        timestamp: new Date().toISOString()
      })
    };
  }

  // ANTI-DETECTION: Random delay before starting (0-15 minutes)
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
      console.error('❌ CRON_SECRET not set');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'CRON_SECRET not configured' })
      };
    }

    console.log(`📨 Calling: ${apiUrl}/api/cron/process-comment-queue`);

    const response = await fetch(`${apiUrl}/api/cron/process-comment-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret
      }
    });

    const result = await response.json();

    console.log('📤 Comment queue result:', {
      status: response.status,
      processed: result.processed || 0,
      failed: result.failed || 0,
      duration_ms: result.duration_ms,
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
        error: 'Comment queue processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
