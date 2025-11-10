#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

async function checkRecentCampaigns() {
  // Get recent campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .order('created_at', { ascending: false })
    .limit(3);

  console.log(`\n📋 Recent Campaigns (${campaigns?.length || 0}):\n`);

  for (const campaign of campaigns || []) {
    console.log(`Campaign: ${campaign.name || 'NO NAME'}`);
    console.log(`  ID: ${campaign.id}`);
    console.log(`  Created: ${new Date(campaign.created_at).toLocaleString()}`);
    console.log(`  Status: ${campaign.status}`);
    console.log(`  Approval Session ID: ${campaign.approval_session_id || 'NULL'}`);

    // Count prospects for this campaign
    const { count } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);

    console.log(`  Total Prospects: ${count || 0}`);

    // Get sample prospect with LinkedIn URL
    const { data: sample } = await supabase
      .from('campaign_prospects')
      .select('first_name, last_name, linkedin_url, status')
      .eq('campaign_id', campaign.id)
      .limit(2);

    if (sample && sample.length > 0) {
      console.log(`  Sample Prospects:`);
      sample.forEach((p, i) => {
        console.log(`    ${i + 1}. ${p.first_name} ${p.last_name}`);
        console.log(`       LinkedIn: ${p.linkedin_url || 'NULL'}`);
        console.log(`       Status: ${p.status}`);
      });
    }

    console.log('');
  }
}

checkRecentCampaigns();
