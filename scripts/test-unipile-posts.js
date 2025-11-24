#!/usr/bin/env node

/**
 * Test script to understand Unipile posts API response structure
 * This will help debug why posts aren't being discovered
 */

const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_API_KEY = '85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA=';
const ACCOUNT_ID = 'mERQmojtSZq5GeomZZazlw';

/**
 * Parse relative date strings like "8h", "2d", "1w" into Date objects
 */
function parseRelativeDate(dateStr) {
  if (typeof dateStr !== 'string') return null;

  const match = dateStr.match(/^(\d+)([hdwmyn]|mo)$/);
  if (!match) return null;

  const [, num, unit] = match;
  const value = parseInt(num);
  const now = new Date();

  switch (unit) {
    case 'n': // now
      return now;
    case 'h': // hours
      return new Date(now.getTime() - value * 60 * 60 * 1000);
    case 'd': // days
      return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
    case 'w': // weeks
      return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
    case 'mo': // months
      const monthsAgo = new Date(now);
      monthsAgo.setMonth(monthsAgo.getMonth() - value);
      return monthsAgo;
    case 'y': // years
      const yearsAgo = new Date(now);
      yearsAgo.setFullYear(yearsAgo.getFullYear() - value);
      return yearsAgo;
    default:
      return null;
  }
}

