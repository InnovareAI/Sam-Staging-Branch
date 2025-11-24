#!/usr/bin/env node

/**
 * Debug script to trace through the discover posts logic
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_API_KEY = '85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA=';

function parseRelativeDate(dateStr) {
  if (typeof dateStr !== 'string') return null;

  const match = dateStr.match(/^(\d+)([hdwmyn]|mo)$/);
  if (!match) return null;

  const [, num, unit] = match;
  const value = parseInt(num);
  const now = new Date();

  switch (unit) {
    case 'n': return now;
    case 'h': return new Date(now.getTime() - value * 60 * 60 * 1000);
    case 'd': return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
    case 'w': return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
    case 'mo':
      const monthsAgo = new Date(now);
      monthsAgo.setMonth(monthsAgo.getMonth() - value);
      return monthsAgo;
    case 'y':
      const yearsAgo = new Date(now);
      yearsAgo.setFullYear(yearsAgo.getFullYear() - value);
      return yearsAgo;
    default: return null;
  }
}

async function debug() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('🔍 DEBUG: LinkedIn Post Discovery\n');

  // Step 1: Get monitors
  const { data: monitors, error: monitorError } = await supabase
    .from('linkedin_post_monitors')
    .select('*')
    .eq('status', 'active');

  if (monitorError) {
    console.error('❌ Error fetching monitors:', monitorError);
    return;
  }

  console.log(`✅ Found ${monitors.length} active monitors\n`);

  // Filter for profile monitors
  const profileMonitors = monitors.filter(m =>
    m.hashtags?.some(h => h.startsWith('PROFILE:'))
  );

  console.log(`✅ Found ${profileMonitors.length} profile monitors:`);
  profileMonitors.forEach(m => {
    const profileTag = m.hashtags.find(h => h.startsWith('PROFILE:'));
    console.log(`   - ${profileTag}`);
  });

  // Get workspace account
  const workspaceId = profileMonitors[0]?.workspace_id;
  const { data: workspaceAccount } = await supabase
    .from('workspace_accounts')
    .select('unipile_account_id')
    .eq('workspace_id', workspaceId)
    .eq('account_type', 'linkedin')
    .eq('connection_status', 'connected')
    .single();

  const ACCOUNT_ID = workspaceAccount?.unipile_account_id || 'mERQmojtSZq5GeomZZazlw';
  console.log(`\n✅ Using Unipile account: ${ACCOUNT_ID}\n`);

  // Process each monitor
  for (const monitor of profileMonitors) {
    const profileHashtag = monitor.hashtags.find(h => h.startsWith('PROFILE:'));
    if (!profileHashtag) continue;

    const vanityName = profileHashtag.replace('PROFILE:', '');
    console.log(`\n📋 Processing: ${vanityName}`);
    console.log('━'.repeat(50));

    // Step 1: Get profile
    const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/${vanityName}?account_id=${ACCOUNT_ID}`;
    console.log(`1️⃣ Fetching profile...`);

    const profileResponse = await fetch(profileUrl, {
      headers: { 'X-API-KEY': UNIPILE_API_KEY }
    });

    if (!profileResponse.ok) {
      console.error(`   ❌ Failed: ${profileResponse.status}`);
      continue;
    }

    const profile = await profileResponse.json();
    console.log(`   ✅ ${profile.first_name} ${profile.last_name} (${profile.provider_id})`);

    // Step 2: Get posts
    const postsUrl = `https://${UNIPILE_DSN}/api/v1/users/${profile.provider_id}/posts?account_id=${ACCOUNT_ID}`;
    console.log(`2️⃣ Fetching posts...`);

    const postsResponse = await fetch(postsUrl, {
      headers: { 'X-API-KEY': UNIPILE_API_KEY }
    });

    if (!postsResponse.ok) {
      console.error(`   ❌ Failed: ${postsResponse.status}`);
      continue;
    }

    const postsData = await postsResponse.json();
    const posts = postsData.items || [];
    console.log(`   ✅ Found ${posts.length} total posts`);

    // Step 3: Filter by date
    const maxAgeHours = 72;
    const cutoffDate = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
    console.log(`3️⃣ Filtering posts (last ${maxAgeHours} hours)`);
    console.log(`   Cutoff: ${cutoffDate.toISOString()}`);

    const recentPosts = posts.filter(post => {
      const dateValue = post.date;
      let postDate = parseRelativeDate(dateValue);

      if (!postDate && post.parsed_datetime) {
        try {
          postDate = new Date(post.parsed_datetime);
          if (isNaN(postDate.getTime())) postDate = null;
        } catch (e) {}
      }

      return postDate && postDate >= cutoffDate;
    });

    console.log(`   ✅ ${recentPosts.length} posts within time range`);

    if (recentPosts.length > 0) {
      console.log(`   Sample posts:`);
      recentPosts.slice(0, 2).forEach((post, i) => {
        const pd = parseRelativeDate(post.date) || new Date(post.parsed_datetime);
        const hours = (Date.now() - pd.getTime()) / (1000 * 60 * 60);
        console.log(`     ${i+1}. ${post.date} (${hours.toFixed(1)}h ago) - ${post.text?.substring(0, 50)}...`);
      });
    }

    // Step 4: Check existing
    console.log(`4️⃣ Checking for existing posts in DB...`);

    const socialIds = recentPosts.map(p => p.social_id);
    if (socialIds.length > 0) {
      const { data: existingPosts } = await supabase
        .from('linkedin_posts_discovered')
        .select('social_id')
        .in('social_id', socialIds);

      console.log(`   ✅ ${existingPosts?.length || 0} already in database`);

      const existingSet = new Set(existingPosts?.map(p => p.social_id) || []);
      const newPosts = recentPosts.filter(p => !existingSet.has(p.social_id));
      console.log(`   ✅ ${newPosts.length} NEW posts to insert`);

      // Step 5: Try to insert one
      if (newPosts.length > 0) {
        console.log(`5️⃣ Attempting to insert first new post...`);

        const post = newPosts[0];
        const postDate = parseRelativeDate(post.date) || new Date(post.parsed_datetime);

        const insertData = {
          workspace_id: monitor.workspace_id,
          monitor_id: monitor.id,
          social_id: post.social_id,
          share_url: post.share_url,
          post_content: post.text,
          author_name: `${profile.first_name} ${profile.last_name}`,
          author_profile_id: profile.provider_id,
          hashtags: post.hashtags || [],
          post_date: postDate.toISOString(),
          engagement_metrics: {
            comments: post.comment_counter || 0,
            reactions: post.reaction_counter || 0,
            reposts: post.repost_counter || 0
          },
          status: 'discovered'
        };

        console.log(`   Post to insert:`);
        console.log(`     - social_id: ${insertData.social_id}`);
        console.log(`     - date: ${insertData.post_date}`);
        console.log(`     - content: ${insertData.post_content?.substring(0, 50)}...`);

        const { data, error } = await supabase
          .from('linkedin_posts_discovered')
          .insert([insertData])
          .select();

        if (error) {
          console.error(`   ❌ Insert failed:`, error);
        } else {
          console.log(`   ✅ Successfully inserted! ID: ${data[0].id}`);
        }
      }
    } else {
      console.log(`   ℹ️ No recent posts to check`);
    }
  }

  // Final check
  console.log('\n' + '='.repeat(50));
  console.log('📊 FINAL DATABASE CHECK');

  const { data: finalCount } = await supabase
    .from('linkedin_posts_discovered')
    .select('id', { count: 'exact', head: true });

  console.log(`Total posts in database: ${finalCount || 0}`);
}

debug().catch(console.error);