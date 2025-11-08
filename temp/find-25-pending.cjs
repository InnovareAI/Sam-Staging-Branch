const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function find25() {
  const wsId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  // Get all pending prospects
  const { data: pending } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('workspace_id', wsId)
    .eq('approval_status', 'pending')
    .order('created_at', { ascending: false });

  console.log(`Total pending prospects: ${pending?.length || 0}\n`);

  if (!pending || pending.length === 0) {
    console.log('No pending prospects found.');
    return;
  }

  // Group by session_id
  const sessions = {};
  pending.forEach(p => {
    const sid = p.session_id || 'no-session';
    if (!sessions[sid]) sessions[sid] = [];
    sessions[sid].push(p);
  });

  console.log(`Grouped into ${Object.keys(sessions).length} sessions:\n`);

  Object.entries(sessions).forEach(([sid, prospects]) => {
    console.log(`Session: ${sid}`);
    console.log(`  Count: ${prospects.length}`);
    console.log(`  Created: ${new Date(prospects[0].created_at).toLocaleString()}`);

    if (prospects.length >= 20 && prospects.length <= 30) {
      console.log(`  🎯 MATCH - This has ${prospects.length} pending prospects!\n`);

      console.log('  Prospects:');
      prospects.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.name} - ${p.title || 'No title'} at ${p.company?.name || 'Unknown'}`);
        console.log(`     LinkedIn: ${p.contact?.linkedin_url || 'No URL'}`);
      });

      console.log(`\n  Session ID: ${sid}`);
      console.log(`  To add these to workspace_prospects, run the migration script.`);
    } else {
      console.log('');
    }
  });
}

find25().catch(console.error);