async function testProfileLookup(vanityName) {
  console.log(`\n🔍 Testing profile lookup for: ${vanityName}`);

  const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/${vanityName}?account_id=${ACCOUNT_ID}`;
  console.log(`   URL: ${profileUrl}`);

  try {
    const response = await fetch(profileUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`   ❌ Failed: ${response.status} ${response.statusText}`);
      const error = await response.text();
      console.error(`   Error: ${error}`);
      return null;
    }

    const profile = await response.json();
    console.log(`   ✅ Profile found: ${profile.first_name} ${profile.last_name}`);
    console.log(`   Provider ID: ${profile.provider_id}`);

    return profile;
  } catch (error) {
    console.error(`   ❌ Exception:`, error);
    return null;
  }
}

async function testPostsFetch(providerId, vanityName) {
  console.log(`\n📝 Testing posts fetch for provider_id: ${providerId}`);

  const postsUrl = `https://${UNIPILE_DSN}/api/v1/users/${providerId}/posts?account_id=${ACCOUNT_ID}`;
  console.log(`   URL: ${postsUrl}`);

  try {
    const response = await fetch(postsUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`   ❌ Failed: ${response.status} ${response.statusText}`);
      const error = await response.text();
      console.error(`   Error: ${error}`);
      return;
    }

    const data = await response.json();

    console.log(`\n📦 Response structure analysis:`);
    console.log(`   Type: ${Array.isArray(data) ? 'Array' : 'Object'}`);
    console.log(`   Top-level keys: ${Object.keys(data).join(', ')}`);

    // Check different possible structures
    let posts = [];
    if (data.items && Array.isArray(data.items)) {
      posts = data.items;
      console.log(`   ✅ Posts found in 'items' field: ${posts.length} posts`);
    } else if (data.posts && Array.isArray(data.posts)) {
      posts = data.posts;
      console.log(`   ✅ Posts found in 'posts' field: ${posts.length} posts`);
    } else if (data.data && Array.isArray(data.data)) {
      posts = data.data;
      console.log(`   ✅ Posts found in 'data' field: ${posts.length} posts`);
    } else if (Array.isArray(data)) {
      posts = data;
      console.log(`   ✅ Response is directly an array: ${posts.length} posts`);
    } else {
      console.log(`   ⚠️ Unknown structure. Full response (first 1000 chars):`);
      console.log(JSON.stringify(data, null, 2).substring(0, 1000));
    }

    if (posts.length > 0) {
      console.log(`\n🔍 First post structure:`);
      const firstPost = posts[0];
      console.log(`   Keys: ${Object.keys(firstPost).join(', ')}`);

      console.log(`\n📋 Field analysis:`);
      console.log(`   ID fields:`);
      console.log(`     - social_id: ${firstPost.social_id || 'NOT FOUND'}`);
      console.log(`     - id: ${firstPost.id || 'NOT FOUND'}`);
      console.log(`     - urn: ${firstPost.urn || 'NOT FOUND'}`);
      console.log(`     - entity_urn: ${firstPost.entity_urn || 'NOT FOUND'}`);
      console.log(`     - post_id: ${firstPost.post_id || 'NOT FOUND'}`);

      console.log(`   Date fields:`);
      console.log(`     - date: ${firstPost.date || 'NOT FOUND'}`);
      console.log(`     - created_at: ${firstPost.created_at || 'NOT FOUND'}`);
      console.log(`     - published_at: ${firstPost.published_at || 'NOT FOUND'}`);
      console.log(`     - timestamp: ${firstPost.timestamp || 'NOT FOUND'}`);

      console.log(`   Content fields:`);
      console.log(`     - text: ${firstPost.text ? `${firstPost.text.substring(0, 50)}...` : 'NOT FOUND'}`);
      console.log(`     - content: ${firstPost.content ? `${firstPost.content.substring(0, 50)}...` : 'NOT FOUND'}`);
      console.log(`     - message: ${firstPost.message ? `${firstPost.message.substring(0, 50)}...` : 'NOT FOUND'}`);

      console.log(`   URL fields:`);
      console.log(`     - share_url: ${firstPost.share_url || 'NOT FOUND'}`);
      console.log(`     - permalink: ${firstPost.permalink || 'NOT FOUND'}`);
      console.log(`     - url: ${firstPost.url || 'NOT FOUND'}`);

      console.log(`   Engagement fields:`);
      console.log(`     - comment_counter: ${firstPost.comment_counter}`);
      console.log(`     - reaction_counter: ${firstPost.reaction_counter}`);
      console.log(`     - repost_counter: ${firstPost.repost_counter}`);
      console.log(`     - comments_count: ${firstPost.comments_count}`);
      console.log(`     - reactions_count: ${firstPost.reactions_count}`);
      console.log(`     - reposts_count: ${firstPost.reposts_count}`);

      // Check date parsing
      const dateValue = firstPost.date || firstPost.created_at || firstPost.published_at || firstPost.timestamp;
      if (dateValue) {
        console.log(`\n📅 Date analysis:`);
        console.log(`     - Raw value: ${dateValue}`);

        // Parse relative dates like "8h", "2d", "1w"
        const parsedDate = parseRelativeDate(dateValue);
        if (parsedDate) {
          const ageHours = (Date.now() - parsedDate.getTime()) / (1000 * 60 * 60);
          console.log(`     - Parsed: ${parsedDate.toISOString()}`);
          console.log(`     - Age: ${ageHours.toFixed(1)} hours`);
          console.log(`     - Would pass 24h filter: ${ageHours <= 24}`);
        } else {
          // Try parsing as ISO date
          try {
            const postDate = new Date(dateValue);
            if (!isNaN(postDate.getTime())) {
              const ageHours = (Date.now() - postDate.getTime()) / (1000 * 60 * 60);
              console.log(`     - Parsed as ISO: ${postDate.toISOString()}`);
              console.log(`     - Age: ${ageHours.toFixed(1)} hours`);
              console.log(`     - Would pass 24h filter: ${ageHours <= 24}`);
            } else {
              console.log(`     - ⚠️ Could not parse date value`);
            }
          } catch (e) {
            console.log(`     - ⚠️ Could not parse date value: ${e.message}`);
          }
        }

        // Check parsed_datetime field if available
        if (firstPost.parsed_datetime) {
          console.log(`     - parsed_datetime field: ${firstPost.parsed_datetime}`);
          try {
            const parsedDT = new Date(firstPost.parsed_datetime);
            if (!isNaN(parsedDT.getTime())) {
              const ageHours = (Date.now() - parsedDT.getTime()) / (1000 * 60 * 60);
              console.log(`     - parsed_datetime as ISO: ${parsedDT.toISOString()}`);
              console.log(`     - Age from parsed_datetime: ${ageHours.toFixed(1)} hours`);
            }
          } catch (e) {}
        }
      }

      // Show last 3 posts dates to understand recency
      console.log(`\n📅 Recent posts check (last 3 posts):`);
      for (let i = 0; i < Math.min(3, posts.length); i++) {
        const post = posts[i];
        const dateVal = post.date || post.created_at || post.published_at || post.timestamp;
        if (dateVal) {
          const parsedDate = parseRelativeDate(dateVal) || (post.parsed_datetime ? new Date(post.parsed_datetime) : null);
          if (parsedDate && !isNaN(parsedDate.getTime())) {
            const age = (Date.now() - parsedDate.getTime()) / (1000 * 60 * 60);
            console.log(`   Post ${i + 1}: ${dateVal} → ${parsedDate.toISOString()} (${age.toFixed(1)} hours ago) - Within 24h: ${age <= 24}`);
          } else {
            console.log(`   Post ${i + 1}: ${dateVal} (could not parse)`);
          }
        }
      }

      console.log(`\n📄 Full first post (for reference):`);
      console.log(JSON.stringify(firstPost, null, 2));
    }

  } catch (error) {
    console.error(`   ❌ Exception:`, error);
  }
}

async function main() {
  console.log(`🚀 Testing Unipile Posts API`);
  console.log(`   DSN: ${UNIPILE_DSN}`);
  console.log(`   Account: ${ACCOUNT_ID}`);

  // Test with haywarddave
  const profile = await testProfileLookup('haywarddave');
  if (profile) {
    await testPostsFetch(profile.provider_id, 'haywarddave');
  }
}

main().catch(console.error);