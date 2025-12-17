import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Get all workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, created_at')
    .order('created_at', { ascending: false });

  console.log('=== ALL WORKSPACES LINKEDIN ACCOUNT STATUS ===\n');

  const problems = [];

  for (const ws of (workspaces || [])) {
    // Check linkedin_accounts
    const { data: linkedinAccounts } = await supabase
      .from('linkedin_accounts')
      .select('id, name, connection_status')
      .eq('workspace_id', ws.id);

    // Check unipile_accounts
    const { data: unipileAccounts } = await supabase
      .from('unipile_accounts')
      .select('id, account_id, provider, status')
      .eq('workspace_id', ws.id);

    // Check workspace_integrations
    const { data: integrations } = await supabase
      .from('workspace_integrations')
      .select('integration_type, status')
      .eq('workspace_id', ws.id);

    // Check active campaigns
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, name, status, linkedin_account_id')
      .eq('workspace_id', ws.id);

    const activeCampaigns = (campaigns || []).filter(c => c.status === 'active' || c.status === 'paused');
    const linkedinCount = linkedinAccounts?.length || 0;
    const unipileCount = unipileAccounts?.length || 0;

    let status = '✅';
    let hasProblem = false;

    if (activeCampaigns.length > 0 && linkedinCount === 0 && unipileCount === 0) {
      status = '❌ NO LINKEDIN';
      hasProblem = true;
    } else if (linkedinCount === 0 && unipileCount === 0) {
      status = '⚠️  No account';
    }

    console.log(`${status} ${ws.name}`);
    console.log(`   LinkedIn accounts: ${linkedinCount}`);
    console.log(`   Unipile accounts: ${unipileCount}`);
    console.log(`   Active/Paused campaigns: ${activeCampaigns.length}`);

    // Check if campaign linkedin_account_id exists
    for (const c of activeCampaigns) {
      if (c.linkedin_account_id) {
        const { data: acct } = await supabase
          .from('linkedin_accounts')
          .select('id')
          .eq('id', c.linkedin_account_id)
          .single();

        if (!acct) {
          console.log(`   ❌ Campaign "${c.name}" references MISSING account: ${c.linkedin_account_id}`);
          problems.push({
            workspace: ws.name,
            campaign: c.name,
            issue: 'Missing LinkedIn account',
            accountId: c.linkedin_account_id
          });
        }
      } else {
        console.log(`   ❌ Campaign "${c.name}" has NO linkedin_account_id`);
        problems.push({
          workspace: ws.name,
          campaign: c.name,
          issue: 'No linkedin_account_id set'
        });
      }
    }
    console.log('');
  }

  console.log('\n=== SUMMARY OF PROBLEMS ===\n');
  if (problems.length === 0) {
    console.log('No problems found!');
  } else {
    console.log(`Found ${problems.length} problems:\n`);
    for (const p of problems) {
      console.log(`❌ ${p.workspace} - "${p.campaign}"`);
      console.log(`   Issue: ${p.issue}`);
      if (p.accountId) {
        console.log(`   Missing account ID: ${p.accountId}`);
      }
      console.log('');
    }
  }
}

check().catch(console.error);
