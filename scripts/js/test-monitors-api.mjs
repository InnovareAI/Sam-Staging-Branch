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

async function testMonitorsAPI() {
  try {
    console.log('🔍 Testing what the monitors API returns...\n');

    const { data, error } = await supabase
      .from('linkedin_post_monitors')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    console.log(`✅ Found ${data.length} monitors\n`);

    data.forEach((monitor, idx) => {
      console.log(`${idx + 1}. ${monitor.name}`);
      console.log(`   ID: ${monitor.id}`);
      console.log(`   Hashtags type: ${typeof monitor.hashtags}`);
      console.log(`   Hashtags value: ${JSON.stringify(monitor.hashtags)}`);
      console.log(`   Keywords: ${JSON.stringify(monitor.keywords)}`);

      // Test the extraction logic
      const hashtags = monitor.hashtags || [];
      const profiles = hashtags
        .filter(tag => tag.startsWith('PROFILE:'))
        .map(tag => tag.replace('PROFILE:', ''));

      console.log(`   🔍 Extracted profiles: ${JSON.stringify(profiles)}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testMonitorsAPI();
