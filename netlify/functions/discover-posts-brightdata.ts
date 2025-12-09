/**
 * Netlify Scheduled Function: Discover LinkedIn Posts via Bright Data
 *
 * Discovers new posts from LinkedIn hashtags using Bright Data Scraping Browser.
 * Runs every 4 hours to find fresh content for commenting.
 *
 * Schedule: Every 4 hours (6 times/day)
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📅 Netlify scheduled function triggered: discover-posts-brightdata');
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

    console.log(`📨 Calling: ${apiUrl}/api/linkedin-commenting/discover-posts-brightdata`);

    const response = await fetch(`${apiUrl}/api/linkedin-commenting/discover-posts-brightdata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
        'x-netlify-scheduled': 'true'
      }
    });

    const result = await response.json();

    console.log('✅ Bright Data discovery result:', {
      status: response.status,
      hashtags_scraped: result.hashtags_scraped,
      posts_discovered: result.posts_discovered,
      posts_saved: result.posts_saved,
      message: result.message
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
        error: 'Bright Data discovery failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
