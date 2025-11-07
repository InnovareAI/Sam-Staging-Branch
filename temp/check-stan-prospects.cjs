require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStanProspects() {
  console.log('🔍 CHECKING STAN\'S WORKSPACE\n');
  console.log('=' .repeat(70));

  // Find Stan's workspace
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, company_name')
    .or('name.ilike.%stan%,company_name.ilike.%stan%');

  if (!workspaces || workspaces.length === 0) {
    console.log('\n❌ No workspace found for Stan');

    // Show all workspaces
    const { data: allWorkspaces } = await supabase
      .from('workspaces')
      .select('id, name, company_name')
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('\n📋 Available workspaces:');
    allWorkspaces?.forEach((w, i) => {
      console.log(`${i + 1}. ${w.name} (${w.company_name || 'No company'})`);
    });
    return;
  }

  const workspace = workspaces[0];
  console.log(`\n✅ Found workspace: ${workspace.name}`);
  console.log(`   Company: ${workspace.company_name || 'N/A'}`);
  console.log(`   ID: ${workspace.id}\n`);

  // Check for approved prospects
  const { data: prospects, count } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, company, title, linkedin_url, status', { count: 'exact' })
    .eq('workspace_id', workspace.id)
    .in('status', ['approved', 'pending', 'ready_to_message'])
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`📊 Available prospects: ${count || 0}\n`);

  if (prospects && prospects.length > 0) {
    prospects.forEach((p, i) => {
      console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
      console.log(`   ${p.title || 'No title'} at ${p.company || 'Unknown company'}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   LinkedIn: ${p.linkedin_url ? '✅' : '❌ Missing'}`);
      console.log('');
    });
  } else {
    console.log('⚠️  No approved prospects found\n');

    // Check if there are any prospects at all
    const { data: allProspects, count: totalCount } = await supabase
      .from('campaign_prospects')
      .select('status', { count: 'exact' })
      .eq('workspace_id', workspace.id);

    if (totalCount > 0) {
      console.log(`📋 Total prospects in workspace: ${totalCount}`);

      // Show status breakdown
      const statusCounts = {};
      allProspects.forEach(p => {
        statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
      });

      console.log('\nStatus breakdown:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
    }
  }

  // Check existing campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, created_at')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (campaigns && campaigns.length > 0) {
    console.log('\n📋 Recent campaigns:');
    campaigns.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name} (${c.status}) - ${new Date(c.created_at).toLocaleDateString()}`);
    });
  }

  console.log('\n' + '=' .repeat(70));
  console.log(`\nWorkspace ID: ${workspace.id}`);
}

checkStanProspects().catch(console.error);
