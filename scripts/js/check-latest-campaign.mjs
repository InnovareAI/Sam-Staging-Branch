#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLatestCampaign() {
  console.log('🔍 Checking recent campaigns and prospects...\n');

  // Get most recent campaign
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!campaigns || campaigns.length === 0) {
    console.log('❌ No campaigns found');
    return;
  }

  const campaign = campaigns[0];
  console.log('📋 Most Recent Campaign:');
  console.log('  Name:', campaign.name);
  console.log('  ID:', campaign.id);
  console.log('  Created:', new Date(campaign.created_at).toLocaleString());
  console.log();

  // Get prospects for this campaign
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaign.id);

  console.log(`📊 Campaign Prospects: ${prospects?.length || 0}\n`);

  if (prospects && prospects.length > 0) {
    prospects.forEach((p, idx) => {
      console.log(`${idx + 1}. ${p.first_name} ${p.last_name}`);
      console.log(`   Company: ${p.company_name || 'N/A'}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   LinkedIn URL: ${p.linkedin_url || '❌ MISSING'}`);
      console.log(`   Email: ${p.email || 'N/A'}`);

      // Check if executable
      const executableStatuses = ['pending', 'approved', 'ready_to_message', 'follow_up_due'];
      const hasLinkedIn = p.linkedin_url || p.linkedin_user_id;
      const isExecutable = executableStatuses.includes(p.status) && hasLinkedIn;

      console.log(`   Executable: ${isExecutable ? '✅ YES' : '❌ NO'}`);

      if (!isExecutable) {
        const reasons = [];
        if (!executableStatuses.includes(p.status)) {
          reasons.push(`Wrong status: "${p.status}" (needs: ${executableStatuses.join(', ')})`);
        }
        if (!hasLinkedIn) {
          reasons.push('Missing LinkedIn URL/ID');
        }
        console.log(`   Why not: ${reasons.join('; ')}`);
      }
      console.log();
    });
  } else {
    console.log('❌ No prospects in campaign!');
    console.log('   This means prospects were not added from the approval session.');
  }
}

checkLatestCampaign();
