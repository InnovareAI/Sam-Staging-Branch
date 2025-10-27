#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCampaignsSchema() {
  console.log('🔍 Checking campaigns table schema...\n');

  // Try to get a sample campaign to see the structure
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('Sample campaign structure:');
  console.log(JSON.stringify(campaign, null, 2));

  // Check if 'type' or 'campaign_type' exists
  console.log('\n📋 Field check:');
  console.log(`  Has 'type': ${campaign.hasOwnProperty('type')}`);
  console.log(`  Has 'campaign_type': ${campaign.hasOwnProperty('campaign_type')}`);
}

checkCampaignsSchema().catch(console.error);
