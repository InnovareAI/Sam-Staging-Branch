import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://latxadqrvrrrcvkktrog.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function getPostsNeedingComments() {
  // Get all discovered posts
  const { data: discovered, error: e1 } = await supabase
    .from('linkedin_posts_discovered')
    .select('id')
    .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')
    .eq('status', 'discovered');

  if (e1) { console.error('Error fetching discovered:', e1); return; }

  // Get posts that already have comments
  const { data: withComments, error: e2 } = await supabase
    .from('linkedin_post_comments')
    .select('post_id')
    .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009');

  if (e2) { console.error('Error fetching comments:', e2); return; }

  const hasCommentIds = new Set(withComments.map(c => c.post_id));
  const needsComments = discovered.filter(p => !hasCommentIds.has(p.id));

  console.log(`Total discovered: ${discovered.length}`);
  console.log(`Already have comments: ${withComments.length}`);
  console.log(`Need comments: ${needsComments.length}`);
  console.log('\nPost IDs needing comments:');
  console.log(JSON.stringify(needsComments.map(p => p.id)));
}

getPostsNeedingComments();
