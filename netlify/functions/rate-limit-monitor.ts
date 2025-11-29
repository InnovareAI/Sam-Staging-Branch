/**
 * Netlify Scheduled Function: Rate Limit Monitor
 *
 * Runs every 30 minutes to track LinkedIn account usage
 * - Daily CR limits (20/day)
 * - Weekly CR limits (100/week)
 * - Message limits
 * - Account health status
 *
 * Schedule: every 30 minutes
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📅 Rate Limit Monitor scheduled function triggered');
  console.log(`   Time: ${new Date().toISOString()}`);

  try {
    const apiUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('❌ CRON_SECRET not set');
      return { statusCode: 500, body: JSON.stringify({ error: 'CRON_SECRET not configured' }) };
    }

    console.log(`📨 Calling: ${apiUrl}/api/agents/rate-limit-monitor`);

    const response = await fetch(`${apiUrl}/api/agents/rate-limit-monitor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret
      },
      body: JSON.stringify({})
    });

    const result = await response.json();

    console.log('✅ Rate Limit Monitor result:', {
      status: response.status,
      total_accounts: result.summary?.total_accounts,
      healthy: result.summary?.healthy,
      warning: result.summary?.warning,
      critical: result.summary?.critical,
      blocked: result.summary?.blocked
    });

    // Log alerts if any
    if (result.alerts?.length > 0) {
      console.warn('⚠️ Rate limit alerts:', result.alerts);
    }

    return { statusCode: response.status, body: JSON.stringify(result) };

  } catch (error) {
    console.error('❌ Rate Limit Monitor error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Rate Limit Monitor failed', details: error instanceof Error ? error.message : 'Unknown' })
    };
  }
};

export { handler };
