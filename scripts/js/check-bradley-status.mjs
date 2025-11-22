import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBradleyStatus() {
  console.log('🔍 Checking Bradley Breton status...\n');

  // Find all campaign_prospects entries for Bradley
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select(`
      id,
      campaign_id,
      first_name,
      last_name,
      linkedin_url,
      status,
      contacted_at,
      notes,
      campaigns(campaign_name)
    `)
    .ilike('linkedin_url', '%bradleybreton%');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`Found ${prospects.length} entries for Bradley Breton:\n`);

  prospects.forEach((p, i) => {
    console.log(`Entry ${i + 1}:`);
    console.log(`  ID: ${p.id}`);
    console.log(`  Campaign: ${p.campaigns?.campaign_name} (${p.campaign_id})`);
    console.log(`  Status: ${p.status}`);
    console.log(`  Contacted: ${p.contacted_at || 'Never'}`);
    console.log(`  Notes: ${p.notes || 'None'}`);
    console.log(`  LinkedIn: ${p.linkedin_url}`);
    console.log('');
  });

  // Check if there are duplicates
  const campaignIds = [...new Set(prospects.map(p => p.campaign_id))];
  console.log(`\n📊 Summary:`);
  console.log(`  Total entries: ${prospects.length}`);
  console.log(`  Unique campaigns: ${campaignIds.length}`);
  console.log(`  Duplicate detected: ${prospects.length > 1 ? 'YES ⚠️' : 'NO ✅'}`);
}

checkBradleyStatus().catch(console.error);
