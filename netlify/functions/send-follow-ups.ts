/**
 * Netlify Scheduled Function: Send Follow-Up Messages
 *
 * Sends scheduled follow-up messages to connected LinkedIn prospects
 * Runs every 30 minutes to process prospects due for follow-ups
 *
 * COMPLIANCE:
 * - Business hours: 9 AM - 5 PM
 * - No weekends
 * - No US public holidays
 * - Rate limited: 10 prospects per run
 *
 * Schedule: */30 * * * * (every 30 minutes) via netlify.toml
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📤 Netlify scheduled function triggered: send-follow-ups');
  console.log(`   Time: ${new Date().toISOString()}`);

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

    console.log(`📨 Calling: ${apiUrl}/api/cron/send-follow-ups`);

    const response = await fetch(`${apiUrl}/api/cron/send-follow-ups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
        'x-netlify-scheduled': 'true'
      }
    });

    const result = await response.json();

    console.log('✅ Follow-up processing result:', {
      status: response.status,
      sent: result.results?.sent || 0,
      completed: result.results?.completed || 0,
      failed: result.results?.failed || 0,
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
        error: 'Follow-up processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
