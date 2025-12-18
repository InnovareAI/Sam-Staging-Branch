/**
 * Netlify Scheduled Function: Expire Comment Content
 *
 * Expires discovered posts and pending comments that weren't approved
 * Posts/comments expire at 6 AM UTC on the next business day
 * After expiration, new posts will be scraped on the next discovery run
 *
 * Schedule: Daily at 6 AM UTC (10 PM PT previous day)
 * - Runs once per day to clean up stale content
 * - Triggers just before the new business day starts
 *
 * Created: December 18, 2025
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📅 Netlify scheduled function triggered: expire-comment-content');
  console.log(`   Time: ${new Date().toISOString()}`);

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

    console.log(`📨 Calling: ${apiUrl}/api/cron/expire-comment-content`);

    const response = await fetch(`${apiUrl}/api/cron/expire-comment-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
        'x-netlify-scheduled': 'true'
      }
    });

    const result = await response.json();

    console.log('✅ Content expiration result:', {
      status: response.status,
      posts_expired: result.posts_expired,
      comments_expired: result.comments_expired,
      message: result.message
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
        error: 'Scheduled function failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
