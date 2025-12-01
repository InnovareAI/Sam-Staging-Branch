/**
 * Netlify Scheduled Function: Daily Campaign Summary
 *
 * Runs daily at 4 PM UTC (8 AM PT) - end of day summary for IA workspaces
 * - Connection requests sent
 * - Connections accepted
 * - Replies received
 * - Intent breakdown
 * - Per-workspace breakdown
 *
 * Schedule: 0 16 * * * (daily at 4 PM UTC / 8 AM PT)
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📊 Daily Campaign Summary scheduled function triggered');
  console.log(`   Time: ${new Date().toISOString()}`);

  try {
    const apiUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('❌ CRON_SECRET not set');
      return { statusCode: 500, body: JSON.stringify({ error: 'CRON_SECRET not configured' }) };
    }

    console.log(`📨 Calling: ${apiUrl}/api/agents/daily-campaign-summary`);

    const response = await fetch(`${apiUrl}/api/agents/daily-campaign-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret
      }
    });

    const result = await response.json();

    console.log('✅ Campaign Summary result:', {
      status: response.status,
      totalCRs: result.summary?.totalConnectionRequests,
      totalAccepted: result.summary?.totalAccepted,
      totalReplies: result.summary?.totalReplies,
      notificationSent: result.notification?.success,
      duration_ms: result.duration_ms
    });

    return { statusCode: response.status, body: JSON.stringify(result) };

  } catch (error) {
    console.error('❌ Campaign Summary error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Campaign Summary failed', details: error instanceof Error ? error.message : 'Unknown' })
    };
  }
};

export { handler };
