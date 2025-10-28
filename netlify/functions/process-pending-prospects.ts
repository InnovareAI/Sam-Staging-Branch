/**
 * Netlify Scheduled Function: Process Pending Prospects
 *
 * This wrapper calls our Next.js API route for processing pending prospects.
 * Scheduled to run every 5 minutes via netlify.toml configuration.
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📅 Netlify scheduled function triggered: process-pending-prospects');

  try {
    // Call our Next.js API route
    const apiUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/cron/process-pending-prospects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': process.env.CRON_SECRET || '',
        'x-netlify-scheduled': 'true'
      }
    });

    const result = await response.json();

    console.log('✅ Cron execution result:', result);

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
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
