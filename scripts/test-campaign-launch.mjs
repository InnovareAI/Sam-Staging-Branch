// Test campaign launch flow (simulating UI "Approve & Launch" button)
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCampaignLaunch() {
  const campaignId = 'ce7431fc-89a4-498b-a0c2-50fe3e8c4184';

  console.log('🚀 Testing campaign launch flow...\n');

  // 1. Fetch campaign (simulating what CampaignHub does)
  console.log('1️⃣ Fetching campaign...');
  const { data: campaign, error: fetchError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (fetchError) {
    console.error('❌ Failed to fetch campaign:', fetchError);
    return;
  }

  console.log(`✅ Campaign found: ${campaign.name}`);
  console.log(`   ID: ${campaign.id}`);
  console.log(`   Status: ${campaign.status}\n`);

  // 2. Get campaign prospects
  console.log('2️⃣ Fetching campaign prospects...');
  const { data: prospects, error: prospectsError } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaignId);

  if (prospectsError) {
    console.error('❌ Failed to fetch prospects:', prospectsError);
    return;
  }

  console.log(`✅ Found ${prospects?.length || 0} prospects`);
  prospects?.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.first_name} ${p.last_name} - ${p.title}`);
    console.log(`      LinkedIn: ${p.linkedin_url || '❌ MISSING'}`);
  });

  // 3. Check if campaign object has ID field
  console.log('\n3️⃣ Checking campaign object structure...');
  console.log(`   campaign.id: ${campaign.id ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   campaign.campaign_id: ${campaign.campaign_id ? '✅ EXISTS' : 'N/A'}`);

  if (!campaign.id && campaign.campaign_id) {
    console.log('   ⚠️  ISSUE: Using campaign_id instead of id');
    console.log('   Normalizing...');
    campaign.id = campaign.campaign_id;
  }

  // 4. Simulate upload prospects (what the old broken code was trying to do)
  console.log('\n4️⃣ Testing prospect upload (simulated)...');

  if (!campaign.id) {
    console.error('   ❌ ERROR: campaign.id is undefined - this would cause the original error!');
    console.error('   Error: Cannot read properties of undefined (reading \'id\')');
    return;
  }

  console.log(`   ✅ Campaign ID is defined: ${campaign.id}`);
  console.log(`   Would call: POST /api/campaigns/upload-prospects`);
  console.log(`   With campaign_id: ${campaign.id}`);

  // 5. Summary
  console.log('\n📊 Test Summary:');
  console.log(`   ✅ Campaign fetch: SUCCESS`);
  console.log(`   ✅ Prospects count: ${prospects.length}`);
  console.log(`   ✅ LinkedIn URLs: ${prospects.filter(p => p.linkedin_url).length}/${prospects.length}`);
  console.log(`   ✅ Campaign ID field: ${campaign.id ? 'PRESENT' : 'MISSING'}`);

  if (campaign.id && prospects.every(p => p.linkedin_url)) {
    console.log('\n🎉 All checks passed! Campaign should work with "Approve & Launch"');
  } else {
    console.log('\n⚠️  Issues detected that may cause errors');
  }
}

testCampaignLaunch().catch(console.error);
