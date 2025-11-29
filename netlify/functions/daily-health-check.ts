/**
 * Netlify Scheduled Function: Daily Health Check
 *
 * Runs daily at 7 AM UTC - comprehensive system health monitoring
 * - Database health
 * - Campaign execution stats
 * - Queue health
 * - Unipile account status
 * - Error rates
 *
 * Schedule: 0 7 * * * (daily at 7 AM UTC)
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📅 Daily Health Check scheduled function triggered');
  console.log(`   Time: ${new Date().toISOString()}`);

  try {
    const apiUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('❌ CRON_SECRET not set');
      return { statusCode: 500, body: JSON.stringify({ error: 'CRON_SECRET not configured' }) };
    }

    console.log(`📨 Calling: ${apiUrl}/api/agents/daily-health-check`);

    const response = await fetch(`${apiUrl}/api/agents/daily-health-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret
      }
    });

    const result = await response.json();

    console.log('✅ Health Check result:', {
      status: response.status,
      overall_status: result.overall_status,
      checks_run: result.checks?.length,
      duration_ms: result.duration_ms
    });

    return { statusCode: response.status, body: JSON.stringify(result) };

  } catch (error) {
    console.error('❌ Health Check error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Health Check failed', details: error instanceof Error ? error.message : 'Unknown' })
    };
  }
};

export { handler };
