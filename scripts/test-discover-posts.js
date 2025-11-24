#!/usr/bin/env node

/**
 * Test the discover-profile-posts API endpoint
 */

async function testDiscoverPosts() {
  console.log('🚀 Testing discover-profile-posts endpoint...\n');

  const url = 'http://localhost:3000/api/linkedin-commenting/discover-profile-posts';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`Response status: ${response.status}`);

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.success) {
      console.log(`\n✅ Success!`);
      console.log(`   Monitors processed: ${data.monitorsProcessed}`);
      console.log(`   Posts discovered: ${data.postsDiscovered}`);
    } else {
      console.log(`\n❌ Failed:`, data.error || 'Unknown error');
    }
  } catch (error) {
    console.error('❌ Error calling API:', error);
  }
}

testDiscoverPosts();