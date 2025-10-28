import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get Charissa's campaign
const { data: campaign } = await supabase
  .from('campaigns')
  .select('id, name')
  .eq('name', '20251028-IAI-Startup Campaign')
  .single();

console.log('Campaign:', campaign.name);
console.log('Campaign ID:', campaign.id, '\n');

// Get ALL prospects from this campaign
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, company_name, linkedin_url, status, source_data')
  .eq('campaign_id', campaign.id)
  .limit(20);

console.log('📊 Total prospects:', prospects?.length || 0, '\n');

let missingNames = 0;
let hasNames = 0;

for (const p of prospects || []) {
  const hasBothNames = p.first_name && p.last_name;
  if (hasBothNames) {
    hasNames++;
  } else {
    missingNames++;
  }

  if (!hasBothNames) {
    console.log('❌ Missing name (Prospect ID:', p.id + ')');
    console.log('   First:', p.first_name || '(none)');
    console.log('   Last:', p.last_name || '(none)');
    console.log('   Company:', p.company_name || '(none)');
    console.log('   LinkedIn:', p.linkedin_url ? 'YES' : 'NO');
    console.log('   Status:', p.status);

    // Check if name exists in source_data
    if (p.source_data) {
      console.log('   Source data exists:', typeof p.source_data);
      if (p.source_data.name) {
        console.log('   ⚠️  Name in source_data:', p.source_data.name);
      }
      if (p.source_data.firstName || p.source_data.first_name) {
        console.log('   ⚠️  First name in source_data:', p.source_data.firstName || p.source_data.first_name);
      }
    }
    console.log('');
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Summary:');
console.log('  ✅ With names:', hasNames);
console.log('  ❌ Missing names:', missingNames);
console.log('  Total:', prospects?.length || 0);
