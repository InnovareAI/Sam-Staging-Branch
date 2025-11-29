/**
 * Netlify Scheduled Function: QA Monitor
 *
 * Runs daily at 6 AM UTC to check messaging pipeline health
 * - Queue-prospect consistency
 * - Orphaned records
 * - Cron job gaps
 * - Stuck prospects
 *
 * Schedule: 0 6 * * * (daily at 6 AM UTC)
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📅 QA Monitor scheduled function triggered');
  console.log(`   Time: ${new Date().toISOString()}`);

  try {
    const apiUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('❌ CRON_SECRET not set');
      return { statusCode: 500, body: JSON.stringify({ error: 'CRON_SECRET not configured' }) };
    }

    console.log(`📨 Calling: ${apiUrl}/api/agents/qa-monitor`);

    const response = await fetch(`${apiUrl}/api/agents/qa-monitor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret
      },
      body: JSON.stringify({})
    });

    const result = await response.json();

    console.log('✅ QA Monitor result:', {
      status: response.status,
      total_checks: result.summary?.total_checks,
      passed: result.summary?.passed,
      warnings: result.summary?.warnings,
      failures: result.summary?.failures
    });

    return { statusCode: response.status, body: JSON.stringify(result) };

  } catch (error) {
    console.error('❌ QA Monitor error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'QA Monitor failed', details: error instanceof Error ? error.message : 'Unknown' })
    };
  }
};

export { handler };
