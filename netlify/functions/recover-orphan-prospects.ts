/**
 * Netlify Scheduled Function: Orphan Prospect Recovery
 *
 * Runs hourly to find and fix prospects that were approved but never
 * made it to campaign_prospects table (due to bulk insert failures, etc.)
 *
 * Root cause: Supabase bulk insert fails ALL records if ANY has constraint violation
 * This agent detects orphans by comparing prospect_approval_data vs campaign_prospects
 *
 * Schedule: 0 * * * * (every hour at minute 0)
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('🔧 Orphan Prospect Recovery scheduled function triggered');
  console.log(`   Time: ${new Date().toISOString()}`);

  try {
    const apiUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('❌ CRON_SECRET not set');
      return { statusCode: 500, body: JSON.stringify({ error: 'CRON_SECRET not configured' }) };
    }

    console.log(`📨 Calling: ${apiUrl}/api/agents/recover-orphan-prospects`);

    const response = await fetch(`${apiUrl}/api/agents/recover-orphan-prospects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret
      },
      body: JSON.stringify({})
    });

    const result = await response.json();

    console.log('✅ Orphan Recovery result:', {
      status: response.status,
      orphansFound: result.orphansFound,
      recovered: result.recovered,
      duration: result.duration
    });

    return { statusCode: response.status, body: JSON.stringify(result) };

  } catch (error) {
    console.error('❌ Orphan Recovery error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Orphan Recovery failed', details: error instanceof Error ? error.message : 'Unknown' })
    };
  }
};

export { handler };
