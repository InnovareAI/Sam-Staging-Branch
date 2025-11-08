const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function showBatches() {
  const wsId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  const { data: pending } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('workspace_id', wsId)
    .eq('approval_status', 'pending')
    .order('created_at', { ascending: false});

  const sessions = {};
  pending.forEach(p => {
    const sid = p.session_id ||'no-session';
    if (!sessions[sid]) sessions[sid] = [];
    sessions[sid].push(p);
  });

  // Show 17 and 19 prospect batches
  const targets = ['0d0ddfff-e00e-4984-9784-2b8fd2a2c7c1', '5c86a789-a926-4d79-8120-cc3e76939d75'];

  targets.forEach(sid => {
    const prospects = sessions[sid];
    if (!prospects) return;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`SESSION: ${sid}`);
    console.log(`COUNT: ${prospects.length} prospects`);
    console.log(`CREATED: ${new Date(prospects[0].created_at).toLocaleString()}`);
    console.log(`${'='.repeat(60)}\n`);

    prospects.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}`);
      console.log(`   Title: ${p.title || 'No title'}`);
      console.log(`   Company: ${p.company?.name || 'Unknown'}`);
      console.log(`   LinkedIn: ${p.contact?.linkedin_url || 'No URL'}`);
      console.log('');
    });
  });

  console.log('\n' + '='.repeat(60));
  console.log('ALL SESSIONS SUMMARY:');
  console.log('='.repeat(60));
  Object.entries(sessions).sort((a,b) => b[1].length - a[1].length).forEach(([sid, prospects]) => {
    console.log(`${prospects.length} prospects - Created ${new Date(prospects[0].created_at).toLocaleDateString()} - Session: ${sid.substring(0, 8)}`);
  });
}

showBatches().catch(console.error);
