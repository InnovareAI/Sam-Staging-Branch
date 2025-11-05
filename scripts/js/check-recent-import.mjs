import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const stanUserId = '6a927440-ebe1-49b4-ae5e-fbee5d27944d';
const stanWorkspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

console.log('🔍 Checking most recent LinkedIn import for Stan\n');

// Get most recent session
console.log('1️⃣ Finding most recent import session...\n');
const { data: sessions, error: sessionError } = await supabase
  .from('prospect_approval_sessions')
  .select('*')
  .eq('user_id', stanUserId)
  .eq('workspace_id', stanWorkspaceId)
  .order('created_at', { ascending: false })
  .limit(5);

if (sessionError) {
  console.log('❌ Error:', sessionError.message);
  process.exit(1);
}

if (!sessions || sessions.length === 0) {
  console.log('❌ No sessions found for Stan');
  process.exit(1);
}

console.log(`✅ Found ${sessions.length} recent sessions:\n`);
sessions.forEach((session, i) => {
  console.log(`Session ${i + 1}:`);
  console.log(`  ID: ${session.id}`);
  console.log(`  Campaign: ${session.campaign_name}`);
  console.log(`  Total prospects: ${session.total_prospects}`);
  console.log(`  Status: ${session.status}`);
  console.log(`  Created: ${session.created_at}`);
  console.log('');
});

const mostRecentSession = sessions[0];
console.log(`\n2️⃣ Checking prospects in session: ${mostRecentSession.campaign_name}\n`);

// Count prospects in this session
const { data: prospects, error: prospectError } = await supabase
  .from('prospect_approval_data')
  .select('id, first_name, last_name, current_position, company_name')
  .eq('session_id', mostRecentSession.id);

if (prospectError) {
  console.log('❌ Error:', prospectError.message);
} else {
  console.log(`✅ Found ${prospects?.length || 0} prospects saved in database`);

  if (prospects && prospects.length > 0) {
    console.log('\nFirst 10 prospects:');
    prospects.slice(0, 10).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.first_name} ${p.last_name} - ${p.current_position} at ${p.company_name}`);
    });

    if (prospects.length > 10) {
      console.log(`  ... and ${prospects.length - 10} more`);
    }
  }
}

// Check session totals
console.log('\n\n3️⃣ Session Summary:\n');
console.log(`  Session total_prospects: ${mostRecentSession.total_prospects}`);
console.log(`  Actual prospects in DB: ${prospects?.length || 0}`);
console.log(`  Match: ${mostRecentSession.total_prospects === (prospects?.length || 0) ? '✅ YES' : '❌ NO'}`);

if (mostRecentSession.total_prospects < 358 && mostRecentSession.total_prospects <= 50) {
  console.log('\n⚠️  Only 50 prospects were saved!');
  console.log('   This suggests pagination stopped after first batch.');
  console.log('   Check server logs for cursor information.');
} else if (prospects && prospects.length > 50) {
  console.log(`\n✅ Pagination worked! Got ${prospects.length} prospects.`);
}

console.log('\n✅ Check complete!');
