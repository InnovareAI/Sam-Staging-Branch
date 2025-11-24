#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

async function checkDiscoveredPosts() {
  try {
    console.log('🔍 Checking discovered posts in database...\n');

    // 1. Check monitors
    const { data: monitors, error: monitorError } = await supabase
      .from('linkedin_post_monitors')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active');

    if (monitorError) {
      console.error('❌ Error fetching monitors:', monitorError.message);
      return;
    }

    console.log(`📋 Active monitors: ${monitors?.length || 0}`);
    if (monitors && monitors.length > 0) {
      monitors.forEach(m => {
        console.log(`   - ${m.name} (${m.hashtags?.join(', ')})`);
      });
    }
    console.log('');

    // 2. Check discovered posts
    const { data: posts, error: postsError } = await supabase
      .from('linkedin_posts_discovered')
      .select(`
        id,
        social_id,
        author_name,
        post_content,
        post_date,
        status,
        discovered_at,
        monitor_id
      `)
      .eq('workspace_id', workspaceId)
      .order('discovered_at', { ascending: false })
      .limit(10);

    if (postsError) {
      console.error('❌ Error fetching posts:', postsError.message);
      return;
    }

    console.log(`📊 Total discovered posts: ${posts?.length || 0}\n`);

    if (posts && posts.length > 0) {
      console.log('Recent posts:');
      posts.forEach((post, i) => {
        const monitor = monitors?.find(m => m.id === post.monitor_id);
        console.log(`\n${i + 1}. ${post.author_name || 'Unknown'}`);
        console.log(`   Monitor: ${monitor?.name || post.monitor_id}`);
        console.log(`   Social ID: ${post.social_id}`);
        console.log(`   Post Date: ${post.post_date}`);
        console.log(`   Discovered: ${post.discovered_at}`);
        console.log(`   Status: ${post.status}`);
        console.log(`   Content: ${(post.post_content || '').substring(0, 80)}...`);
      });
    } else {
      console.log('⚠️  No posts discovered yet');
      console.log('\n🔧 Troubleshooting:');
      console.log('1. Check if N8N workflow is running');
      console.log('2. Check if Unipile API key is valid');
      console.log('3. Verify monitors are active');
      console.log('4. Check Netlify function logs for errors');
    }

    // 3. Count by monitor
    if (posts && posts.length > 0) {
      console.log('\n\n📈 Posts by monitor:');
      const byMonitor = {};
      posts.forEach(p => {
        const monitorName = monitors?.find(m => m.id === p.monitor_id)?.name || p.monitor_id;
        byMonitor[monitorName] = (byMonitor[monitorName] || 0) + 1;
      });
      Object.entries(byMonitor).forEach(([name, count]) => {
        console.log(`   ${name}: ${count} posts`);
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkDiscoveredPosts();
