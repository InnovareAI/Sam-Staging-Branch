/**
 * Netlify Scheduled Function: Commenting Agent Daily Digest
 *
 * Sends daily email digest with pending AI comments for approval
 * Recipients can approve/reject directly from email links
 *
 * Schedule: 0 16 * * * (daily at 4 PM UTC = 8 AM PT)
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📧 Commenting Digest scheduled function triggered');
  console.log(`   Time: ${new Date().toISOString()}`);

  try {
    const apiUrl = process.env.URL || process.env.DEPLOY_URL || 'https://app.meet-sam.com';
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('❌ CRON_SECRET not set');
      return { statusCode: 500, body: JSON.stringify({ error: 'CRON_SECRET not configured' }) };
    }

    console.log(`📨 Calling: ${apiUrl}/api/cron/commenting-digest`);

    const response = await fetch(`${apiUrl}/api/cron/commenting-digest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret
      }
    });

    const result = await response.json();

    console.log('✅ Commenting Digest result:', {
      status: response.status,
      digests_sent: result.digests_sent,
      results: result.results
    });

    return { statusCode: response.status, body: JSON.stringify(result) };

  } catch (error) {
    console.error('❌ Commenting Digest error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Commenting Digest failed', details: error instanceof Error ? error.message : 'Unknown' })
    };
  }
};

export { handler };
