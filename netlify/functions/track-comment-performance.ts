/**
 * Netlify Scheduled Function: Track Comment Performance
 *
 * Runs every 6 hours to check engagement on our posted comments.
 *
 * Schedule: Every 6 hours (0 [star]/6 [star] [star] [star])
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET not configured');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'CRON_SECRET not configured' }),
    };
  }

  // Determine base URL
  const baseUrl = process.env.URL || 'https://app.meet-sam.com';

  console.log(`📊 Triggering comment performance tracking...`);
  console.log(`   Target: ${baseUrl}/api/cron/track-comment-performance`);

  try {
    const response = await fetch(`${baseUrl}/api/cron/track-comment-performance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Performance tracking failed:', result);
      return {
        statusCode: response.status,
        body: JSON.stringify(result),
      };
    }

    console.log('✅ Performance tracking completed:', result);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error('❌ Error calling performance tracking API:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to trigger performance tracking',
        details: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};

export { handler };
