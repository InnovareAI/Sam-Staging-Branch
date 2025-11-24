#!/usr/bin/env node

/**
 * Direct test of Unipile post discovery
 * Tests the exact API calls the discover-profile-posts endpoint makes
 */

const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY || 'POcBmCSV.b/t0gstHvY5alDsy/BmKQmUBt4FmNXRF7fdOYqywJSM=';
const ACCOUNT_ID = 'ymtTx4xVQ6OVUFk83ctwtA';

async function testDiscoverPosts() {
  console.log('🔍 Testing Unipile post discovery for haywarddave\n');

  const vanityName = 'haywarddave';

  try {
    // Step 1: Lookup profile
    console.log(`Step 1: Looking up profile ${vanityName}...`);
    const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/${vanityName}?account_id=${ACCOUNT_ID}`;
    console.log(`   URL: ${profileUrl}`);

    const profileResponse = await fetch(profileUrl, {
      method: 'GET',
      headers: { 'X-API-KEY': UNIPILE_API_KEY }
    });

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error(`❌ Profile lookup failed: ${profileResponse.status}`);
      console.error(`   Error: ${errorText}`);
      return;
    }

    const profile = await profileResponse.json();
    console.log(`✅ Profile found:`);
    console.log(`   Name: ${profile.first_name} ${profile.last_name}`);
    console.log(`   Provider ID: ${profile.provider_id}`);
    console.log('');

    // Step 2: Fetch posts
    console.log(`Step 2: Fetching posts for ${vanityName}...`);
    const postsUrl = `https://${UNIPILE_DSN}/api/v1/users/${vanityName}/posts`;
    console.log(`   URL: ${postsUrl}`);

    const postsResponse = await fetch(postsUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!postsResponse.ok) {
      const errorText = await postsResponse.text();
      console.error(`❌ Posts fetch failed: ${postsResponse.status}`);
      console.error(`   Error: ${errorText}`);
      return;
    }

    const postsData = await postsResponse.json();
    const posts = postsData.items || [];

    console.log(`✅ Retrieved ${posts.length} posts\n`);

    if (posts.length === 0) {
      console.log('⚠️  No posts found');
      return;
    }

    // Step 3: Filter by age (last 24 hours)
    const maxAgeHours = 24;
    const cutoffDate = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));

    const recentPosts = posts.filter(post => {
      if (!post.date) return false;
      const postDate = new Date(post.date);
      return postDate >= cutoffDate;
    });

    console.log(`⏰ Posts from last ${maxAgeHours} hours: ${recentPosts.length}\n`);

    // Show details of recent posts
    if (recentPosts.length > 0) {
      console.log('Recent posts:');
      recentPosts.forEach((post, i) => {
        console.log(`\n${i + 1}. Post ID: ${post.social_id}`);
        console.log(`   Date: ${post.date}`);
        console.log(`   Text: ${(post.text || '').substring(0, 100)}...`);
        console.log(`   URL: ${post.share_url}`);
        console.log(`   Engagement: ${post.comment_counter} comments, ${post.reaction_counter} reactions`);
      });
    } else {
      console.log('⚠️  No recent posts (last 24 hours)');
      console.log('\nMost recent post:');
      const latest = posts[0];
      if (latest) {
        console.log(`   Date: ${latest.date}`);
        console.log(`   Text: ${(latest.text || '').substring(0, 100)}...`);
        const hoursAgo = Math.round((Date.now() - new Date(latest.date).getTime()) / (1000 * 60 * 60));
        console.log(`   Posted ${hoursAgo} hours ago`);
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error);
  }
}

testDiscoverPosts();
