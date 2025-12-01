/**
 * Netlify Scheduled Function: Daily Sync Verification
 *
 * Runs daily at 5 AM UTC (6 AM CET) - verifies data consistency across systems
 * - LinkedIn leads: Supabase → Airtable
 * - Email leads: ReachInbox/Supabase → Airtable
 * - Positive replies → ActiveCampaign
 *
 * Schedule: 0 5 * * * (daily at 5 AM UTC)
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('🔄 Daily Sync Verification scheduled function triggered');
  console.log(`   Time: ${new Date().toISOString()}`);

  try {
    const apiUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('❌ CRON_SECRET not set');
      return { statusCode: 500, body: JSON.stringify({ error: 'CRON_SECRET not configured' }) };
    }

    console.log(`📨 Calling: ${apiUrl}/api/cron/daily-sync-verification`);

    const response = await fetch(`${apiUrl}/api/cron/daily-sync-verification`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret
      }
    });

    const result = await response.json();

    console.log('✅ Sync Verification result:', {
      status: response.status,
      linkedIn_synced: result.report?.linkedIn?.synced,
      email_synced: result.report?.email?.synced,
      ac_synced: result.report?.activeCampaign?.synced,
      duration_ms: result.report?.duration
    });

    return { statusCode: response.status, body: JSON.stringify(result) };

  } catch (error) {
    console.error('❌ Sync Verification error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Sync Verification failed', details: error instanceof Error ? error.message : 'Unknown' })
    };
  }
};

export { handler };
