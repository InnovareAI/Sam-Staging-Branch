/**
 * Netlify Scheduled Function: Daily Repost
 *
 * Runs once daily at 10 AM PT to share high-engagement posts
 * Creates a "quote post" with your comment + link to original
 *
 * Schedule: 10 AM PT daily via netlify.toml
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📢 Netlify scheduled function triggered: daily-repost');
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

    console.log(`📨 Calling: ${apiUrl}/api/cron/daily-repost`);

    const response = await fetch(`${apiUrl}/api/cron/daily-repost`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret
      }
    });

    const result = await response.json();

    console.log('📢 Daily repost result:', {
      status: response.status,
      reposted: result.reposted || 0,
      skipped: result.skipped || 0,
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
        error: 'Daily repost failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
