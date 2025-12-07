import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔍 VERIFYING RACE CONDITION FIX:\n');

// Check posts marked as "processing_comment" (the claim mechanism)
const { data: processing } = await supabase
  .from('linkedin_posts_discovered')
  .select('id, author_name, status, comment_generated_at, created_at')
  .eq('workspace_id', 'd4e5f6a7-b8c9-0123-def4-567890123456')
  .eq('status', 'processing_comment')
  .order('comment_generated_at', { ascending: false });

console.log(`✅ Posts in "processing_comment" status: ${processing?.length || 0}`);
if (processing?.length > 0) {
  console.log('   (These should be transient - only appear during cron execution)');
}

// Check comment_pending posts (successfully processed)
const { data: pending } = await supabase
  .from('linkedin_posts_discovered')
  .select('id, author_name, status, comment_generated_at')
  .eq('workspace_id', 'd4e5f6a7-b8c9-0123-def4-567890123456')
  .eq('status', 'comment_pending')
  .order('comment_generated_at', { ascending: false })
  .limit(5);

console.log(`\n✅ Posts with comments generated (comment_pending): ${pending?.length || 0}`);
pending?.forEach(p => {
  console.log(`   - ${p.author_name}: ${new Date(p.comment_generated_at).toLocaleString()}`);
});

// Check for any new duplicates created after Dec 7, 2025
const { data: recentComments } = await supabase
  .from('linkedin_post_comments')
  .select('post_id, comment_text, created_at, id')
  .eq('workspace_id', 'd4e5f6a7-b8c9-0123-def4-567890123456')
  .gte('created_at', '2025-12-07T00:00:00Z')
  .order('created_at', { ascending: true });

const grouped = {};
recentComments?.forEach(c => {
  if (!grouped[c.post_id]) grouped[c.post_id] = [];
  grouped[c.post_id].push(c);
});

const newDupes = Object.values(grouped).filter(arr => arr.length > 1);

console.log(`\n📊 New comments since Dec 7: ${recentComments?.length || 0}`);
console.log(`🔴 New duplicates found: ${newDupes.length}`);

if (newDupes.length > 0) {
  console.log('\n⚠️  WARNING: Race condition fix may not be working!');
  newDupes.forEach(dupes => {
    console.log(`\n   Post ${dupes[0].post_id.substring(0, 8)}: ${dupes.length} comments`);
    dupes.forEach((d, i) => {
      console.log(`      ${i + 1}. ${new Date(d.created_at).toISOString()}`);
    });
  });
} else {
  console.log('✅ No new duplicates - race condition fix is working!');
}
