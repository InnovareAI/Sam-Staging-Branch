import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function check() {
  // Get all posts
  const { data: posts, count } = await supabase
    .from('linkedin_posts_discovered')
    .select('workspace_id, author_name, status, post_content, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('TOTAL POSTS DISCOVERED:', count);
  console.log('');

  // Group by workspace
  const byWorkspace = {};
  for (const p of posts) {
    if (!byWorkspace[p.workspace_id]) {
      byWorkspace[p.workspace_id] = [];
    }
    byWorkspace[p.workspace_id].push(p);
  }

  for (const wsId of Object.keys(byWorkspace)) {
    const wsPosts = byWorkspace[wsId];
    console.log('Workspace:', wsId);
    console.log('Posts:', wsPosts.length);
    for (const p of wsPosts.slice(0, 3)) {
      console.log('  -', p.author_name, '[' + p.status + ']');
      console.log('   ', (p.post_content || '').substring(0, 60) + '...');
    }
    console.log('');
  }

  // Check Brian Neiby workspace specifically
  console.log('=== BRIAN NEIBY (ChillMine) WORKSPACE ===');
  const chillmineId = 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7';
  const { data: cmPosts, count: cmCount } = await supabase
    .from('linkedin_posts_discovered')
    .select('*', { count: 'exact' })
    .eq('workspace_id', chillmineId);

  console.log('Posts in ChillMine workspace:', cmCount);
}

check().catch(console.error);
