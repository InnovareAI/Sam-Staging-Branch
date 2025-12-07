import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// IDs of duplicate comments to delete (keeping the first one for each post)
const duplicateIds = [
  'd0b1e8f4-431d-4e14-9636-8ba313f8f27f',
  'de52ad35-f2ed-4d2b-b9ae-363e740cccc0',
  '158dda97-3cbf-4dac-a0c4-1803f4f6b07b',
  '6fd42a94-8d7a-4e3a-8359-57df030fec92',
  '17725626-05e6-4990-96e7-30d69a91efb9',
  '2d6d1f14-9d60-4c18-b070-1046ba1b8dba',
  '8ead9f3d-9bc3-44e5-8c67-698f1c58d448',
  '38c006cb-262f-43bb-a14e-5fb731035a79'
];

console.log(`🗑️  Deleting ${duplicateIds.length} duplicate comments...\n`);

const { data, error } = await supabase
  .from('linkedin_post_comments')
  .delete()
  .in('id', duplicateIds);

if (error) {
  console.error('❌ Error deleting duplicates:', error);
  process.exit(1);
}

console.log(`✅ Successfully deleted ${duplicateIds.length} duplicate comments`);

// Verify deletion
const { data: remaining } = await supabase
  .from('linkedin_post_comments')
  .select('id')
  .in('id', duplicateIds);

if (remaining?.length > 0) {
  console.error(`⚠️  Warning: ${remaining.length} comments still exist after deletion`);
} else {
  console.log('✅ Verified: All duplicates removed');
}

// Show final count
const { count } = await supabase
  .from('linkedin_post_comments')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', 'd4e5f6a7-b8c9-0123-def4-567890123456')
  .in('status', ['pending_approval', 'scheduled']);

console.log(`\n📊 Remaining comments: ${count}`);
