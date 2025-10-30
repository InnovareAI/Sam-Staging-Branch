#!/usr/bin/env node
/**
 * Check the Outreach Campaign status
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

async function checkOutreachCampaign() {
  console.log('🔍 CHECKING OUTREACH CAMPAIGN\n');
  console.log('='.repeat(70));

  // Get the Outreach Campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('name', '20251030-IAI-Outreach Campaign')
    .single();

  if (!campaign) {
    console.log('❌ Campaign not found');
    return;
  }

  console.log('\n📋 CAMPAIGN INFO:');
  console.log(`   Name: ${campaign.name}`);
  console.log(`   ID: ${campaign.id}`);
  console.log(`   Status: ${campaign.status}`);
  console.log(`   Owner: ${campaign.created_by}`);

  // Get owner details
  const { data: owner } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('user_id', campaign.created_by)
    .eq('workspace_id', WORKSPACE_ID)
    .eq('account_type', 'linkedin')
    .eq('connection_status', 'connected')
    .single();

  if (owner) {
    console.log(`   LinkedIn Account: ${owner.account_name}`);
  }

  // Get prospects
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaign.id);

  console.log(`\n👥 PROSPECTS: ${prospects?.length || 0}`);

  if (prospects && prospects.length > 0) {
    prospects.forEach((p, i) => {
      console.log(`\n   ${i + 1}. ${p.first_name} ${p.last_name}`);
      console.log(`      Status: ${p.status}`);
      console.log(`      Contacted: ${p.contacted_at ? 'YES' : 'NO'}`);
      console.log(`      LinkedIn: ${p.linkedin_url}`);
    });
  }

  console.log('\n' + '='.repeat(70));

  if (prospects && prospects.length > 0) {
    const ready = prospects.filter(p => !p.contacted_at && p.status === 'approved');
    console.log(`✅ Campaign ready to execute with ${ready.length} prospects`);
  } else {
    console.log('❌ Campaign has no prospects');
  }

  console.log('='.repeat(70));
}

checkOutreachCampaign().catch(console.error);
