/**
 * Netlify Scheduled Function: Real-Time Error Monitor
 *
 * Runs every 5 minutes to catch critical campaign errors FAST
 * Alerts to Google Chat if critical issues detected
 *
 * Checks:
 * - Failed sends in last 15 min
 * - Stuck queue items
 * - Stuck prospects in "sending" status
 * - Cron execution gaps
 * - Campaign queue anomalies
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('🔴 Realtime error monitor triggered');
  console.log(`   Time: ${new Date().toISOString()}`);

  try {
    const apiUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('❌ CRON_SECRET not set');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'CRON_SECRET not configured' })
      };
    }

    console.log(`📨 Calling: ${apiUrl}/api/agents/realtime-error-monitor`);

    const response = await fetch(`${apiUrl}/api/agents/realtime-error-monitor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret
      }
    });

    const result = await response.json();

    console.log('🔴 Error monitor result:', {
      status: result.status,
      critical: result.critical_count || 0,
      warnings: result.warning_count || 0,
      duration_ms: result.duration_ms
    });

    return {
      statusCode: response.status,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('❌ Error monitor function failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Error monitor failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
