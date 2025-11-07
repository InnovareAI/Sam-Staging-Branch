const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCampaignWorkspace() {
  console.log('🔍 Checking recent campaigns...\n');

  // Get recent campaigns
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`Found ${campaigns.length} recent campaigns:\n`);

  campaigns.forEach(camp => {
    console.log(`Campaign: ${camp.name}`);
    console.log(`ID: ${camp.id}`);
    console.log(`Workspace ID: ${camp.workspace_id}`);
    console.log(`Status: ${camp.status}`);
    console.log(`Created: ${camp.created_at}`);
    console.log('---\n');
  });

  // Check if campaigns have LinkedIn accounts in their workspaces
  for (const camp of campaigns) {
    const { data: accounts } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', camp.workspace_id)
      .eq('account_type', 'linkedin')
      .eq('is_active', true);

    console.log(`\n📊 Campaign: ${camp.name}`);
    console.log(`Workspace: ${camp.workspace_id}`);
    console.log(`LinkedIn Accounts: ${accounts.length}`);
    if (accounts.length > 0) {
      accounts.forEach(acc => {
        console.log(`  ✅ ${acc.account_name} (${acc.unipile_account_id})`);
      });
    } else {
      console.log('  ❌ NO LINKEDIN ACCOUNTS IN THIS WORKSPACE');
    }
  }
}

checkCampaignWorkspace().catch(console.error);
