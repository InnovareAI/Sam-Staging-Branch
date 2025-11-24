#!/usr/bin/env node

/**
 * Check what posts are in the database
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

async function checkPosts() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('🔍 Checking linkedin_posts_discovered table...\n');

  // Get all posts
  const { data: posts, error } = await supabase
    .from('linkedin_posts_discovered')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`Found ${posts?.length || 0} posts in database\n`);

  if (posts && posts.length > 0) {
    posts.forEach((post, i) => {
      console.log(`Post ${i + 1}:`);
      console.log(`  Social ID: ${post.social_id}`);
      console.log(`  Author: ${post.author_name}`);
      console.log(`  Date: ${post.post_date}`);
      console.log(`  Status: ${post.status}`);
      console.log(`  Content: ${post.post_content?.substring(0, 100)}...`);
      console.log('');
    });
  }

  // Check specific social_id
  const testSocialId = 'urn:li:ugcPost:7398495856154439680';
  console.log(`\n📋 Checking for specific post: ${testSocialId}`);

  const { data: specificPost, error: specificError } = await supabase
    .from('linkedin_posts_discovered')
    .select('*')
    .eq('social_id', testSocialId)
    .single();

  if (specificError && specificError.code !== 'PGRST116') {
    console.error('Error:', specificError);
  } else if (specificPost) {
    console.log('✅ Found post in database!');
    console.log('  Created at:', specificPost.created_at);
  } else {
    console.log('❌ Post not found in database');
  }

  // Get post count by status
  const { data: statusCounts, error: countError } = await supabase
    .from('linkedin_posts_discovered')
    .select('status');

  if (!countError && statusCounts) {
    const counts = {};
    statusCounts.forEach(row => {
      counts[row.status] = (counts[row.status] || 0) + 1;
    });

    console.log('\n📊 Posts by status:');
    Object.entries(counts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
  }
}

checkPosts().catch(console.error);