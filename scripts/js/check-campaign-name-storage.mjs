#!/usr/bin/env node
/**
 * Check if campaign_name is being stored in campaign_prospects
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🔍 Checking campaign_name storage in campaign_prospects\n');

  // Find Miklos in campaign_prospects
  const { data, error } = await supabase
    .from('campaign_prospects')
    .select('first_name, last_name, company_name, personalization_data')
    .ilike('linkedin_url', '%miklos-szegedi%')
    .limit(1);

  if (error) {
    console.error('❌ Query error:', error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('❌ Miklos not found in campaign_prospects');
    process.exit(1);
  }

  const prospect = data[0];

  console.log('✅ Found in campaign_prospects:');
  console.log(`   Name: ${prospect.first_name} ${prospect.last_name}`);
  console.log(`   Company: ${prospect.company_name}`);
  console.log('\n📊 Full personalization_data:');
  console.log(JSON.stringify(prospect.personalization_data, null, 2));

  console.log('\n🔍 Campaign name in personalization_data:');
  const campaignName = prospect.personalization_data?.campaign_name;
  if (campaignName) {
    console.log(`   ✅ campaign_name: "${campaignName}"`);
  } else {
    console.log('   ❌ campaign_name: MISSING');
  }
}

main().catch(console.error);
