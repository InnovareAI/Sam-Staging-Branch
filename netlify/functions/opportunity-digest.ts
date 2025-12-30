/**
 * Netlify Scheduled Function: Opportunity Digest
 *
 * Sends daily email digest with high-quality posts that are opportunities for engagement
 * Different from commenting-digest which shows pending comments for approval
 *
 * Schedule: 0 14 * * * (daily at 2 PM UTC = 7 AM PT)
 *
 * Added Dec 30, 2025
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('🎯 Opportunity Digest scheduled function triggered');
  console.log(`   Time: ${new Date().toISOString()}`);

  try {
    const apiUrl = process.env.URL || process.env.DEPLOY_URL || 'https://app.meet-sam.com';
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('❌ CRON_SECRET not set');
      return { statusCode: 500, body: JSON.stringify({ error: 'CRON_SECRET not configured' }) };
    }

    console.log(`📨 Calling: ${apiUrl}/api/cron/opportunity-digest`);

    const response = await fetch(`${apiUrl}/api/cron/opportunity-digest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret
      }
    });

    const result = await response.json();

    console.log('✅ Opportunity Digest result:', {
      status: response.status,
      digests_sent: result.digests_sent,
      results: result.results
    });

    return { statusCode: response.status, body: JSON.stringify(result) };

  } catch (error) {
    console.error('❌ Opportunity Digest error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Opportunity Digest failed', details: error instanceof Error ? error.message : 'Unknown' })
    };
  }
};

export { handler };
