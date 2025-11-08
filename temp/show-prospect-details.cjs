const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function showDetails() {
  const wsId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('workspace_id', wsId)
    .eq('name', '20251106-BLL-CISO Outreach - Mid Market')
    .single();

  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaign.id)
    .eq('status', 'approved')
    .limit(5);

  console.log('Sample prospect data:\n');

  prospects.forEach((p, i) => {
    console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
    console.log('   Title:', p.title);
    console.log('   Company:', p.company);
    console.log('   LinkedIn:', p.linkedin_url ? 'Yes' : 'No');
    console.log('   Personalization:', JSON.stringify(p.personalization_data, null, 2));
    console.log('');
  });
}

showDetails().catch(console.error);
