/**
 * Netlify Scheduled Function: Discover Self-Post Comments
 *
 * Runs every 30 minutes to find new comments on monitored own posts
 * Comments are queued for AI reply generation
 *
 * Schedule: every 30 minutes via netlify.toml
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('🔍 Netlify scheduled function triggered: discover-self-post-comments');
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

    console.log(`📨 Calling: ${apiUrl}/api/cron/discover-self-post-comments`);

    const response = await fetch(`${apiUrl}/api/cron/discover-self-post-comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret
      }
    });

    const result = await response.json();

    console.log('🔍 Self-post comment discovery result:', {
      status: response.status,
      monitorsChecked: result.monitorsChecked || 0,
      commentsFound: result.commentsFound || 0,
      repliesQueued: result.repliesQueued || 0,
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
        error: 'Self-post comment discovery failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
