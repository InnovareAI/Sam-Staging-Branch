import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Find Asphericon workspace
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .ilike('name', '%asphericon%');

  console.log('Asphericon workspaces:', workspaces);

  if (!workspaces || workspaces.length === 0) {
    console.log('No Asphericon workspace found');
    return;
  }

  const workspaceId = workspaces[0].id;
  console.log('\nUsing workspace:', workspaceId);

  // Check campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, created_at')
    .eq('workspace_id', workspaceId);

  console.log('\nCampaigns:');
  for (const c of (campaigns || [])) {
    console.log(`  - ${c.name} (${c.status}) - created ${c.created_at}`);
  }

  // Check campaign prospects status breakdown
  for (const campaign of (campaigns || [])) {
    const { data: prospects, error } = await supabase
      .from('campaign_prospects')
      .select('id, status, linkedin_url, first_name, last_name, created_at, updated_at')
      .eq('campaign_id', campaign.id);

    if (error) {
      console.log('Error fetching prospects:', error);
      continue;
    }

    // Group by status
    const statusCounts = {};
    for (const p of (prospects || [])) {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    }

    console.log(`\nCampaign: ${campaign.name}`);
    console.log('  Status breakdown:', statusCounts);
    console.log('  Total prospects:', prospects?.length || 0);

    // Show stuck prospects (approved but not queued, or pending too long)
    const stuckProspects = (prospects || []).filter(p =>
      p.status === 'approved' || p.status === 'pending'
    );
    if (stuckProspects.length > 0) {
      console.log(`  Potentially stuck (approved/pending): ${stuckProspects.length}`);
      for (const sp of stuckProspects.slice(0, 5)) {
        console.log(`    - ${sp.first_name} ${sp.last_name} (${sp.status}) - updated ${sp.updated_at}`);
      }
    }
  }

  // Check send queue for this workspace's campaigns
  const campaignIds = (campaigns || []).map(c => c.id);
  if (campaignIds.length > 0) {
    const { data: queue } = await supabase
      .from('send_queue')
      .select('id, status, scheduled_for, error_message, campaign_id')
      .in('campaign_id', campaignIds);

    const queueByStatus = {};
    for (const q of (queue || [])) {
      queueByStatus[q.status] = (queueByStatus[q.status] || 0) + 1;
    }
    console.log('\nSend queue status:', queueByStatus);

    // Check for stuck items (pending but scheduled_for in the past)
    const now = new Date().toISOString();
    const stuck = (queue || []).filter(q =>
      q.status === 'pending' && q.scheduled_for < now
    );

    console.log('\nStuck queue items (pending but past scheduled time):', stuck.length);
    if (stuck.length > 0) {
      console.log('Sample stuck items:');
      for (const s of stuck.slice(0, 5)) {
        console.log(`  - scheduled: ${s.scheduled_for}, error: ${s.error_message || 'none'}`);
      }
    }

    // Check for failed items
    const failed = (queue || []).filter(q => q.status === 'failed');
    if (failed.length > 0) {
      console.log('\nFailed queue items:', failed.length);
      for (const f of failed.slice(0, 5)) {
        console.log(`  - error: ${f.error_message}`);
      }
    }
  }

  // Check prospect_approval_data for pending approvals
  const { data: approvalData } = await supabase
    .from('prospect_approval_data')
    .select('id, status, first_name, last_name, session_id')
    .eq('workspace_id', workspaceId);

  if (approvalData && approvalData.length > 0) {
    const approvalByStatus = {};
    for (const a of approvalData) {
      approvalByStatus[a.status] = (approvalByStatus[a.status] || 0) + 1;
    }
    console.log('\nProspect approval data:', approvalByStatus);
  }
}

check().catch(console.error);
