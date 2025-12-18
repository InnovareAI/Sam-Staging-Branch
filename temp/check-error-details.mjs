import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function check() {
  const weekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString();

  // Get failed queue items with error messages
  const { data: failed } = await supabase
    .from('send_queue')
    .select('campaign_id, error_message')
    .eq('status', 'failed')
    .gte('updated_at', weekAgo);

  // Get campaigns with workspace
  const campaignIds = [...new Set((failed || []).map(q => q.campaign_id))];
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, workspace_id, campaign_name')
    .in('id', campaignIds);

  const campaignMap = {};
  (campaigns || []).forEach(c => campaignMap[c.id] = c);

  // Get workspace names
  const wsIds = [...new Set((campaigns || []).map(c => c.workspace_id))];
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .in('id', wsIds);

  const wsMap = {};
  (workspaces || []).forEach(w => wsMap[w.id] = w.name);

  // Aggregate errors by workspace
  const errorsByWs = {};
  (failed || []).forEach(f => {
    const camp = campaignMap[f.campaign_id];
    if (!camp) return;
    const ws = camp.workspace_id;
    const wsName = wsMap[ws] || ws.substring(0,8);

    if (!errorsByWs[wsName]) errorsByWs[wsName] = {};

    // Normalize error message
    let errType = f.error_message || 'Unknown';
    if (errType.includes('Should delay')) errType = 'Should delay (rate limit)';
    else if (errType.includes('already invited')) errType = 'Already invited';
    else if (errType.includes('Cannot invite attendee')) errType = 'Cannot invite attendee';
    else if (errType.includes('not found')) errType = 'Profile not found';
    else if (errType.includes('timeout')) errType = 'Timeout';
    else if (errType.length > 50) errType = errType.substring(0, 50) + '...';

    errorsByWs[wsName][errType] = (errorsByWs[wsName][errType] || 0) + 1;
  });

  console.log('Error Breakdown by Workspace (7d):');
  console.log('===================================\n');

  Object.entries(errorsByWs)
    .sort((a, b) => Object.values(b[1]).reduce((s, v) => s + v, 0) - Object.values(a[1]).reduce((s, v) => s + v, 0))
    .forEach(([ws, errors]) => {
      const total = Object.values(errors).reduce((s, v) => s + v, 0);
      console.log(`${ws} (${total} errors):`);
      Object.entries(errors)
        .sort((a, b) => b[1] - a[1])
        .forEach(([err, count]) => {
          console.log(`  ${count}x ${err}`);
        });
      console.log('');
    });
}

check().catch(console.error);
