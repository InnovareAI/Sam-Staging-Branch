import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCampaigns() {
  console.log('🔍 Checking Charissa and Michelle campaigns...\n');

  // Find Charissa and Michelle's workspace accounts
  const { data: accounts, error: accountsError } = await supabase
    .from('workspace_accounts')
    .select('*')
    .or('account_name.ilike.%charissa%,account_name.ilike.%michelle%');

  if (accountsError) {
    console.error('Error fetching accounts:', accountsError);
    return;
  }

  console.log(`📧 Found ${accounts.length} account(s):\n`);
  accounts.forEach(a => {
    console.log(`  - ${a.account_name}`);
    console.log(`    ID: ${a.id}`);
    console.log(`    Unipile ID: ${a.unipile_account_id}`);
    console.log(`    Connection: ${a.connection_status}`);
    console.log(`    Workspace ID: ${a.workspace_id}`);
    console.log('');
  });

  // Check campaigns table schema
  const { data: sampleCampaign } = await supabase
    .from('campaigns')
    .select('*')
    .limit(1)
    .single();

  if (sampleCampaign) {
    console.log('Campaign table columns:', Object.keys(sampleCampaign));
    console.log('');
  }

  // Now check campaigns for each workspace
  for (const account of accounts) {
    console.log(`\n========== ${account.account_name} ==========`);
    console.log(`Workspace ID: ${account.workspace_id}\n`);

    // Get campaigns for this workspace (campaigns might be linked by workspace_id, not account_id)
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('workspace_id', account.workspace_id)
      .order('created_at', { ascending: false });

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError);
      continue;
    }

    console.log(`📊 Found ${campaigns.length} campaign(s) in workspace:`);

    campaigns.forEach(c => {
      console.log(`\n  Campaign: ${c.name}`);
      console.log(`    ID: ${c.id}`);
      console.log(`    Status: ${c.status}`);
      console.log(`    Type: ${c.campaign_type}`);
      console.log(`    Created: ${new Date(c.created_at).toLocaleString()}`);
    });

    // For each campaign, check prospect statuses
    for (const campaign of campaigns.slice(0, 5)) { // Check first 5 campaigns
      console.log(`\n  🎯 Checking prospects for "${campaign.name}"...`);

      const { data: prospects, error: prospectsError } = await supabase
        .from('campaign_prospects')
        .select('status, contacted_at')
        .eq('campaign_id', campaign.id);

      if (prospectsError) {
        console.error('    Error:', prospectsError.message);
        continue;
      }

      if (!prospects || prospects.length === 0) {
        console.log('    No prospects found');
        continue;
      }

      // Count by status
      const statusCounts = prospects.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {});

      console.log(`    Total prospects: ${prospects.length}`);
      console.log('    Status breakdown:');
      Object.entries(statusCounts)
        .sort(([,a], [,b]) => b - a)
        .forEach(([status, count]) => {
          console.log(`      ${status}: ${count}`);
        });

      // Check for queued_in_n8n or pending that haven't been contacted
      const notContacted = prospects.filter(p =>
        (p.status === 'queued_in_n8n' || p.status === 'pending') && !p.contacted_at
      );

      if (notContacted.length > 0) {
        console.log(`    ⚠️  ${notContacted.length} prospects not contacted yet (status: ${notContacted[0].status})`);
      }
    }
  }
}

checkCampaigns().catch(console.error);
