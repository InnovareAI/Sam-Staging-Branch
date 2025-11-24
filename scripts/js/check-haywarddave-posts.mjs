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

async function checkPosts() {
  try {
    console.log('🔍 Checking haywarddave monitoring status...\n');

    // 1. Check monitor status
    const { data: monitor, error: monitorError } = await supabase
      .from('linkedin_post_monitors')
      .select('*')
      .ilike('name', '%haywarddave%')
      .eq('workspace_id', workspaceId)
      .single();

    if (monitorError) {
      console.error('❌ Error finding monitor:', monitorError.message);
      return;
    }

    console.log('✅ Monitor found:');
    console.log('   Name:', monitor.name);
    console.log('   Status:', monitor.status);
    console.log('   Hashtags:', monitor.hashtags);
    console.log('   Created:', monitor.created_at);
    console.log('');

    // 2. Check discovered posts
    const { data: posts, error: postsError } = await supabase
      .from('linkedin_discovered_posts')
      .select('*')
      .eq('monitor_id', monitor.id)
      .order('discovered_at', { ascending: false });

    if (postsError) {
      console.error('❌ Error fetching posts:', postsError.message);
      return;
    }

    console.log(`📊 Discovered posts: ${posts?.length || 0}`);

    if (posts && posts.length > 0) {
      console.log('\nRecent posts:');
      posts.slice(0, 5).forEach((post, i) => {
        console.log(`\n${i + 1}. Post ID: ${post.post_id}`);
        console.log(`   Author: ${post.author_name}`);
        console.log(`   Discovered: ${post.discovered_at}`);
        console.log(`   Status: ${post.status}`);
        console.log(`   URL: ${post.post_url}`);
      });
    } else {
      console.log('⚠️  No posts discovered yet');
      console.log('\n🔧 Troubleshooting:');
      console.log('1. Check if N8N workflow is running');
      console.log('2. Check if Unipile API can access haywarddave profile');
      console.log('3. Verify monitor status is "active"');
      console.log('4. Check N8N logs for errors');
    }

    // 3. Check when last discovery ran
    const { data: lastRun, error: lastRunError } = await supabase
      .from('linkedin_discovered_posts')
      .select('discovered_at')
      .eq('workspace_id', workspaceId)
      .order('discovered_at', { ascending: false })
      .limit(1)
      .single();

    if (!lastRunError && lastRun) {
      console.log(`\n⏰ Last discovery run: ${lastRun.discovered_at}`);
      const lastRunDate = new Date(lastRun.discovered_at);
      const now = new Date();
      const hoursSince = Math.round((now - lastRunDate) / (1000 * 60 * 60));
      console.log(`   (${hoursSince} hours ago)`);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkPosts();
