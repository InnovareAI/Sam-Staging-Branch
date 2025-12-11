/**
 * Netlify Scheduled Function: Process Send Queue
 *
 * Native Netlify scheduling for queue processing
 * Runs every minute to send queued connection requests
 *
 * ANTI-DETECTION: Uses randomization to avoid LinkedIn detection:
 * - Random 0-45 second delay before starting (since this runs every minute)
 * - 5% chance to skip run entirely
 *
 * Scheduled to run: * * * * * (every minute) via netlify.toml
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

// Inline randomizer config for connection requests (moderate sensitivity)
const CR_CONFIG = {
  maxDelayMs: 45 * 1000,           // 0-45 second delay (since cron runs every minute)
  skipProbability: 0.05,            // 5% chance to skip entirely
};

function getRandomStartDelay(): number {
  return Math.floor(Math.random() * CR_CONFIG.maxDelayMs);
}

function shouldSkipRun(): boolean {
  return Math.random() < CR_CONFIG.skipProbability;
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📅 Netlify scheduled function triggered: process-send-queue');
  console.log(`   Time: ${new Date().toISOString()}`);

  // ANTI-DETECTION: Random skip
  if (shouldSkipRun()) {
    console.log(`   🎲 Random skip triggered (5% probability)`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        skipped: true,
        reason: 'Random skip for anti-detection',
        timestamp: new Date().toISOString()
      })
    };
  }

  // ANTI-DETECTION: Random delay before starting (0-45 seconds)
  const delayMs = getRandomStartDelay();
  console.log(`   🎲 Random start delay: ${Math.round(delayMs / 1000)}s`);

  if (delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  try {
    // Call our Next.js API route
    const apiUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('❌ CRON_SECRET not set in environment');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'CRON_SECRET not configured' })
      };
    }

    console.log(`📨 Calling: ${apiUrl}/api/cron/process-send-queue`);

    const response = await fetch(`${apiUrl}/api/cron/process-send-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
        'x-netlify-scheduled': 'true'
      }
    });

    const result = await response.json();

    console.log('✅ Queue processing result:', {
      status: response.status,
      processed: result.processed,
      remaining: result.remaining_in_queue,
      message: result.message,
      randomDelayApplied: Math.round(delayMs / 1000)
    });

    return {
      statusCode: response.status,
      body: JSON.stringify({
        ...result,
        antiDetection: {
          randomDelayMs: delayMs,
          randomDelaySeconds: Math.round(delayMs / 1000)
        }
      })
    };

  } catch (error) {
    console.error('❌ Scheduled function error:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Queue processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
