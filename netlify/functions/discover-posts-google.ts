/**
 * Netlify Scheduled Function: Discover LinkedIn Posts via Google
 *
 * Discovers posts using Google Custom Search instead of Apify.
 * Cost: ~$0.015 per hashtag vs Apify's $4+ per run
 *
 * Schedule: Every 2 hours (same as Apify version)
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📅 Netlify scheduled function triggered: discover-posts-google');
  console.log(`   Time: ${new Date().toISOString()}`);

  try {
    const apiUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('❌ CRON_SECRET not set in environment');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'CRON_SECRET not configured' })
      };
    }

    console.log(`📨 Calling: ${apiUrl}/api/linkedin-commenting/discover-posts-google`);

    const response = await fetch(`${apiUrl}/api/linkedin-commenting/discover-posts-google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
        'x-netlify-scheduled': 'true'
      }
    });

    const result = await response.json();

    console.log('✅ Google post discovery result:', {
      status: response.status,
      queries_used: result.queries_used,
      estimated_cost: result.estimated_cost_usd,
      results_count: result.results?.length || 0
    });

    return {
      statusCode: response.status,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('❌ Scheduled function error:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Post discovery failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
