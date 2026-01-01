import { createClient } from '@supabase/supabase-js';

async function testAPI() {
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  console.log('\n🔍 Testing Sessions List API Logic\n');

  // 1. Check what sessions exist
  console.log('1️⃣ Direct database query for sessions:');
  const { data: allSessions, error: allError } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (allError) {
    console.error('❌ Error:', allError);
  } else {
    console.log(`✅ Found ${allSessions?.length || 0} sessions in workspace`);
    allSessions?.forEach((s, i) => {
      console.log(`   ${i+1}. ${s.id.slice(0, 20)}... - status: ${s.status} - ${s.total_prospects} prospects - batch: ${s.batch_number}`);
    });
  }

  // 2. Check prospects for the active session
  if (allSessions && allSessions.length > 0) {
    const activeSession = allSessions.find(s => s.status === 'active');
    if (activeSession) {
      console.log(`\n2️⃣ Checking prospects for active session ${activeSession.id.slice(0, 20)}...`);

      const { data: prospects, error: prospectsError } = await supabase
        .from('prospect_approval_data')
        .select('*')
        .eq('session_id', activeSession.id);

      if (prospectsError) {
        console.error('❌ Error:', prospectsError);
      } else {
        console.log(`✅ Found ${prospects?.length || 0} prospects in approval data`);
        if (prospects && prospects.length > 0) {
          console.log('\n   First 3 prospects:');
          prospects.slice(0, 3).forEach((p, i) => {
            console.log(`   ${i+1}. ${p.name} - ${p.title} at ${p.company?.name || 'unknown'}`);
          });
        }
      }
    } else {
      console.log('\n⚠️  No active sessions found (all have status: completed)');
    }
  }

  console.log('\n✅ Test complete\n');
}

testAPI();
