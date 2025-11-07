require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupBrokenSessions() {
  console.log('🧹 CLEANING UP BROKEN SESSIONS\n');
  console.log('='.repeat(70));

  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  // Find all sessions
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('id, campaign_name, total_prospects, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  console.log(`\nFound ${sessions.length} total sessions\n`);

  const brokenSessions = [];

  // Check each session for missing prospects
  for (const session of sessions) {
    const { count } = await supabase
      .from('prospect_approval_data')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);

    if ((count || 0) === 0 && session.total_prospects > 0) {
      brokenSessions.push(session);
    }
  }

  if (brokenSessions.length === 0) {
    console.log('✅ No broken sessions found!\n');
    console.log('='.repeat(70));
    return;
  }

  console.log(`\n❌ Found ${brokenSessions.length} broken sessions:\n`);
  brokenSessions.forEach((s, i) => {
    console.log(`${i + 1}. ${s.campaign_name}`);
    console.log(`   ID: ${s.id}`);
    console.log(`   Expected ${s.total_prospects} prospects but has 0`);
    console.log(`   Created: ${new Date(s.created_at).toLocaleString()}`);
    console.log('');
  });

  console.log('\n🗑️  Deleting broken sessions...\n');

  for (const session of brokenSessions) {
    // Delete any decisions for this session (cleanup)
    const { error: decisionsError } = await supabase
      .from('prospect_approval_decisions')
      .delete()
      .eq('session_id', session.id);

    if (decisionsError) {
      console.log(`  ⚠️  Could not delete decisions for ${session.campaign_name}: ${decisionsError.message}`);
    }

    // Delete the session
    const { error: sessionError } = await supabase
      .from('prospect_approval_sessions')
      .delete()
      .eq('id', session.id);

    if (sessionError) {
      console.log(`  ❌ Failed to delete session ${session.campaign_name}: ${sessionError.message}`);
    } else {
      console.log(`  ✅ Deleted: ${session.campaign_name}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ CLEANUP COMPLETE!\n');
  console.log('Broken sessions have been removed from the database.');
  console.log('Users should no longer see "data not found" errors for these sessions.\n');
}

cleanupBrokenSessions().catch(console.error);
