import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLastHourUpdates() {
  console.log('🔍 Checking prospect updates in last hour...\n');

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status, updated_at, campaign_id, campaigns(name, workspace_id)')
    .gte('updated_at', oneHourAgo)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (!prospects || prospects.length === 0) {
    console.log('❌ No prospect updates in last hour');
    return;
  }

  console.log(`✅ Found ${prospects.length} prospect updates:\n`);

  // Group by workspace
  const byWorkspace = {};
  for (const p of prospects) {
    const wsId = p.campaigns?.workspace_id || 'unknown';
    if (!byWorkspace[wsId]) {
      byWorkspace[wsId] = [];
    }
    byWorkspace[wsId].push(p);
  }

  // Get workspace names
  const workspaceIds = Object.keys(byWorkspace).filter(id => id !== 'unknown');
  const { data: workspaces } = await supabase
    .from('workspace_accounts')
    .select('workspace_id, account_name')
    .in('workspace_id', workspaceIds);

  const workspaceNames = {};
  workspaces?.forEach(w => {
    workspaceNames[w.workspace_id] = w.account_name;
  });

  for (const [wsId, wsProspects] of Object.entries(byWorkspace)) {
    const wsName = workspaceNames[wsId] || wsId;
    console.log(`\n📊 Workspace: ${wsName} (${wsProspects.length} updates)`);

    wsProspects.forEach(p => {
      console.log(`  - ${p.first_name} ${p.last_name}`);
      console.log(`    Status: ${p.status}`);
      console.log(`    Campaign: ${p.campaigns?.name || p.campaign_id}`);
      console.log(`    Updated: ${new Date(p.updated_at).toLocaleString()}`);
      console.log();
    });
  }
}

checkLastHourUpdates().catch(console.error);
