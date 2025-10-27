#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRecentExecution() {
  console.log('🔍 Checking most recent campaign execution...\n');

  // Get the campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('name', '20251027-IAI-Outreach Campaign')
    .single();

  if (!campaign) {
    console.log('❌ Campaign not found');
    return;
  }

  // Get prospects ordered by most recent update
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaign.id)
    .order('updated_at', { ascending: false })
    .limit(3);

  console.log(`📋 Most recent prospect updates:\n`);

  prospects?.forEach((p, i) => {
    const name = `${p.first_name || '(no name)'} ${p.last_name || ''}`.trim();
    console.log(`${i + 1}. ${name || '(no name)'}`);
    console.log(`   LinkedIn: ${p.linkedin_url}`);
    console.log(`   Status: ${p.status}`);
    console.log(`   Updated: ${p.updated_at}`);
    console.log(`   Contacted: ${p.contacted_at || '(never)'}`);

    // Check for any error or status info in personalization_data
    if (p.personalization_data) {
      const data = p.personalization_data;

      if (data.error || data.error_message || data.status_message) {
        console.log(`   ⚠️  ERROR INFO IN DATABASE:`);
        if (data.error) console.log(`      Error: ${data.error}`);
        if (data.error_message) console.log(`      Message: ${data.error_message}`);
        if (data.status_message) console.log(`      Status: ${data.status_message}`);
      }

      if (data.unipile_response) {
        console.log(`   📝 Unipile response captured:`, JSON.stringify(data.unipile_response, null, 2));
      }

      // Show full data if it has any content
      const keys = Object.keys(data);
      if (keys.length > 0) {
        console.log(`   📦 Full personalization_data:`, JSON.stringify(data, null, 2));
      }
    }

    console.log('');
  });
}

checkRecentExecution().catch(console.error);
