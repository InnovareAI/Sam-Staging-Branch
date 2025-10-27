#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function fixCampaignProspectsData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('🔧 Fixing campaign prospects data...\n');

  // Fix Michael Haeri
  const { error: error1 } = await supabase
    .from('campaign_prospects')
    .update({
      first_name: 'Michael',
      last_name: 'Haeri',
      title: 'CEO',
      company_name: 'Growth Cleaning',
      personalization_data: {
        source: 'approved_prospects',
        campaign_name: '20251027-IAI-Outreach Campaign',
        campaign_tag: 'startup',
        connection_degree: null
      }
    })
    .eq('linkedin_url', 'https://www.linkedin.com/in/michaelhaeri')
    .eq('campaign_id', 'ac81022c-48f4-4f06-87be-1467175f5b61');

  if (error1) {
    console.error('❌ Error updating Michael Haeri:', error1);
  } else {
    console.log('✅ Updated Michael Haeri');
  }

  // Fix Rique Ford
  const { error: error2 } = await supabase
    .from('campaign_prospects')
    .update({
      first_name: 'Rique',
      last_name: 'Ford',
      title: 'Managing Director, Member',
      company_name: 'Maritime Development Group, Ltd',
      personalization_data: {
        source: 'approved_prospects',
        campaign_name: '20251027-IAI-Outreach Campaign',
        campaign_tag: 'startup',
        connection_degree: null
      }
    })
    .eq('linkedin_url', 'https://www.linkedin.com/in/riqueford')
    .eq('campaign_id', 'ac81022c-48f4-4f06-87be-1467175f5b61');

  if (error2) {
    console.error('❌ Error updating Rique Ford:', error2);
  } else {
    console.log('✅ Updated Rique Ford');
  }

  // Verify the updates
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', 'ac81022c-48f4-4f06-87be-1467175f5b61');

  console.log('\n📊 Verified Campaign Prospects:\n');
  prospects.forEach((p, i) => {
    console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
    console.log(`   Title: ${p.title}`);
    console.log(`   Company: ${p.company_name}`);
    console.log(`   LinkedIn: ${p.linkedin_url}`);
    console.log(`   Campaign Name (in data): ${p.personalization_data?.campaign_name || 'MISSING'}`);
    console.log('');
  });

  console.log('✅ Campaign prospects fixed! You can now try executing the campaign again.');
}

fixCampaignProspectsData().catch(console.error);
