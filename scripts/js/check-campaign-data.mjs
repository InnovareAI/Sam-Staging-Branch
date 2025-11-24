#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCampaignData() {
  try {
    console.log('🔍 Checking campaign data for "chet-moss-98a7924"...\n');

    const { data: monitors, error } = await supabase
      .from('linkedin_post_monitors')
      .select('*')
      .ilike('name', '%chet-moss%')
      .single();

    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    console.log('📋 Campaign Data:');
    console.log('---');
    console.log('ID:', monitors.id);
    console.log('Name:', monitors.name);
    console.log('Hashtags:', JSON.stringify(monitors.hashtags, null, 2));
    console.log('Keywords:', JSON.stringify(monitors.keywords, null, 2));
    console.log('Status:', monitors.status);
    console.log('Workspace ID:', monitors.workspace_id);
    console.log('Created At:', monitors.created_at);
    console.log('---\n');

    // Check if profiles are in hashtags
    const profiles = monitors.hashtags
      .filter(tag => tag.startsWith('PROFILE:'))
      .map(tag => tag.replace('PROFILE:', ''));

    console.log('🔍 Extracted Profiles:');
    if (profiles.length > 0) {
      profiles.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
    } else {
      console.log('  ⚠️  No profiles found in hashtags array');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkCampaignData();
