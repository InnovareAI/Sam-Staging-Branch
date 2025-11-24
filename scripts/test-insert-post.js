#!/usr/bin/env node

/**
 * Test inserting a post directly into the database
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

async function testInsert() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('🧪 Testing direct insert to linkedin_posts_discovered...\n');

  // First, get a workspace ID and monitor ID
  const { data: monitors, error: monitorError } = await supabase
    .from('linkedin_post_monitors')
    .select('id, workspace_id, hashtags')
    .limit(1)
    .single();

  if (monitorError) {
    console.error('❌ Error getting monitor:', monitorError);
    return;
  }

  console.log(`Using monitor: ${monitors.id}`);
  console.log(`Workspace: ${monitors.workspace_id}`);
  console.log(`Hashtags: ${monitors.hashtags}\n`);

  // Create a test post
  const testPost = {
    workspace_id: monitors.workspace_id,
    monitor_id: monitors.id,
    social_id: 'test:' + Date.now(),
    share_url: 'https://linkedin.com/test',
    post_content: 'This is a test post to debug the insertion issue',
    author_name: 'Test Author',
    author_profile_id: 'test_profile_id',
    hashtags: ['test'],
    post_date: new Date().toISOString(),
    engagement_metrics: {
      comments: 0,
      reactions: 0,
      reposts: 0
    },
    status: 'discovered'
  };

  console.log('📝 Attempting to insert test post...');
  console.log(JSON.stringify(testPost, null, 2));

  const { data, error } = await supabase
    .from('linkedin_posts_discovered')
    .insert([testPost])
    .select();

  if (error) {
    console.error('\n❌ Insert failed:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
  } else {
    console.log('\n✅ Insert successful!');
    console.log('Inserted post:', data[0]);
  }

  // Check if it was really inserted
  const { data: checkData, error: checkError } = await supabase
    .from('linkedin_posts_discovered')
    .select('*')
    .eq('social_id', testPost.social_id)
    .single();

  if (checkData) {
    console.log('\n✅ Verified: Post exists in database');
    console.log(`   ID: ${checkData.id}`);
    console.log(`   Created at: ${checkData.created_at}`);
  } else {
    console.log('\n❌ Post not found in database after insert');
  }
}

testInsert().catch(console.error);