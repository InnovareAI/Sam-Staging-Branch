import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkConnectorCampaigns() {
  console.log('🔍 Checking CONNECTOR campaigns only...\n');

  // Get all active connector campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, workspace_id, status, campaign_type, linkedin_account_id')
    .eq('status', 'active')
    .eq('campaign_type', 'connector');

  if (!campaigns || campaigns.length === 0) {
    console.log('❌ No active connector campaigns found\n');
    return;
  }

  console.log(`✅ Found ${campaigns.length} active connector campaigns:\n`);

  for (const campaign of campaigns) {
    console.log(`📋 ${campaign.name}`);
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Workspace: ${campaign.workspace_id}`);
    console.log(`   LinkedIn Account: ${campaign.linkedin_account_id || 'NOT SET'}`);

    // Get pending prospects count
    const { data: prospects, count } = await supabase
      .from('campaign_prospects')
      .select('id, status', { count: 'exact' })
      .eq('campaign_id', campaign.id)
      .eq('status', 'pending');

    console.log(`   Pending Prospects: ${count || 0}`);

    if (!campaign.linkedin_account_id) {
      console.log(`   ⚠️  NO LINKEDIN ACCOUNT CONNECTED\n`);
      continue;
    }

    // Get LinkedIn account details
    const { data: account } = await supabase
      .from('workspace_accounts')
      .select('account_name, unipile_account_id, is_active, connection_status')
      .eq('id', campaign.linkedin_account_id)
      .single();

    if (account) {
      console.log(`   LinkedIn: ${account.account_name}`);
      console.log(`   Unipile ID: ${account.unipile_account_id || 'MISSING'}`);
      console.log(`   Active: ${account.is_active}`);
      console.log(`   Connection: ${account.connection_status}`);
    }

    console.log();
  }
}

checkConnectorCampaigns().catch(console.error);
