/**
 * Netlify Scheduled Function: Discover LinkedIn Posts
 *
 * Discovers new posts from ALL monitor types using Unipile API:
 * - PROFILE: monitors (personal profiles)
 * - COMPANY: monitors (company pages)
 * - HASHTAG: monitors (keyword search)
 *
 * Runs every 2 hours to find fresh content for commenting
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

    const results = {
      profiles: { discovered: 0, error: null as string | null },
      companies: { discovered: 0, error: null as string | null },
      hashtags: { discovered: 0, error: null as string | null }
    };

    // 1. Discover posts from PROFILE: monitors
    console.log(`\n👤 Calling: ${apiUrl}/api/linkedin-commenting/discover-profile-posts`);
    try {
      const profileResponse = await fetch(`${apiUrl}/api/linkedin-commenting/discover-profile-posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': cronSecret,
          'x-netlify-scheduled': 'true'
        }
      });
      const profileResult = await profileResponse.json();
      results.profiles.discovered = profileResult.postsDiscovered || 0;
      console.log(`✅ Profile discovery: ${results.profiles.discovered} posts`);
    } catch (error) {
      results.profiles.error = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Profile discovery failed:', results.profiles.error);
    }

    // 2. Discover posts from COMPANY: monitors
    console.log(`\n🏢 Calling: ${apiUrl}/api/linkedin-commenting/discover-company-posts`);
    try {
      const companyResponse = await fetch(`${apiUrl}/api/linkedin-commenting/discover-company-posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': cronSecret,
          'x-netlify-scheduled': 'true'
        }
      });
      const companyResult = await companyResponse.json();
      results.companies.discovered = companyResult.postsDiscovered || 0;
      console.log(`✅ Company discovery: ${results.companies.discovered} posts`);
    } catch (error) {
      results.companies.error = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Company discovery failed:', results.companies.error);
    }

    // 3. Discover posts from HASHTAG: monitors
    console.log(`\n#️⃣ Calling: ${apiUrl}/api/linkedin-commenting/discover-posts-hashtag`);
    try {
      const hashtagResponse = await fetch(`${apiUrl}/api/linkedin-commenting/discover-posts-hashtag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': cronSecret,
          'x-netlify-scheduled': 'true'
        }
      });
      const hashtagResult = await hashtagResponse.json();
      results.hashtags.discovered = hashtagResult.posts_saved || 0;
      console.log(`✅ Hashtag discovery: ${results.hashtags.discovered} posts`);
    } catch (error) {
      results.hashtags.error = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Hashtag discovery failed:', results.hashtags.error);
    }

    const totalDiscovered = results.profiles.discovered + results.companies.discovered + results.hashtags.discovered;

    console.log(`\n📊 Total discovery summary:`);
    console.log(`   Profiles: ${results.profiles.discovered}`);
    console.log(`   Companies: ${results.companies.discovered}`);
    console.log(`   Hashtags: ${results.hashtags.discovered}`);
    console.log(`   TOTAL: ${totalDiscovered}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        totalDiscovered,
        breakdown: results
      })
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
