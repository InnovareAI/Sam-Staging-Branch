#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCampaignState() {
  const campaignId = 'cc452d62-c3a4-4d90-bfb9-19063f7a5d79';
  const workspaceId = '96c03b38-a2f4-40de-9e16-43098599e1d4';
  
  console.log('\n🔍 CHECKING CAMPAIGN STATE FOR UI VISIBILITY\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Get campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (campaign) {
    console.log('Campaign Details:');
    console.log(`   ├─ Name: ${campaign.name}`);
    console.log(`   ├─ Status: ${campaign.status}`);
    console.log(`   ├─ Type: ${campaign.campaign_type}`);
    console.log(`   ├─ Workspace: ${campaign.workspace_id}`);
    console.log(`   ├─ Created: ${campaign.created_at}`);
    console.log(`   ├─ Updated: ${campaign.updated_at}`);
    console.log(`   └─ Launched At: ${campaign.launched_at || '❌ NULL'}\n`);

    // Get ALL campaigns for this workspace
    const { data: allCampaigns } = await supabase
      .from('campaigns')
      .select('id, name, status, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(10);

    console.log(`All Recent Campaigns for this workspace:\n`);
    allCampaigns?.forEach((c, i) => {
      const isCurrent = c.id === campaignId;
      console.log(`${i + 1}. ${isCurrent ? '👉 ' : '   '}${c.name}`);
      console.log(`      ├─ Status: ${c.status}`);
      console.log(`      ├─ ID: ${c.id}`);
      console.log(`      └─ Created: ${new Date(c.created_at).toLocaleString()}\n`);
    });

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 UI FILTER LOGIC:');
    console.log('   Campaigns are filtered by: c.status === "active"');
    console.log(`   This campaign status: "${campaign.status}"`);
    console.log(`   Should appear in Active tab: ${campaign.status === 'active' ? '✅ YES' : '❌ NO'}`);
    console.log('');
    console.log('💡 POSSIBLE ISSUES:');
    console.log('   1. React Query cache not invalidating');
    console.log('   2. User still in Campaign Builder view (not Active Campaigns tab)');
    console.log('   3. Frontend not refreshing after setCampaignFilter call');
    console.log('═══════════════════════════════════════════════════════════════\n');
  }
}

checkCampaignState();
