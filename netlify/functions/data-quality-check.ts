/**
 * Netlify Scheduled Function: Data Quality Check
 *
 * Runs weekly on Monday at 8 AM UTC
 * - Duplicate detection
 * - Invalid email/URL cleanup
 * - Missing fields
 * - Orphaned records
 * - Stale campaigns
 *
 * Schedule: 0 8 * * 1 (Monday at 8 AM UTC)
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📅 Data Quality Check scheduled function triggered');
  console.log(`   Time: ${new Date().toISOString()}`);

  try {
    const apiUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('❌ CRON_SECRET not set');
      return { statusCode: 500, body: JSON.stringify({ error: 'CRON_SECRET not configured' }) };
    }

    console.log(`📨 Calling: ${apiUrl}/api/agents/data-quality`);

    const response = await fetch(`${apiUrl}/api/agents/data-quality`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret
      },
      body: JSON.stringify({ auto_fix: false }) // Manual review before auto-fix
    });

    const result = await response.json();

    console.log('✅ Data Quality result:', {
      status: response.status,
      total_issues: result.summary?.total_issues,
      high_severity: result.summary?.high_severity,
      affected_records: result.summary?.total_affected_records
    });

    return { statusCode: response.status, body: JSON.stringify(result) };

  } catch (error) {
    console.error('❌ Data Quality error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Data Quality check failed', details: error instanceof Error ? error.message : 'Unknown' })
    };
  }
};

export { handler };
