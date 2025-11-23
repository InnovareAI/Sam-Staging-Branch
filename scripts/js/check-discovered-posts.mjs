#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking discovered posts...\n');

const { data, error, count } = await supabase
  .from('linkedin_posts_discovered')
  .select('*', { count: 'exact' })
  .order('created_at', { ascending: false })
  .limit(10);

if (error) {
  console.error('❌ Error:', error);
} else {
  console.log(`Total posts discovered: ${count}`);
  if (data && data.length > 0) {
    console.log('\nRecent posts:');
    data.forEach((p, idx) => {
      console.log(`\n${idx + 1}. Post ID: ${p.id}`);
      console.log(`   Social ID: ${p.social_id}`);
      console.log(`   Monitor ID: ${p.monitor_id}`);
      console.log(`   Author: ${p.author_name}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   URL: ${p.share_url}`);
      console.log(`   Created: ${p.created_at}`);
    });
  } else {
    console.log('\n⚠️  No posts discovered yet');
  }
}
