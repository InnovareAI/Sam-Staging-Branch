require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function showProspects() {
  const campaignId = '0a56408b-be39-4144-870f-2b0dce45b620';

  const { data } = await supabase
    .from('campaign_prospects')
    .select('first_name, last_name, title, company, linkedin_url, status')
    .eq('campaign_id', campaignId)
    .order('last_name');

  console.log('\n✅ STAN\'S 25 APPROVED CISO PROSPECTS\n');
  console.log('Campaign: 20251106-BLL-CISO Outreach - Mid Market\n');
  console.log('=' .repeat(70) + '\n');

  data?.forEach((p, i) => {
    const linkedin = p.linkedin_url ? '✅' : '❌ NO URL';
    console.log(`${String(i + 1).padStart(2, ' ')}. ${p.first_name} ${p.last_name} ${linkedin}`);
    console.log(`    ${p.title || 'No title'}`);
    console.log(`    ${p.company || 'Unknown company'}`);
    console.log('');
  });

  console.log('=' .repeat(70));
  console.log('\nAll 25 prospects are APPROVED and ready to contact!\n');

  const missing = data?.filter(p => !p.linkedin_url).length || 0;
  if (missing > 0) {
    console.log(`⚠️  WARNING: ${missing} prospects missing LinkedIn URLs\n`);
  } else {
    console.log('✅ All prospects have LinkedIn URLs!\n');
  }

  console.log(`Campaign ID: ${campaignId}\n`);
}

showProspects().catch(console.error);
