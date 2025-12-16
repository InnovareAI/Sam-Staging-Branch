/**
 * Netlify Scheduled Function: Withdraw Stale LinkedIn Invitations
 *
 * Runs daily at 3 AM EST (8 AM UTC) to clean up old pending invitations.
 * This frees up the weekly invitation limit and improves account health.
 *
 * Schedule: 0 8 * * * (via netlify.toml)
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('🧹 Starting scheduled stale invitation withdrawal...');

  const baseUrl = process.env.URL || 'https://app.meet-sam.com';
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('❌ CRON_SECRET not configured');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'CRON_SECRET not configured' })
    };
  }

  try {
    const response = await fetch(`${baseUrl}/api/cron/withdraw-stale-invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret
      }
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Cron endpoint returned error:', result);
      return {
        statusCode: response.status,
        body: JSON.stringify(result)
      };
    }

    console.log('✅ Stale invitation withdrawal completed:', result);

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Failed to run scheduled function:', errorMessage);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: errorMessage })
    };
  }
};

export { handler };
