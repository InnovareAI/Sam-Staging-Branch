#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking ALL monitors (bypassing RLS)...\n');

const { data, error, count } = await supabase
  .from('linkedin_post_monitors')
  .select('*', { count: 'exact' });

if (error) {
  console.error('❌ Error:', error);
} else {
  console.log(`Total monitors in database: ${count}`);
  if (data && data.length > 0) {
    console.log('\nMonitors:');
    data.forEach((m, idx) => {
      console.log(`\n${idx + 1}. Monitor ID: ${m.id}`);
      console.log(`   Workspace: ${m.workspace_id}`);
      console.log(`   Hashtags: ${JSON.stringify(m.hashtags)}`);
      console.log(`   Keywords: ${JSON.stringify(m.keywords)}`);
      console.log(`   Status: ${m.status}`);
      console.log(`   Created: ${m.created_at}`);
    });
  } else {
    console.log('\n⚠️  No monitors found in database');
  }
}
