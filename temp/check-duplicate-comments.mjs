import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get all pending/scheduled comments
const { data: allComments } = await supabase
  .from('linkedin_post_comments')
  .select('post_id, comment_text, created_at, status, id')
  .eq('workspace_id', 'd4e5f6a7-b8c9-0123-def4-567890123456')
  .in('status', ['pending_approval', 'scheduled'])
  .order('post_id', { ascending: true })
  .order('created_at', { ascending: true });

// Group by post_id
const grouped = {};
allComments?.forEach(c => {
  if (!grouped[c.post_id]) grouped[c.post_id] = [];
  grouped[c.post_id].push(c);
});

console.log('\n📊 DUPLICATE COMMENT ANALYSIS:\n');

let totalDupes = 0;
const duplicateIds = [];

Object.entries(grouped).forEach(([postId, comments]) => {
  if (comments.length > 1) {
    totalDupes += comments.length - 1;
    console.log(`\n🔴 Post ${postId.substring(0, 8)}: ${comments.length} comments`);
    comments.forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.status} - Created: ${new Date(c.created_at).toISOString()}`);
      console.log(`      ID: ${c.id}`);
      console.log(`      "${c.comment_text.substring(0, 80)}..."`);

      // Keep first one, mark others as duplicates
      if (i > 0) {
        duplicateIds.push(c.id);
      }
    });
  }
});

console.log(`\n📈 SUMMARY:`);
console.log(`   Total posts with comments: ${Object.keys(grouped).length}`);
console.log(`   Posts with duplicates: ${Object.values(grouped).filter(c => c.length > 1).length}`);
console.log(`   Extra duplicate comments: ${totalDupes}`);

if (duplicateIds.length > 0) {
  console.log(`\n🗑️  DUPLICATE IDs TO DELETE (${duplicateIds.length}):`);
  duplicateIds.forEach(id => console.log(`   - ${id}`));
}
