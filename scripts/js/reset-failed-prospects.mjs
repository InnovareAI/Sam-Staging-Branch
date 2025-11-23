#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetFailedProspects() {
  try {
    console.log('🔍 Finding BLL-CISO campaign...');

    // Find the campaign
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, workspace_id, status')
      .ilike('name', '%BLL-CISO%');

    if (campaignError) {
      console.error('❌ Error finding campaign:', campaignError);
      return;
    }

    if (!campaigns || campaigns.length === 0) {
      console.error('❌ No BLL-CISO campaign found');
      return;
    }

    const campaign = campaigns[0];
    console.log('✅ Found campaign:', campaign.name);
    console.log('   Campaign ID:', campaign.id);
    console.log('   Workspace ID:', campaign.workspace_id);
    console.log('   Status:', campaign.status);

    // Count failed prospects
    const { data: failedProspects, error: countError } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, status')
      .eq('campaign_id', campaign.id)
      .eq('status', 'failed');

    if (countError) {
      console.error('❌ Error counting failed prospects:', countError);
      return;
    }

    console.log(`\n📊 Found ${failedProspects?.length || 0} failed prospects`);

    if (!failedProspects || failedProspects.length === 0) {
      console.log('✅ No failed prospects to reset');
      return;
    }

    // Reset all failed prospects to pending
    console.log('\n🔄 Resetting failed prospects to pending...');

    const { data: updated, error: updateError } = await supabase
      .from('campaign_prospects')
      .update({
        status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('campaign_id', campaign.id)
      .eq('status', 'failed')
      .select();

    if (updateError) {
      console.error('❌ Error updating prospects:', updateError);
      return;
    }

    console.log(`✅ Successfully reset ${updated?.length || 0} prospects to pending status`);

    // Show summary
    console.log('\n📋 Reset prospects:');
    failedProspects.slice(0, 10).forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.first_name} ${p.last_name}`);
    });
    if (failedProspects.length > 10) {
      console.log(`   ... and ${failedProspects.length - 10} more`);
    }

    console.log('\n✅ Campaign is ready to be restarted!');
    console.log('💡 Next step: Resume the campaign in the UI or change status to "active"');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

resetFailedProspects();
