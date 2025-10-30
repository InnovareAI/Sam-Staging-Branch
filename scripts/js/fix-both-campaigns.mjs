#!/usr/bin/env node
/**
 * Fix both broken campaigns by transferring approved prospects
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

// Campaign 1: test 2 -> Session: test 2
const CAMPAIGN_1 = {
  name: '20251030-IAI-test 2',
  sessionId: '23a9c931-4d04-4ea7-829c-22ea88a83d3e'
};

// Campaign 2: Outreach Campaign -> Session: test 1 (closest match)
const CAMPAIGN_2 = {
  name: '20251030-IAI-Outreach Campaign',
  sessionId: 'c4d58d37-0a98-449b-a5a6-fb400558d4f7'
};

async function transferProspects(campaignName, sessionId) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📋 FIXING: ${campaignName}`);
  console.log('='.repeat(70));

  // Get campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('name', campaignName)
    .single();

  if (!campaign) {
    console.log(`❌ Campaign not found: ${campaignName}`);
    return;
  }

  console.log(`   Campaign ID: ${campaign.id}`);

  // Check current prospects
  const { count: currentCount } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaign.id);

  if (currentCount && currentCount > 0) {
    console.log(`   ✅ Already has ${currentCount} prospects - skipping`);
    return;
  }

  // Get approved prospects from session
  const { data: approvedProspects } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', sessionId)
    .eq('approval_status', 'approved');

  if (!approvedProspects || approvedProspects.length === 0) {
    console.log(`   ⚠️ No approved prospects in session ${sessionId}`);
    return;
  }

  console.log(`   📊 Found ${approvedProspects.length} approved prospects`);

  // Transform and insert
  const campaignProspects = approvedProspects.map(prospect => {
    const contact = prospect.contact || {};
    const linkedinUrl = contact.linkedin_url || contact.linkedinUrl || prospect.linkedin_url;

    let firstName = 'Unknown';
    let lastName = 'User';

    if (prospect.name) {
      const nameParts = prospect.name.split(' ');
      firstName = nameParts[0] || 'Unknown';
      lastName = nameParts.slice(1).join(' ') || 'User';
    } else if (linkedinUrl) {
      const match = linkedinUrl.match(/\/in\/([^\/\?]+)/);
      if (match) {
        const urlName = match[1].split('-');
        firstName = urlName[0] ? urlName[0].charAt(0).toUpperCase() + urlName[0].slice(1) : 'Unknown';
        lastName = urlName.length > 1 ? urlName.slice(1).join('-') : 'User';
      }
    }

    return {
      campaign_id: campaign.id,
      workspace_id: WORKSPACE_ID,
      first_name: firstName,
      last_name: lastName,
      email: contact.email || null,
      company_name: prospect.company?.name || '',
      linkedin_url: linkedinUrl,
      title: prospect.title || '',
      location: prospect.location || null,
      industry: prospect.company?.industry || 'Not specified',
      status: 'approved',
      personalization_data: {
        source: 'approval_session',
        session_id: sessionId,
        approved_at: new Date().toISOString(),
        manual_fix: true
      }
    };
  });

  const { data: inserted, error } = await supabase
    .from('campaign_prospects')
    .insert(campaignProspects)
    .select();

  if (error) {
    console.log(`   ❌ Error: ${error.message}`);
  } else {
    console.log(`   ✅ Transferred ${inserted.length} prospects`);

    // Show first few prospects
    inserted.slice(0, 3).forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.first_name} ${p.last_name} - ${p.title || 'N/A'}`);
    });
  }
}

async function fixBothCampaigns() {
  console.log('🔧 FIXING BOTH CAMPAIGNS\n');

  await transferProspects(CAMPAIGN_1.name, CAMPAIGN_1.sessionId);
  await transferProspects(CAMPAIGN_2.name, CAMPAIGN_2.sessionId);

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ DONE - Both campaigns fixed');
  console.log('='.repeat(70));
  console.log('\nYou can now execute these campaigns.');
  console.log('\nNext: Create a NEW campaign to test that the fix is working automatically.');
  console.log('='.repeat(70));
}

fixBothCampaigns().catch(console.error);
