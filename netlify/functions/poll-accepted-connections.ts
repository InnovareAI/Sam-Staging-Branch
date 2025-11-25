/**
 * Netlify Scheduled Function: Poll Accepted Connections
 *
 * Checks for LinkedIn connection acceptances by polling Unipile
 * Runs every 2 hours to detect accepted connections and schedule follow-ups
 *
 * WHY THIS EXISTS:
 * - Unipile webhooks can have up to 8 hour latency
 * - This ensures we don't miss any accepted connections
 * - Enables timely follow-up scheduling
 *
 * Schedule: every 2 hours (cron: 0 */2 * * *) via netlify.toml
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('🔍 Netlify scheduled function triggered: poll-accepted-connections');
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

    console.log(`📨 Calling: ${apiUrl}/api/cron/poll-accepted-connections`);

    const response = await fetch(`${apiUrl}/api/cron/poll-accepted-connections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
        'x-netlify-scheduled': 'true'
      }
    });

    const result = await response.json();

    console.log('✅ Poll accepted connections result:', {
      status: response.status,
      checked: result.checked || 0,
      accepted: result.accepted || 0,
      stillPending: result.still_pending || 0,
      errors: result.errors?.length || 0,
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
        error: 'Poll accepted connections failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
