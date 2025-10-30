#!/usr/bin/env node
/**
 * Delete ALL test campaigns and their prospects
 * This will clean the workspace for a fresh start
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

const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'; // InnovareAI Workspace

async function deleteAllTestCampaigns() {
  console.log('🗑️  DELETING ALL TEST CAMPAIGNS\n');
  console.log('⚠️  WARNING: This will permanently delete all campaigns and their prospects!');
  console.log('=' .repeat(70));

  // Get all campaigns
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('workspace_id', WORKSPACE_ID)
    .order('created_at', { ascending: false });

  if (campaignsError) {
    console.error('❌ Error fetching campaigns:', campaignsError);
    return;
  }

  console.log(`\n📊 Found ${campaigns.length} campaigns to delete\n`);

  let deletedCampaigns = 0;
  let deletedProspects = 0;

  for (const campaign of campaigns) {
    console.log(`\n🗑️  Deleting: ${campaign.name}`);
    console.log(`   ID: ${campaign.id}`);

    // First, delete all prospects for this campaign
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .delete()
      .eq('campaign_id', campaign.id)
      .select();

    if (prospectsError) {
      console.error(`   ❌ Error deleting prospects: ${prospectsError.message}`);
      continue;
    }

    const prospectCount = prospects?.length || 0;
    deletedProspects += prospectCount;
    console.log(`   ✅ Deleted ${prospectCount} prospects`);

    // Then delete the campaign
    const { error: campaignError } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaign.id);

    if (campaignError) {
      console.error(`   ❌ Error deleting campaign: ${campaignError.message}`);
      continue;
    }

    console.log(`   ✅ Campaign deleted`);
    deletedCampaigns++;
  }

  // Summary
  console.log('\n\n' + '='.repeat(70));
  console.log('✅ CLEANUP COMPLETE');
  console.log('='.repeat(70));
  console.log(`\n   Campaigns deleted: ${deletedCampaigns} / ${campaigns.length}`);
  console.log(`   Prospects deleted: ${deletedProspects}`);
  console.log('\n   🎉 Workspace is now clean and ready for fresh campaigns!');
  console.log('\n' + '='.repeat(70));
}

deleteAllTestCampaigns().catch(console.error);
