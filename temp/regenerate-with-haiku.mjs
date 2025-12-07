import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 1. Get existing Opus comments and their post IDs
const { data: opusComments } = await supabase
  .from('linkedin_post_comments')
  .select('id, post_id, comment_text, generation_metadata, post:linkedin_posts_discovered(id, author_name, post_content)')
  .eq('workspace_id', 'd4e5f6a7-b8c9-0123-def4-567890123456')
  .eq('status', 'pending_approval')
  .order('created_at', { ascending: false })
  .limit(5);

console.log('\n📋 Found', opusComments.length, 'Opus comments to compare\n');

// 2. Delete existing comments so we can regenerate
const commentIds = opusComments.map(c => c.id);
await supabase
  .from('linkedin_post_comments')
  .delete()
  .in('id', commentIds);

console.log('✅ Deleted existing Opus comments');

// 3. Reset posts to 'discovered' status with eligible time NOW
const postIds = opusComments.map(c => c.post_id);
await supabase
  .from('linkedin_posts_discovered')
  .update({
    status: 'discovered',
    comment_generated_at: null,
    comment_eligible_at: new Date().toISOString() // Make eligible NOW
  })
  .in('id', postIds);

console.log('✅ Reset', postIds.length, 'posts to discovered status');
console.log('\n🚀 Posts ready for Haiku 4.5 generation!\n');

// Store original Opus comments for comparison
console.log('📝 ORIGINAL OPUS 4.5 COMMENTS:\n');
opusComments.forEach((c, i) => {
  console.log(`${i+1}. ${c.post.author_name}`);
  console.log(`   "${c.comment_text.substring(0, 120)}..."\n`);
});
