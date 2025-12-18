import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function check() {
  const weekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString();

  // Get error rates by workspace
  const { data: allQueue } = await supabase
    .from('send_queue')
    .select('campaign_id, status')
    .gte('updated_at', weekAgo);

  // Get campaigns with workspace
  const campaignIds = [...new Set((allQueue || []).map(q => q.campaign_id))];
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, workspace_id, campaign_name, linkedin_account_id')
    .in('id', campaignIds);

  const campaignMap = {};
  (campaigns || []).forEach(c => campaignMap[c.id] = c);

  // Aggregate by workspace
  const stats = {};
  (allQueue || []).forEach(q => {
    const camp = campaignMap[q.campaign_id];
    if (!camp) return;
    const ws = camp.workspace_id;
    if (!stats[ws]) stats[ws] = { total: 0, failed: 0, sent: 0 };
    stats[ws].total++;
    if (q.status === 'failed') stats[ws].failed++;
    if (q.status === 'sent') stats[ws].sent++;
  });

  // Get workspace names and accounts
  const wsIds = Object.keys(stats);
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .in('id', wsIds);

  const { data: accounts } = await supabase
    .from('user_unipile_accounts')
    .select('workspace_id, account_name, connection_status, updated_at')
    .in('workspace_id', wsIds);

  const wsMap = {};
  (workspaces || []).forEach(w => wsMap[w.id] = w.name);

  const accMap = {};
  (accounts || []).forEach(a => {
    if (!accMap[a.workspace_id]) accMap[a.workspace_id] = [];
    accMap[a.workspace_id].push(a);
  });

  console.log('Workspace Error Rates (7d):');
  console.log('================================');

  const sorted = Object.entries(stats)
    .map(([ws, s]) => ({ ws, ...s, rate: s.total > 0 ? (s.failed/s.total*100).toFixed(1) : 0 }))
    .sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate));

  sorted.forEach(s => {
    const name = wsMap[s.ws] || s.ws.substring(0,8);
    const accs = accMap[s.ws] || [];
    const accStatus = accs.map(a => a.connection_status).join(',') || 'none';
    console.log(`${name}: ${s.rate}% (${s.failed}/${s.total}) - Accounts: ${accStatus}`);

    if (parseFloat(s.rate) > 10) {
      console.log(`  ⚠️ HIGH ERROR RATE`);
      accs.forEach(a => {
        const lastSync = a.updated_at ? new Date(a.updated_at).toLocaleDateString() : 'never';
        console.log(`    - ${a.account_name}: ${a.connection_status} (updated: ${lastSync})`);
      });
    }
  });
}

check().catch(console.error);
