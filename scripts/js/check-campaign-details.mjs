#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const campaignId = '683f9214-8a3f-4015-98fe-aa3ae76a9ebe';

async function checkCampaign() {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*, workspace_accounts!linkedin_account_id(account_name)')
    .eq('id', campaignId)
    .single();

  if (campaign) {
    console.log('📋 Campaign Details:\n');
    console.log(`   Name: ${campaign.campaign_name || campaign.name || 'Unnamed'}`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Account: ${campaign.workspace_accounts?.account_name || 'N/A'}`);
    console.log(`   Created: ${new Date(campaign.created_at).toLocaleString()}\n`);
  }

  // Count prospects by status
  const { data: statusCounts } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT status, COUNT(*) as count
        FROM campaign_prospects
        WHERE campaign_id = '${campaignId}'
        GROUP BY status
        ORDER BY count DESC
      `
    });

  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('status')
    .eq('campaign_id', campaignId);

  if (prospects) {
    const counts = {};
    prospects.forEach(p => {
      counts[p.status] = (counts[p.status] || 0) + 1;
    });

    console.log('📊 Prospect Status Counts:\n');
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });

    console.log(`\n   Total: ${prospects.length} prospects`);
  }
}

checkCampaign().catch(console.error);
