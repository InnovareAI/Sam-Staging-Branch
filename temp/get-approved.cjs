const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function show() {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('name', '20251106-BLL-CISO Outreach - Mid Market')
    .single();

  const { data } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaign.id);

  console.log('TOTAL:', data.length);
  console.log('');

  const approved = data.filter(p => p.status === 'approved');
  console.log('APPROVED:', approved.length);
  console.log('');

  approved.forEach((p, idx) => {
    const num = idx + 1;
    console.log(num + '. ' + p.first_name + ' ' + p.last_name + ' - ' + (p.title || 'No title') + ' at ' + (p.company || 'No company'));
  });

  console.log('');
  console.log('STATUS BREAKDOWN:');
  const counts = {};
  data.forEach(p => counts[p.status] = (counts[p.status] || 0) + 1);
  Object.entries(counts).forEach(([s, c]) => console.log('  ' + s + ': ' + c));
}

show().catch(console.error);
