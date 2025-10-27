#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLatestCampaign() {
  console.log('🔍 Checking latest campaign created...\n');

  // Get the most recent campaign for user tl@innovareai.com
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, created_at, workspace_id')
    .order('created_at', { ascending: false })
    .limit(3);

  if (!campaigns || campaigns.length === 0) {
    console.log('❌ No campaigns found');
    return;
  }

  console.log(`Found ${campaigns.length} recent campaign(s):\n`);

  for (const campaign of campaigns) {
    console.log(`Campaign: "${campaign.name}"`);
    console.log(`  ID: ${campaign.id}`);
    console.log(`  Created: ${campaign.created_at}\n`);

    // Get prospects for this campaign
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaign.id);

    console.log(`  Prospects (${prospects?.length || 0}):`);

    if (prospects && prospects.length > 0) {
      prospects.forEach((p, i) => {
        console.log(`\n  ${i + 1}. Prospect ${p.id}:`);
        console.log(`     Name: ${p.first_name || '(EMPTY)'} ${p.last_name || '(EMPTY)'}`);
        console.log(`     Company: ${p.company_name || '(EMPTY)'}`);
        console.log(`     Title: ${p.title || '(EMPTY)'}`);
        console.log(`     LinkedIn URL: ${p.linkedin_url || '❌ MISSING'}`);
        console.log(`     LinkedIn ID: ${p.linkedin_user_id || '(none)'}`);
        console.log(`     Email: ${p.email || '(none)'}`);
        console.log(`     Status: ${p.status}`);
      });

      // Check if we have the data we need
      const hasNames = prospects.every(p => p.first_name && p.last_name);
      const hasLinkedInUrls = prospects.every(p => p.linkedin_url);

      console.log('\n  ✨ Data Quality Check:');
      console.log(`     Names: ${hasNames ? '✅ All prospects have names' : '❌ Missing names'}`);
      console.log(`     LinkedIn URLs: ${hasLinkedInUrls ? '✅ All prospects have LinkedIn URLs' : '❌ Missing LinkedIn URLs'}`);

      if (hasNames && hasLinkedInUrls) {
        console.log('\n  🎉 SUCCESS! The upload-prospects fix is working!');
        console.log('     Ready to test campaign execution.');
      } else {
        console.log('\n  ⚠️  PROBLEM! Data is still missing after our fixes.');
        console.log('     Need to investigate front-end payload.');
      }
    } else {
      console.log('     ❌ No prospects found for this campaign!');
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }
}

checkLatestCampaign().catch(console.error);
