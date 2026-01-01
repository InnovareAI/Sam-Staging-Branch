import { createClient } from '@supabase/supabase-js';

async function check() {
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  // Check recent prospects
  const { data: prospects, error } = await supabase
    .from('workspace_prospects')
    .select('id, name, title, company, source, approval_status, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('📊 Total prospects found:', prospects?.length || 0);
    console.log('');
    prospects?.forEach((p, i) => {
      console.log(`${i+1}. ${p.name} - ${p.title} at ${p.company}`);
      console.log(`   Source: ${p.source}, Status: ${p.approval_status}`);
      console.log(`   Created: ${new Date(p.created_at).toLocaleString()}`);
      console.log('');
    });
  }
}

check();
