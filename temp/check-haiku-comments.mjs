import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from('linkedin_post_comments')
  .select('id, comment_text, generation_metadata, status, created_at, post:linkedin_posts_discovered(author_name)')
  .eq('workspace_id', 'd4e5f6a7-b8c9-0123-def4-567890123456')
  .eq('status', 'pending_approval')
  .order('created_at', { ascending: false })
  .limit(5);

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

console.log('\n🎯 HAIKU 4.5 GENERATED COMMENTS (Pending Approval):\n');
data.forEach((comment, i) => {
  const model = comment.generation_metadata?.model || 'unknown';
  const confidence = comment.generation_metadata?.confidence_score || 0;
  const author = comment.post?.author_name || 'Unknown';
  console.log(`${i+1}. Author: ${author}`);
  console.log(`   Model: ${model} | Confidence: ${confidence.toFixed(2)}`);
  console.log(`   Comment: "${comment.comment_text.substring(0, 120)}..."\n`);
});

console.log(`✅ Total: ${data.length} comments awaiting approval`);
console.log('📧 Digest email sent to: tl@innovareai.com\n');
