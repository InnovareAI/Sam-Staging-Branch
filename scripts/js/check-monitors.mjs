#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const { data, error } = await supabase
  .from('linkedin_post_monitors')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(5);

if (error) {
  console.error('❌ Error:', error);
} else {
  console.log('✅ LinkedIn Post Monitors:\n');
  console.log(JSON.stringify(data, null, 2));
  console.log(`\nTotal monitors: ${data.length}`);

  if (data.length > 0) {
    const activeCount = data.filter(m => m.status === 'active').length;
    console.log(`Active monitors: ${activeCount}`);
  }
}
