#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🗑️  Deleting duplicate monitors...\n');

// Delete the two duplicate monitors (keeping the first one with GenAI)
const monitorsToDelete = [
  'c497eeb5-e684-49af-9a45-d85c8ea69625',
  'ce2ef8ad-018c-4846-a1e6-2806c2998325'
];

for (const monitorId of monitorsToDelete) {
  const { error } = await supabase
    .from('linkedin_post_monitors')
    .delete()
    .eq('id', monitorId);

  if (error) {
    console.error(`❌ Error deleting ${monitorId}:`, error);
  } else {
    console.log(`✅ Deleted monitor: ${monitorId}`);
  }
}

console.log('\n📊 Remaining monitors:');
const { data, error } = await supabase
  .from('linkedin_post_monitors')
  .select('*')
  .eq('status', 'active');

if (error) {
  console.error('❌ Error fetching monitors:', error);
} else {
  console.log(`Total: ${data.length}`);
  data.forEach((m, idx) => {
    console.log(`\n${idx + 1}. Monitor ID: ${m.id}`);
    console.log(`   Hashtags: ${JSON.stringify(m.hashtags)}`);
    console.log(`   Status: ${m.status}`);
  });
}
