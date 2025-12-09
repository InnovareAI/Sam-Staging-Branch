/**
 * Netlify Scheduled Function: Process Lead Capture Queue
 *
 * NOTE: NOT YET ACTIVATED - Schedule will be added to netlify.toml when ready
 *
 * When activated, this will run every 15 minutes to:
 * 1. Send connection requests to high-score commenters
 * 2. Enroll in DM sequence once connected
 * 3. Sync leads to CRM
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const CRON_SECRET = process.env.CRON_SECRET;

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Only allow scheduled invocations
  if (!context.clientContext) {
    console.log('Manual invocation detected - lead capture queue not yet activated');
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Lead capture queue processing not yet activated. Add schedule to netlify.toml to enable.',
        timestamp: new Date().toISOString()
      })
    };
  }

  console.log('Scheduled: process-lead-capture-queue triggered');

  try {
    // Call the API route with cron secret
    const response = await fetch(`${process.env.URL || 'https://app.meet-sam.com'}/api/cron/process-lead-capture-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': CRON_SECRET || ''
      }
    });

    const result = await response.json();
    console.log('Lead capture queue result:', result);

    return {
      statusCode: response.ok ? 200 : 500,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Lead capture queue error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to process lead capture queue',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
