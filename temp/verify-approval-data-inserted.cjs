const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  const wsId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  const sessionId = '0ac9d110-4da6-4f2d-83e2-1b696b8e5829';

  console.log('Checking if data was inserted...\n');

  // Check session
  const { data: session } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (session) {
    console.log('✅ Session exists:');
    console.log(`   Campaign: ${session.campaign_name}`);
    console.log(`   Status: ${session.status}`);
    console.log(`   Total prospects: ${session.total_prospects}`);
    console.log(`   Pending: ${session.pending_count}\n`);
  } else {
    console.log('❌ Session not found\n');
  }

  // Check prospects in this session
  const { data: prospects, error } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', sessionId);

  if (error) {
    console.log(`❌ Error: ${error.message}\n`);
  } else {
    console.log(`✅ Found ${prospects?.length || 0} prospects in this session\n`);

    if (prospects && prospects.length > 0) {
      console.log('First 5 prospects:');
      prospects.slice(0, 5).forEach((p, idx) => {
        console.log(`${idx + 1}. ${p.name} - ${p.approval_status}`);
        console.log(`   Company: ${p.company?.name || 'N/A'}`);
        console.log(`   LinkedIn: ${p.contact?.linkedin_url ? 'Yes' : 'No'}`);
      });
    }
  }

  // Check ALL sessions for this workspace
  console.log('\n\nAll sessions in workspace:');
  const { data: allSessions } = await supabase
    .from('prospect_approval_sessions')
    .select('id, campaign_name, status, total_prospects, pending_count, created_at')
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: false })
    .limit(5);

  allSessions?.forEach((s, idx) => {
    console.log(`\n${idx + 1}. ${s.campaign_name || 'Unnamed'}`);
    console.log(`   ID: ${s.id}`);
    console.log(`   Status: ${s.status}`);
    console.log(`   Total: ${s.total_prospects}, Pending: ${s.pending_count}`);
    console.log(`   Created: ${new Date(s.created_at).toLocaleString()}`);
  });
}

verify().catch(console.error);
