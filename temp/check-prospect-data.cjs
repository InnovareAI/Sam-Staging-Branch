#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProspectData() {
  // Get most recent campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  console.log(`Checking prospects for: ${campaign.name}\n`);

  // Get prospects with full data
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaign.id);

  console.log(`Total prospects: ${prospects?.length}\n`);

  prospects?.forEach((p, i) => {
    console.log(`Prospect ${i + 1}:`);
    console.log(`  ID: ${p.id}`);
    console.log(`  Name: ${p.first_name || '(none)'} ${p.last_name || '(none)'}`);
    console.log(`  Company: ${p.company_name || '(none)'}`);
    console.log(`  LinkedIn URL: ${p.linkedin_url || 'MISSING'}`);
    console.log(`  LinkedIn User ID: ${p.linkedin_user_id || 'MISSING'}`);
    console.log(`  Status: ${p.status}`);
    console.log(`  Email: ${p.email || '(none)'}`);
    console.log(`  Personalization data:`, p.personalization_data ? JSON.stringify(p.personalization_data, null, 2) : '(none)');
    console.log('');
  });
}

checkProspectData().catch(console.error);
