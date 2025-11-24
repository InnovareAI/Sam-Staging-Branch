#!/usr/bin/env node

/**
 * Check if jharrison15 is in monitors and what posts exist
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
dotenv.config({ path: resolve(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

async function checkJharrison15() {
  try {
    console.log('🔍 Checking for jharrison15 in monitors...\n');

    // 1. Check all monitors
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
        console.log(`   - ${m.name}`);
        console.log(`     Type: ${m.monitor_type}`);
        console.log(`     Hashtags: ${m.hashtags?.join(', ')}`);
      });
    }
    console.log('');

    // 2. Check if jharrison15 is being monitored
    const jharrison15Monitor = monitors?.find(m =>
      m.hashtags?.some(tag => tag.toLowerCase().includes('jharrison15'))
    );

    if (jharrison15Monitor) {
      console.log('✅ jharrison15 IS being monitored');
      console.log(`   Monitor: ${jharrison15Monitor.name}`);
      console.log(`   Monitor ID: ${jharrison15Monitor.id}`);
    } else {
      console.log('❌ jharrison15 is NOT being monitored');
      console.log('\n🔧 To monitor jharrison15, create a monitor with hashtag: PROFILE:jharrison15');
    }
    console.log('');

    // 3. Check discovered posts
    const { data: posts, error: postsError } = await supabase
      .from('linkedin_posts_discovered')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('discovered_at', { ascending: false })
      .limit(10);

    if (postsError) {
      console.error('❌ Error fetching posts:', postsError.message);
      return;
    }

    console.log(`📊 Total discovered posts (last 10): ${posts?.length || 0}`);
    if (posts && posts.length > 0) {
      console.log('\nRecent posts:');
      posts.forEach((post, i) => {
        const monitor = monitors?.find(m => m.id === post.monitor_id);
        console.log(`\n${i + 1}. ${post.author_name || 'Unknown'}`);
        console.log(`   Monitor: ${monitor?.name || post.monitor_id}`);
        console.log(`   Post Date: ${post.post_date}`);
        console.log(`   Status: ${post.status}`);
      });
    } else {
      console.log('⚠️  No posts discovered yet');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkJharrison15();
