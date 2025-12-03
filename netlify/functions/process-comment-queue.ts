/**
 * Netlify Scheduled Function: Process Comment Queue
 *
 * Runs every 30 minutes to post scheduled LinkedIn comments
 * Comments are approved by user and queued for spread-out posting
 *
 * Schedule: every 30 minutes via netlify.toml
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📤 Netlify scheduled function triggered: process-comment-queue');
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
        error: 'Comment queue processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
