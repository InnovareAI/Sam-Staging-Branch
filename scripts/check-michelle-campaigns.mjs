import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMichelleCampaigns() {
  console.log('🔍 Checking Michelle campaigns...\n');

  // Michelle's workspace ID
  const michelleWorkspaceId = '04666209-fce8-4d71-8eaf-01278edfc73b';

  // Get all her active connector campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, campaign_type, linkedin_account_id, auto_execute, n8n_execution_id')
    .eq('workspace_id', michelleWorkspaceId)
    .eq('campaign_type', 'connector')
    .eq('status', 'active');

  console.log(`📊 Found ${campaigns?.length || 0} active connector campaigns:\n`);

  for (const campaign of campaigns || []) {
    console.log(`📋 ${campaign.name}`);
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Auto Execute: ${campaign.auto_execute}`);
    console.log(`   N8N Execution ID: ${campaign.n8n_execution_id || 'NULL (never executed)'}`);

    // Get prospect counts by status
    const { data: statusCounts } = await supabase
      .rpc('get_campaign_prospect_counts', { campaign_id_input: campaign.id })
      .single()
      .catch(() => null);

    if (!statusCounts) {
      const { data: prospects } = await supabase
        .from('campaign_prospects')
        .select('status')
        .eq('campaign_id', campaign.id);

      const counts = {};
      prospects?.forEach(p => {
        counts[p.status] = (counts[p.status] || 0) + 1;
      });

      console.log(`   Prospects:`);
      Object.entries(counts).forEach(([status, count]) => {
        console.log(`     ${status}: ${count}`);
      });
    }

    // Check last hour updates
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentUpdates, count } = await supabase
      .from('campaign_prospects')
      .select('first_name, last_name, status, updated_at', { count: 'exact' })
      .eq('campaign_id', campaign.id)
      .gte('updated_at', oneHourAgo)
      .order('updated_at', { ascending: false });

    console.log(`   Recent updates (last hour): ${count || 0}`);
    if (recentUpdates && recentUpdates.length > 0) {
      recentUpdates.slice(0, 5).forEach(p => {
        console.log(`     - ${p.first_name} ${p.last_name} → ${p.status} at ${new Date(p.updated_at).toLocaleTimeString()}`);
      });
    }

    console.log();
  }
}

checkMichelleCampaigns().catch(console.error);
