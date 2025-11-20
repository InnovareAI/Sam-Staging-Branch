import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAccounts() {
  // Check both Michelle and Charissa
  const names = ['Michelle Angelica  Gestuveo', '𝗖𝗵𝗮𝗿𝗶𝘀𝘀𝗮 𝗦𝗮𝗻𝗶𝗲𝗹'];

  for (const name of names) {
    const { data: accounts } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('account_name', name);

    if (!accounts || accounts.length === 0) continue;

    const account = accounts[0];
    console.log(`\n========== ${account.account_name} ==========`);
    console.log(`Unipile ID: ${account.unipile_account_id}`);
    console.log(`Connection: ${account.connection_status}`);
    console.log(`Workspace: ${account.workspace_id}\n`);

    // Get campaigns
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, name, status, created_at')
      .eq('workspace_id', account.workspace_id)
      .order('created_at', { ascending: false })
      .limit(10);

    console.log(`Campaigns (${campaigns?.length || 0}):`);

    if (!campaigns || campaigns.length === 0) {
      console.log('  No campaigns found\n');
      continue;
    }

    for (const campaign of campaigns) {
      // Count prospects by status
      const { data: prospects } = await supabase
        .from('campaign_prospects')
        .select('status')
        .eq('campaign_id', campaign.id);

      const statusCounts = (prospects || []).reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {});

      console.log(`\n  📋 ${campaign.name}`);
      console.log(`     Status: ${campaign.status}`);
      console.log(`     Created: ${new Date(campaign.created_at).toLocaleString()}`);
      console.log(`     Prospects: ${prospects?.length || 0}`);
      if (prospects && prospects.length > 0) {
        Object.entries(statusCounts).forEach(([status, count]) => {
          console.log(`       - ${status}: ${count}`);
        });
      }
    }

    console.log('\n');
  }
}

checkAccounts().catch(console.error);
