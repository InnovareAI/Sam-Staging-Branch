#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCommenting() {
  console.log('🔍 Checking LinkedIn Commenting Agent setup...\n');

  // Check if table exists
  const { data, error } = await supabase
    .from('linkedin_post_monitors')
    .select('count')
    .limit(1);

  if (error) {
    if (error.code === '42P01') {
      console.log('❌ Table does NOT exist: linkedin_post_monitors');
      console.log('\n💡 Need to run migration:');
      console.log('   sql/migrations/20251123_create_linkedin_commenting_tables.sql\n');
      console.log('📋 Migration file exists - check with:');
      console.log('   cat sql/migrations/20251123_create_linkedin_commenting_tables.sql');
    } else {
      console.error('❌ Error:', error.message);
    }
  } else {
    console.log('✅ Table EXISTS: linkedin_post_monitors');
    console.log('\n📊 Checking existing monitors...');

    const { data: monitors } = await supabase
      .from('linkedin_post_monitors')
      .select('*');

    const count = monitors ? monitors.length : 0;
    console.log(`   Found ${count} monitors`);

    if (count > 0) {
      monitors.forEach(m => {
        console.log(`\n   Monitor: ${m.monitor_name || 'Untitled'}`);
        console.log(`     Hashtags: ${m.hashtags || 'None'}`);
        console.log(`     Status: ${m.status}`);
      });
    }
  }
}

checkCommenting();
