#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function checkSessionsWithData() {
  console.log('=== WHICH SESSIONS HAVE PROSPECT DATA? ===\n');

  // Get all sessions
  const { data: allSessions } = await supabase
    .from('prospect_approval_sessions')
    .select('id, campaign_name, total_prospects, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`Found ${allSessions?.length || 0} total sessions\n`);

  for (const session of allSessions || []) {
    // Count actual data for this session
    const { count: actualCount } = await supabase
      .from('prospect_approval_data')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);

    const match = actualCount === session.total_prospects ? '✅' : '❌';
    const age = Math.floor((Date.now() - new Date(session.created_at).getTime()) / 1000 / 60 / 60);

    console.log(`${match} [${session.id.substring(0, 8)}] ${session.campaign_name || 'Untitled'}`);
    console.log(`   Claims: ${session.total_prospects} | Actual: ${actualCount || 0} | Age: ${age}h`);

    if (actualCount === 0 && session.total_prospects > 0) {
      console.log(`   ⚠️  PHANTOM SESSION: Says ${session.total_prospects} but has 0 data!`);
    }
    console.log('');
  }

  // Show which have data
  const { data: prospectsWithSessions } = await supabase
    .from('prospect_approval_data')
    .select('session_id')
    .limit(1000);

  const sessionsWithData = new Set(prospectsWithSessions?.map(p => p.session_id));
  console.log(`\n📊 ${sessionsWithData.size} sessions have actual prospect data`);
  console.log('Session IDs with data:');
  sessionsWithData.forEach(id => {
    const session = allSessions?.find(s => s.id === id);
    console.log(`   ${id.substring(0, 8)} - ${session?.campaign_name || 'Unknown'}`);
  });
}

checkSessionsWithData().catch(console.error);
