#!/usr/bin/env node

/**
 * Fix Campaign Prospects Status
 * Uses Supabase client to check and update prospect statuses
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CAMPAIGN_NAME = '20251102-IAI-Outreach Campaign';

async function fixCampaignProspects() {
  console.log('🔍 Diagnosing Campaign Prospects');
  console.log('=================================\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Step 1: Find the campaign
    console.log(`📋 Step 1: Finding campaign "${CAMPAIGN_NAME}"...\n`);

    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        status,
        campaign_type,
        created_at
      `)
      .ilike('name', `%${CAMPAIGN_NAME}%`);

    if (campaignError) throw campaignError;

    if (!campaigns || campaigns.length === 0) {
      console.error('❌ Campaign not found');
      process.exit(1);
    }

    const campaign = campaigns[0];
    console.log('✅ Found campaign:');
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Name: ${campaign.name}`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Type: ${campaign.campaign_type || 'N/A'}\n`);

    // Step 2: Check prospect statuses
    console.log('📊 Step 2: Checking prospect statuses...\n');

    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaign.id);

    if (prospectsError) throw prospectsError;

    if (!prospects || prospects.length === 0) {
      console.error('❌ No prospects found in campaign');
      process.exit(1);
    }

    console.log(`✅ Found ${prospects.length} total prospects\n`);

    // Count by status
    const statusCounts = {};
    let readyCount = 0;
    const needsUpdate = [];

    prospects.forEach(p => {
      const status = p.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      if (['pending', 'queued_in_n8n'].includes(status)) {
        readyCount++;
      } else if (!p.contacted_at) {
        needsUpdate.push(p);
      }
    });

    console.log('📈 Status Breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      const icon = ['pending', 'queued_in_n8n'].includes(status) ? '✅' : '⚠️';
      console.log(`   ${icon} ${status}: ${count}`);
    });

    console.log(`\n🎯 Ready for execution: ${readyCount} prospects`);
    console.log(`⚠️  Need status update: ${needsUpdate.length} prospects\n`);

    // Step 3: Show prospects needing update
    if (needsUpdate.length > 0) {
      console.log('📋 Prospects that need status update:');
      console.log('─'.repeat(60));
      needsUpdate.forEach((p, i) => {
        console.log(`\n   ${i + 1}. ${p.first_name} ${p.last_name}`);
        console.log(`      Current Status: ${p.status}`);
        console.log(`      Has LinkedIn: ${p.linkedin_url ? 'Yes' : 'No'}`);
        console.log(`      Has Email: ${p.email ? 'Yes' : 'No'}`);
        console.log(`      Contacted: ${p.contacted_at ? 'Yes' : 'No'}`);
      });

      // Step 4: Ask to fix
      console.log('\n\n🔧 Fix Options:');
      console.log('─'.repeat(60));
      console.log('Run this script with "fix" argument to update statuses:');
      console.log(`   node fix-campaign-prospects.cjs fix\n`);

      // Check if 'fix' argument provided
      if (process.argv.includes('fix')) {
        console.log('🚀 Updating prospect statuses to "pending"...\n');

        for (const prospect of needsUpdate) {
          const { error: updateError } = await supabase
            .from('campaign_prospects')
            .update({ status: 'pending' })
            .eq('id', prospect.id);

          if (updateError) {
            console.error(`   ❌ Failed to update ${prospect.first_name} ${prospect.last_name}:`, updateError.message);
          } else {
            console.log(`   ✅ Updated ${prospect.first_name} ${prospect.last_name} to "pending"`);
          }
        }

        console.log('\n✅ Status update complete!');
        console.log('\n🎯 Next Steps:');
        console.log('   1. Go back to Sam UI');
        console.log('   2. Click "Activate" on the campaign again');
        console.log('   3. Prospects should now be processed\n');
      }
    } else {
      console.log('✅ All prospects are ready for execution!');
      console.log('\n🤔 If campaign still shows "No pending prospects":');
      console.log('   1. Check campaign status is "active"');
      console.log('   2. Verify LinkedIn URLs or emails are present');
      console.log('   3. Check rate limits haven\'t been exceeded\n');
    }

    // Step 5: Show summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log('='.repeat(60));
    console.log(`Campaign: ${campaign.name}`);
    console.log(`Total Prospects: ${prospects.length}`);
    console.log(`Ready for Execution: ${readyCount}`);
    console.log(`Need Update: ${needsUpdate.length}`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.details) console.error('   Details:', error.details);
    if (error.hint) console.error('   Hint:', error.hint);
    process.exit(1);
  }
}

// Run the script
fixCampaignProspects().catch(console.error);
