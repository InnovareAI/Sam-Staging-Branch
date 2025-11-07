require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findStanWorkspace() {
  // Get all workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, company_name')
    .order('name');

  console.log(`\n📋 All Workspaces:\n`);
  workspaces?.forEach((w, i) => {
    const display = `${w.name}${w.company_name ? ` (${w.company_name})` : ''}`;
    console.log(`${i + 1}. ${display}`);
  });

  // Look for Stan
  const stanWorkspace = workspaces?.find(w =>
    w.name?.toLowerCase().includes('stan') ||
    w.company_name?.toLowerCase().includes('stan')
  );

  if (stanWorkspace) {
    console.log(`\n✅ Found Stan's workspace: ${stanWorkspace.name}`);
    console.log(`   ID: ${stanWorkspace.id}\n`);

    // Check prospects
    const { count } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', stanWorkspace.id);

    console.log(`   Total prospects: ${count || 0}`);
  } else {
    console.log(`\n⚠️  No workspace found with "Stan" in name or company`);
  }
}

findStanWorkspace().catch(console.error);
