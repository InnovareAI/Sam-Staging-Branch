/**
 * Netlify Scheduled Function: QA Monitor Weekend
 *
 * Weekends (Sat-Sun): Single detailed run at 5 AM UTC (6 AM CET)
 *
 * Schedule: 0 5 * * 0,6 (Saturday and Sunday at 5 AM UTC)
 *
 * Full detailed report including:
 * - Queue-prospect consistency
 * - Orphaned records
 * - Cron job gaps
 * - Stuck prospects
 * - All workspace checks
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📅 QA Monitor Weekend (detailed) scheduled function triggered');
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log(`   Mode: DETAILED (Weekend 6 AM CET run)`);

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
      body: JSON.stringify({
        quick_check: false // Weekend = always full detailed report
      })
    });

    const result = await response.json();

    console.log('✅ QA Monitor Weekend result:', {
      mode: 'detailed',
      status: response.status,
      total_checks: result.summary?.total_checks,
      passed: result.summary?.passed,
      warnings: result.summary?.warnings,
      failures: result.summary?.failures
    });

    return { statusCode: response.status, body: JSON.stringify(result) };

  } catch (error) {
    console.error('❌ QA Monitor Weekend error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'QA Monitor Weekend failed', details: error instanceof Error ? error.message : 'Unknown' })
    };
  }
};

export { handler };
