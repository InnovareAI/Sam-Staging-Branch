/**
 * Netlify Scheduled Function: Process Self-Post Replies
 *
 * Runs every 30 minutes to:
 * 1. Generate AI replies for pending comments
 * 2. Post approved/auto-approved replies to LinkedIn as threaded comments
 *
 * Schedule: every 30 minutes via netlify.toml
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('🤖 Netlify scheduled function triggered: process-self-post-replies');
  console.log(`   Time: ${new Date().toISOString()}`);

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

    console.log(`📨 Calling: ${apiUrl}/api/cron/process-self-post-replies`);

    const response = await fetch(`${apiUrl}/api/cron/process-self-post-replies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret
      }
    });

    const result = await response.json();

    console.log('🤖 Self-post reply processing result:', {
      status: response.status,
      generated: result.generated || 0,
      posted: result.posted || 0,
      failed: result.failed || 0,
      duration_ms: result.duration_ms
    });

    return {
      statusCode: response.status,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('❌ Scheduled function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Self-post reply processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
