#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const targetNames = ['Irish Maguad', 'Charissa Saniel', 'Michelle Gestuveo', 'Jennifer Fleming'];

console.log('🔍 CHECKING QUEUE STATUS');
console.log('='.repeat(70));

for (const name of targetNames) {
  console.log(`\n👤 ${name}:`);

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('name', name)
    .single();

  if (!workspace) {
    console.log('   Workspace not found');
    continue;
  }

  // Get campaigns for this workspace
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status')
    .eq('workspace_id', workspace.id)
    .eq('status', 'active');

  console.log(`   Active campaigns: ${campaigns?.length || 0}`);

  // Check send_queue by campaign_id (not workspace_id - it might not have that column)
  const campaignIds = campaigns?.map(c => c.id) || [];

  if (campaignIds.length > 0) {
    const { data: queue } = await supabase
      .from('send_queue')
      .select('id, status, campaign_id')
      .in('campaign_id', campaignIds);

    const qByStatus = {};
    queue?.forEach(q => {
      qByStatus[q.status] = (qByStatus[q.status] || 0) + 1;
    });

    console.log(`   Queue by campaign: ${JSON.stringify(qByStatus)}`);
  }

  // Also check email_send_queue
  if (campaignIds.length > 0) {
    const { data: emailQueue } = await supabase
      .from('email_send_queue')
      .select('id, status, campaign_id')
      .in('campaign_id', campaignIds);

    if (emailQueue && emailQueue.length > 0) {
      const eByStatus = {};
      emailQueue.forEach(q => {
        eByStatus[q.status] = (eByStatus[q.status] || 0) + 1;
      });
      console.log(`   Email queue: ${JSON.stringify(eByStatus)}`);
    }
  }

  // Check approved prospects that need queueing
  const { data: approvedProspects } = await supabase
    .from('campaign_prospects')
    .select('id, campaign_id')
    .eq('workspace_id', workspace.id)
    .eq('status', 'approved');

  if (approvedProspects && approvedProspects.length > 0) {
    console.log(`   ⚠️  ${approvedProspects.length} approved prospects need to be queued`);
  }
}

console.log('\n' + '='.repeat(70));
