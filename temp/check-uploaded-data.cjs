require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkData() {
  console.log('🔍 Checking for recently uploaded data...\n');

  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'; // InnovareAI fallback workspace

  // Check sessions
  const { data: sessions, error: sessionsError } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('📊 Recent Sessions:');
  if (sessions && sessions.length > 0) {
    sessions.forEach(s => {
      console.log(`  - ID: ${s.id.substring(0, 8)}...`);
      console.log(`    Campaign: ${s.campaign_name}`);
      console.log(`    Status: ${s.status}`);
      console.log(`    Total: ${s.total_prospects}`);
      console.log(`    Pending: ${s.pending_count}`);
      console.log(`    Created: ${s.created_at}`);
      console.log(`    Batch: ${s.batch_number}`);
      console.log('');
    });
  } else {
    console.log('  ❌ No sessions found');
  }

  // Check prospects for each session
  if (sessions && sessions.length > 0) {
    console.log('\n📋 Prospects per session:');
    for (const session of sessions) {
      const { count } = await supabase
        .from('prospect_approval_data')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id);

      console.log(`  Session ${session.id.substring(0, 8)}: ${count} prospects`);
    }
  }

  // Check all prospects in workspace
  const { count: totalProspects } = await supabase
    .from('prospect_approval_data')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  console.log(`\n📈 Total prospects in workspace: ${totalProspects}`);
}

checkData().catch(console.error);
