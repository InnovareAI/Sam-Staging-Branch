#!/usr/bin/env node

/**
 * Analyze Data Persistence Through the Funnel
 * Tracks: workspace_prospects → prospect_approval_data → campaigns → campaign_prospects
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';
const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

async function analyzeDataPersistence() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('🔍 ANALYZING DATA PERSISTENCE THROUGH FUNNEL');
  console.log('='.repeat(70));
  console.log(`Workspace ID: ${WORKSPACE_ID}\n`);

  // STEP 1: Check workspace_prospects (CRM data)
  console.log('📊 STEP 1: Workspace Prospects (CRM Data)');
  console.log('─'.repeat(70));

  const { data: workspaceProspects, error: wpError } = await supabase
    .from('workspace_prospects')
    .select('id, first_name, last_name, email, linkedin_url, created_at')
    .eq('workspace_id', WORKSPACE_ID)
    .order('created_at', { ascending: false })
    .limit(10);

  if (wpError) {
    console.log('❌ Error fetching workspace_prospects:', wpError.message);
  } else {
    console.log(`✅ Total workspace prospects: ${workspaceProspects?.length || 0} (showing latest 10)`);
    if (workspaceProspects && workspaceProspects.length > 0) {
      workspaceProspects.slice(0, 5).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.first_name} ${p.last_name}`);
        console.log(`      Email: ${p.email || 'N/A'}`);
        console.log(`      LinkedIn: ${p.linkedin_url || 'N/A'}`);
        console.log(`      Created: ${p.created_at}`);
      });
    }
  }
  console.log('');

  // STEP 2: Check prospect_approval_data (Sam AI extracted prospects)
  console.log('📊 STEP 2: Prospect Approval Data (Sam AI Extraction)');
  console.log('─'.repeat(70));

  const { data: approvalData, error: adError } = await supabase
    .from('prospect_approval_data')
    .select('id, status, contact, created_at')
    .eq('workspace_id', WORKSPACE_ID)
    .order('created_at', { ascending: false })
    .limit(10);

  if (adError) {
    console.log('❌ Error fetching prospect_approval_data:', adError.message);
  } else {
    console.log(`✅ Total approval data records: ${approvalData?.length || 0} (showing latest 10)`);

    const approved = approvalData?.filter(p => p.status === 'approved') || [];
    const pending = approvalData?.filter(p => p.status === 'pending') || [];
    const rejected = approvalData?.filter(p => p.status === 'rejected') || [];

    console.log(`   Approved: ${approved.length}`);
    console.log(`   Pending: ${pending.length}`);
    console.log(`   Rejected: ${rejected.length}`);

    if (approvalData && approvalData.length > 0) {
      console.log('\n   Latest records:');
      approvalData.slice(0, 3).forEach((p, i) => {
        const contact = p.contact || {};
        console.log(`   ${i + 1}. ${contact.firstName || 'N/A'} ${contact.lastName || 'N/A'}`);
        console.log(`      Status: ${p.status}`);
        console.log(`      LinkedIn: ${contact.linkedin_url || 'N/A'}`);
        console.log(`      Created: ${p.created_at}`);
      });
    }
  }
  console.log('');

  // STEP 3: Check campaigns
  console.log('📊 STEP 3: Campaigns');
  console.log('─'.repeat(70));

  const { data: campaigns, error: cError } = await supabase
    .from('campaigns')
    .select('id, name, status, created_at')
    .eq('workspace_id', WORKSPACE_ID)
    .order('created_at', { ascending: false })
    .limit(10);

  if (cError) {
    console.log('❌ Error fetching campaigns:', cError.message);
  } else {
    console.log(`✅ Total campaigns: ${campaigns?.length || 0} (showing latest 10)`);
    if (campaigns && campaigns.length > 0) {
      campaigns.forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.name}`);
        console.log(`      Status: ${c.status}`);
        console.log(`      ID: ${c.id}`);
        console.log(`      Created: ${c.created_at}`);
      });
    }
  }
  console.log('');

  // STEP 4: Check campaign_prospects (linked to campaigns)
  console.log('📊 STEP 4: Campaign Prospects (Campaign-linked data)');
  console.log('─'.repeat(70));

  const { data: campaignProspects, error: cpError } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, campaign_id, status, linkedin_url, email, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (cpError) {
    console.log('❌ Error fetching campaign_prospects:', cpError.message);
  } else {
    console.log(`✅ Total campaign prospects: ${campaignProspects?.length || 0} (showing latest 20)`);

    // Group by campaign
    if (campaignProspects && campaignProspects.length > 0 && campaigns) {
      const byCampaign = {};

      campaignProspects.forEach(cp => {
        if (!byCampaign[cp.campaign_id]) {
          byCampaign[cp.campaign_id] = [];
        }
        byCampaign[cp.campaign_id].push(cp);
      });

      console.log('\n   Grouped by campaign:');
      Object.entries(byCampaign).forEach(([campaignId, prospects]) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        console.log(`\n   📋 ${campaign?.name || 'Unknown Campaign'} (${prospects.length} prospects)`);
        prospects.slice(0, 3).forEach(p => {
          console.log(`      - ${p.first_name} ${p.last_name} (${p.status})`);
          console.log(`        LinkedIn: ${p.linkedin_url ? 'Yes' : 'No'} | Email: ${p.email ? 'Yes' : 'No'}`);
        });
      });
    }
  }
  console.log('');

  // STEP 5: Data Flow Analysis
  console.log('🔄 STEP 5: Data Flow Analysis');
  console.log('─'.repeat(70));

  const wpCount = workspaceProspects?.length || 0;
  const adCount = approvalData?.length || 0;
  const cpCount = campaignProspects?.length || 0;
  const cCount = campaigns?.length || 0;

  console.log('Data flow through funnel:');
  console.log(`   1. Workspace Prospects (CRM):          ${wpCount} records`);
  console.log(`   2. Prospect Approval Data (Sam AI):    ${adCount} records`);
  console.log(`   3. Campaigns:                          ${cCount} records`);
  console.log(`   4. Campaign Prospects (Linked):        ${cpCount} records`);
  console.log('');

  // Check for data loss
  if (adCount > 0 && cpCount === 0) {
    console.log('⚠️  WARNING: Prospects approved but NOT linked to campaigns!');
    console.log('   Possible issue: Approval → Campaign linking broken');
  } else if (cpCount > 0 && adCount === 0) {
    console.log('ℹ️  Campaign prospects exist without approval data');
    console.log('   This is OK if prospects were manually added');
  } else if (wpCount > 0 && adCount === 0) {
    console.log('ℹ️  Workspace prospects exist without approval flow');
    console.log('   This is OK - not all prospects need Sam AI approval');
  } else {
    console.log('✅ Data persistence looks healthy across all stages');
  }
  console.log('');

  // STEP 6: Check specific campaign data integrity
  console.log('🔍 STEP 6: Campaign Data Integrity Check');
  console.log('─'.repeat(70));

  if (campaigns && campaigns.length > 0) {
    for (const campaign of campaigns.slice(0, 3)) {
      const { data: prospects } = await supabase
        .from('campaign_prospects')
        .select('id, first_name, last_name, status, linkedin_url, email, contacted_at')
        .eq('campaign_id', campaign.id);

      const ready = prospects?.filter(p =>
        ['pending', 'queued_in_n8n'].includes(p.status) &&
        !p.contacted_at &&
        (p.linkedin_url || p.email)
      ) || [];

      const contacted = prospects?.filter(p => p.contacted_at) || [];

      console.log(`\n   📋 ${campaign.name}`);
      console.log(`      Total: ${prospects?.length || 0} | Ready: ${ready.length} | Contacted: ${contacted.length}`);

      if (prospects && prospects.length > 0) {
        console.log('      Data quality:');
        const withLinkedIn = prospects.filter(p => p.linkedin_url).length;
        const withEmail = prospects.filter(p => p.email).length;
        console.log(`        LinkedIn URLs: ${withLinkedIn}/${prospects.length}`);
        console.log(`        Email addresses: ${withEmail}/${prospects.length}`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Analysis Complete');
  console.log('='.repeat(70));
}

analyzeDataPersistence().catch(console.error);
