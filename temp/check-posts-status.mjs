import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: posts } = await supabase
  .from('linkedin_posts_discovered')
  .select('id, author_name, status, comment_generated_at, comment_eligible_at')
  .eq('workspace_id', 'd4e5f6a7-b8c9-0123-def4-567890123456')
  .eq('status', 'discovered')
  .is('comment_generated_at', null)
  .order('created_at', { ascending: false })
  .limit(10);

console.log('\n📊 Posts in "discovered" status:', posts?.length || 0);
posts?.forEach(p => {
  const eligible = p.comment_eligible_at ? new Date(p.comment_eligible_at) : null;
  const isPast = eligible ? eligible < new Date() : 'N/A';
  console.log(`- ${p.author_name}: eligible=${isPast} (${p.comment_eligible_at})`);
});
