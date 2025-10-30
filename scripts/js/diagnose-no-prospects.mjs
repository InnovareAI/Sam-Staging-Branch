#!/usr/bin/env node
/**
 * Diagnose why no prospects are ready for messaging
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

async function diagnose() {
  console.log('🔍 DIAGNOSING "NO PROSPECTS READY" ISSUE\n');
  console.log('='.repeat(70));

  // Check all campaigns
  console.log('\n📊 STEP 1: Check All Campaigns');
  console.log('-'.repeat(70));

  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id, name, status, created_at')
    .eq('workspace_id', WORKSPACE_ID)
    .order('created_at', { ascending: false });

  if (campaignsError) {
    console.error('❌ Error:', campaignsError);
    return;
  }

  console.log(`Found ${campaigns.length} campaigns:\n`);
  campaigns.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name}`);
    console.log(`   ID: ${c.id}`);
    console.log(`   Status: ${c.status}`);
    console.log(`   Created: ${new Date(c.created_at).toLocaleString()}`);
    console.log('');
  });

  if (campaigns.length === 0) {
    console.log('⚠️  No campaigns found. Create a campaign first.');
    return;
  }

  // Check prospects for each campaign
  for (const campaign of campaigns) {
    console.log(`\n👥 STEP 2: Check Prospects for "${campaign.name}"`);
    console.log('-'.repeat(70));

    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaign.id)
      .order('created_at', { ascending: false });

    console.log(`Total prospects: ${prospects?.length || 0}\n`);

    if (!prospects || prospects.length === 0) {
      console.log('❌ No prospects found for this campaign');
      console.log('   Possible reasons:');
      console.log('   1. Campaign was just created but no prospects added yet');
      console.log('   2. Prospects approval flow not completed');
      console.log('   3. Need to run: POST /api/campaigns/add-approved-prospects');
      continue;
    }

    // Analyze prospect statuses
    const statusCounts = {};
    prospects.forEach(p => {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    });

    console.log('Status breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    // Check why prospects might not be ready
    console.log('\n🔍 Detailed Analysis:\n');

    const notReady = prospects.filter(p =>
      !['pending', 'approved', 'ready_to_message'].includes(p.status) ||
      p.contacted_at ||
      !p.linkedin_url
    );

    const ready = prospects.filter(p =>
      ['pending', 'approved', 'ready_to_message'].includes(p.status) &&
      !p.contacted_at &&
      p.linkedin_url
    );

    console.log(`✅ Ready to message: ${ready.length}`);
    console.log(`❌ Not ready: ${notReady.length}\n`);

    if (ready.length > 0) {
      console.log('Ready prospects:');
      ready.slice(0, 5).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.first_name} ${p.last_name}`);
        console.log(`      Status: ${p.status}`);
        console.log(`      LinkedIn: ${p.linkedin_url || '❌ MISSING'}`);
        console.log(`      Contacted: ${p.contacted_at ? 'Yes' : 'No'}`);
      });
    }

    if (notReady.length > 0) {
      console.log('\nNot ready - reasons:');

      const alreadyContacted = prospects.filter(p => p.contacted_at);
      const missingUrl = prospects.filter(p => !p.linkedin_url);
      const wrongStatus = prospects.filter(p =>
        !['pending', 'approved', 'ready_to_message'].includes(p.status)
      );

      if (alreadyContacted.length > 0) {
        console.log(`   ${alreadyContacted.length} already contacted`);
      }
      if (missingUrl.length > 0) {
        console.log(`   ${missingUrl.length} missing LinkedIn URL`);
        console.log('   Sample:');
        missingUrl.slice(0, 3).forEach(p => {
          console.log(`      - ${p.first_name} ${p.last_name}: linkedin_url = ${p.linkedin_url}`);
        });
      }
      if (wrongStatus.length > 0) {
        console.log(`   ${wrongStatus.length} have wrong status`);
        console.log('   Sample:');
        wrongStatus.slice(0, 3).forEach(p => {
          console.log(`      - ${p.first_name} ${p.last_name}: status = ${p.status}`);
        });
      }
    }
  }

  // Check approval sessions
  console.log('\n\n📝 STEP 3: Check Approval Sessions (Drafts)');
  console.log('-'.repeat(70));

  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('id, campaign_name, status, created_at')
    .eq('workspace_id', WORKSPACE_ID)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`Found ${sessions?.length || 0} approval sessions\n`);

  if (sessions && sessions.length > 0) {
    sessions.forEach((s, i) => {
      console.log(`${i + 1}. ${s.campaign_name || 'Unnamed'}`);
      console.log(`   Status: ${s.status}`);
      console.log(`   Created: ${new Date(s.created_at).toLocaleString()}`);
    });

    console.log('\n💡 TIP: To convert approval session to campaign:');
    console.log('   1. Approve prospects in UI');
    console.log('   2. System auto-creates campaign');
    console.log('   3. System adds prospects via /api/campaigns/add-approved-prospects');
  }

  // Summary
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));

  const totalCampaigns = campaigns.length;
  const totalProspectsAcrossAll = await Promise.all(
    campaigns.map(async c => {
      const { data } = await supabase
        .from('campaign_prospects')
        .select('*')
        .eq('campaign_id', c.id);
      return data?.length || 0;
    })
  );

  const totalProspects = totalProspectsAcrossAll.reduce((a, b) => a + b, 0);

  console.log(`\n   Total campaigns: ${totalCampaigns}`);
  console.log(`   Total prospects: ${totalProspects}`);

  if (totalCampaigns === 0) {
    console.log('\n   ⚠️  ACTION NEEDED: Create a campaign first');
  } else if (totalProspects === 0) {
    console.log('\n   ⚠️  ACTION NEEDED: Add prospects to campaign');
    console.log('   Options:');
    console.log('   1. Upload CSV');
    console.log('   2. LinkedIn search');
    console.log('   3. Approve prospects from approval session');
  }

  console.log('\n' + '='.repeat(70));
}

diagnose().catch(console.error);
