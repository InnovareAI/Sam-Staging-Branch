#!/usr/bin/env node
/**
 * Delete all campaigns and prospects for a fresh start
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteAllCampaigns() {
  console.log('🗑️  Deleting all campaigns and prospects...\n');

  // First, get all campaigns to see what we're deleting
  const { data: campaigns, error: fetchError } = await supabase
    .from('campaigns')
    .select('id, name, workspace_id');

  if (fetchError) {
    console.error('❌ Error fetching campaigns:', fetchError);
    process.exit(1);
  }

  if (!campaigns || campaigns.length === 0) {
    console.log('✅ No campaigns found - database is already clean!');
    return;
  }

  console.log(`📋 Found ${campaigns.length} campaigns to delete:\n`);
  campaigns.forEach((c, idx) => {
    console.log(`   ${idx + 1}. ${c.name} (${c.id})`);
  });
  console.log();

  // Get prospect counts per campaign
  console.log('📊 Checking prospect counts...\n');
  let totalProspects = 0;

  for (const campaign of campaigns) {
    const { count } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);

    totalProspects += count || 0;
    console.log(`   ${campaign.name}: ${count || 0} prospects`);
  }

  console.log(`\n   TOTAL: ${totalProspects} prospects across all campaigns\n`);

  // Delete all campaign_prospects first (due to foreign key constraints)
  console.log('🗑️  Step 1: Deleting all campaign prospects...');
  const { error: prospectsError } = await supabase
    .from('campaign_prospects')
    .delete()
    .in('campaign_id', campaigns.map(c => c.id));

  if (prospectsError) {
    console.error('❌ Error deleting prospects:', prospectsError);
    process.exit(1);
  }

  console.log(`✅ Deleted ${totalProspects} prospects\n`);

  // Now delete all campaigns
  console.log('🗑️  Step 2: Deleting all campaigns...');
  const { error: campaignsError } = await supabase
    .from('campaigns')
    .delete()
    .in('id', campaigns.map(c => c.id));

  if (campaignsError) {
    console.error('❌ Error deleting campaigns:', campaignsError);
    process.exit(1);
  }

  console.log(`✅ Deleted ${campaigns.length} campaigns\n`);

  // Verify deletion
  const { count: remainingCampaigns } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: true });

  const { count: remainingProspects } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true });

  console.log('✅ CLEANUP COMPLETE!\n');
  console.log('📊 Final Status:');
  console.log(`   Campaigns remaining: ${remainingCampaigns || 0}`);
  console.log(`   Prospects remaining: ${remainingProspects || 0}`);
  console.log('\n🎉 You now have a fresh start for campaigns!\n');
}

deleteAllCampaigns();
