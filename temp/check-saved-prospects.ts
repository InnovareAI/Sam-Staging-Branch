import { createClient } from '@supabase/supabase-js';

async function check() {
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  // Check ALL prospects
  const { data: allProspects, error } = await supabase
    .from('workspace_prospects')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('❌ Query error:', error);
  } else {
    console.log(`\n📊 Total prospects in workspace: ${allProspects?.length || 0}\n`);

    if (allProspects && allProspects.length > 0) {
      console.log('Columns in table:', Object.keys(allProspects[0]).join(', '));
      console.log('\nFirst 5 prospects:');
      allProspects.slice(0, 5).forEach((p, i) => {
        console.log(`\n${i+1}. ${p.first_name} ${p.last_name}`);
        console.log(`   Title: ${p.job_title}`);
        console.log(`   Company: ${p.company_name}`);
        console.log(`   LinkedIn: ${p.linkedin_profile_url?.substring(0, 50)}...`);
        console.log(`   Created: ${new Date(p.created_at).toLocaleString()}`);
      });
    } else {
      console.log('❌ No prospects found in database');
    }
  }

  // Also check if table has ANY data at all
  const { count } = await supabase
    .from('workspace_prospects')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📈 Total rows in workspace_prospects table (all workspaces): ${count}`);
}

check();
