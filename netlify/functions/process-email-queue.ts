/**
 * Netlify Scheduled Function: Process Email Queue
 *
 * Sends queued emails via Unipile API
 * Runs every 13 minutes to comply with cold email rules:
 * - Max 40 emails per day
 * - 9-hour window (8 AM - 5 PM)
 * - 40 emails / 9 hours = ~13.5 minutes per email
 *
 * Schedule: every 13 minutes (see netlify.toml)
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📧 Netlify scheduled function triggered: process-email-queue');
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

    console.log(`📨 Calling: ${apiUrl}/api/cron/process-email-queue`);

    const response = await fetch(`${apiUrl}/api/cron/process-email-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
        'x-netlify-scheduled': 'true'
      }
    });

    const result = await response.json();

    console.log('✅ Email queue processing result:', {
      status: response.status,
      processed: result.processed,
      message: result.message
    });

    return {
      statusCode: response.status,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('❌ Email queue scheduled function error:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Email queue processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
