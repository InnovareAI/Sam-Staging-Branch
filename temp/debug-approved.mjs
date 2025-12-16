#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const targetNames = ['Irish Maguad', 'Charissa Saniel', 'Michelle Gestuveo'];

console.log('🔍 DEBUGGING APPROVED PROSPECTS');
console.log('='.repeat(70));

for (const name of targetNames) {
  console.log(`\n👤 ${name}:`);

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('name', name)
    .single();

  if (!workspace) continue;

  // Get ALL approved prospects
  const { data: allApproved } = await supabase
    .from('campaign_prospects')
    .select('id, campaign_id, campaigns!inner(name, status, linkedin_account_id)')
    .eq('workspace_id', workspace.id)
    .eq('status', 'approved');

  console.log(`   Total approved: ${allApproved?.length || 0}`);

  // Group by campaign
  const byCampaign = {};
  allApproved?.forEach(p => {
    const cName = p.campaigns?.name || 'Unknown';
    const cStatus = p.campaigns?.status || 'Unknown';
    const hasLinkedIn = p.campaigns?.linkedin_account_id ? 'Yes' : 'No';
    const key = `${cName} (${cStatus}, LinkedIn: ${hasLinkedIn})`;
    byCampaign[key] = (byCampaign[key] || 0) + 1;
  });

  Object.entries(byCampaign).forEach(([campaign, count]) => {
    console.log(`      - ${campaign}: ${count}`);
  });
}

console.log('\n' + '='.repeat(70));
