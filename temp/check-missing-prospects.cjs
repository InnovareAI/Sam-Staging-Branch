require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMissingProspects() {
  console.log('🔍 CHECKING FOR MISSING PROSPECT DATA\n');
  console.log('='.repeat(70));

  // Check the two large sessions
  const sessionIds = [
    '51b7df55-6ef0-4f0c-8ad9-73ba1b7ab96c', // 100 prospects expected
    'aa706d01-cfd1-40c9-96b6-61ba8e72b6af'  // 100 prospects expected
  ];

  for (const sessionId of sessionIds) {
    console.log(`\n📋 Session: ${sessionId}`);

    // Get session info
    const { data: session } = await supabase
      .from('prospect_approval_sessions')
      .select('campaign_name, total_prospects, pending_count, approved_count')
      .eq('id', sessionId)
      .single();

    console.log(`   Campaign: ${session.campaign_name}`);
    console.log(`   Expected: ${session.total_prospects} prospects`);

    // Count actual prospects in prospect_approval_data
    const { count } = await supabase
      .from('prospect_approval_data')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    console.log(`   Found: ${count || 0} prospects in prospect_approval_data`);

    if ((count || 0) === 0 && session.total_prospects > 0) {
      console.log(`   ❌ PROBLEM: Session says ${session.total_prospects} prospects but database has 0!`);
      console.log(`   This is why users get "data not found" errors.\n`);
    } else if (count !== session.total_prospects) {
      console.log(`   ⚠️  WARNING: Mismatch! Session says ${session.total_prospects} but found ${count}`);
    } else {
      console.log(`   ✅ Match! Session and database agree.`);
    }
  }

  // Check all sessions for this issue
  console.log('\n\n🔎 CHECKING ALL SESSIONS FOR MISMATCHES:\n');

  const { data: allSessions } = await supabase
    .from('prospect_approval_sessions')
    .select('id, campaign_name, total_prospects')
    .eq('workspace_id', '014509ba-226e-43ee-ba58-ab5f20d2ed08')
    .order('created_at', { ascending: false });

  const mismatches = [];

  for (const session of allSessions) {
    const { count } = await supabase
      .from('prospect_approval_data')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);

    if ((count || 0) !== session.total_prospects) {
      mismatches.push({
        id: session.id,
        campaign: session.campaign_name,
        expected: session.total_prospects,
        found: count || 0,
        missing: session.total_prospects - (count || 0)
      });
    }
  }

  if (mismatches.length > 0) {
    console.log(`Found ${mismatches.length} sessions with missing prospects:\n`);
    mismatches.forEach((m, i) => {
      console.log(`${i + 1}. ${m.campaign}`);
      console.log(`   Session: ${m.id}`);
      console.log(`   Expected: ${m.expected}, Found: ${m.found}, Missing: ${m.missing}`);
      console.log('');
    });
  } else {
    console.log('✅ All sessions have matching prospect counts!\n');
  }

  console.log('='.repeat(70));
  console.log('\n💡 EXPLANATION:');
  console.log('If sessions have 0 prospects in prospect_approval_data,');
  console.log('the approval system cannot approve them because the data');
  console.log('literally does not exist in the database.\n');
  console.log('This happens when the upload endpoint creates a session');
  console.log('but fails to insert the prospect records afterward.\n');
}

checkMissingProspects().catch(console.error);
