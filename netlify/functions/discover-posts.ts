/**
 * Netlify Scheduled Function: Discover LinkedIn Posts
 *
 * Discovers new posts from monitored LinkedIn PROFILES using Unipile API
 * Runs every 2 hours to find fresh content for commenting
 *
 * NOTE: Hashtag-based discovery removed (Dec 9, 2025)
 * Only PROFILE: monitors are processed now
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📅 Netlify scheduled function triggered: discover-posts');
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

    // Use profile-based discovery via Unipile (not hashtag/Apify)
    console.log(`📨 Calling: ${apiUrl}/api/linkedin-commenting/discover-profile-posts`);

    const response = await fetch(`${apiUrl}/api/linkedin-commenting/discover-profile-posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
        'x-netlify-scheduled': 'true'
      }
    });

    const result = await response.json();

    console.log('✅ Post discovery result:', {
      status: response.status,
      discovered: result.discovered || result.totalDiscovered,
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
        error: 'Post discovery failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
