import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const stanUserId = '6a927440-ebe1-49b4-ae5e-fbee5d27944d';
const stanWorkspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

console.log('🔍 Finding Your Prospects\n');
console.log('═'.repeat(70));

// Get all sessions
const { data: sessions, error: sessionsError } = await supabase
  .from('prospect_approval_sessions')
  .select('*')
  .eq('user_id', stanUserId)
  .eq('workspace_id', stanWorkspaceId)
  .order('created_at', { ascending: false })
  .limit(10);

if (sessionsError) {
  console.log('❌ Error:', sessionsError.message);
  process.exit(1);
}

console.log(`\n📊 Found ${sessions?.length || 0} recent sessions:\n`);

for (const session of sessions || []) {
  // Count prospects in each session by approval_status
  const { data: statusCounts, error: countError } = await supabase
    .from('prospect_approval_data')
    .select('approval_status')
    .eq('session_id', session.id);

  const pending = statusCounts?.filter(p => p.approval_status === 'pending').length || 0;
  const approved = statusCounts?.filter(p => p.approval_status === 'approved').length || 0;
  const rejected = statusCounts?.filter(p => p.approval_status === 'rejected').length || 0;
  const total = statusCounts?.length || 0;

  const age = Math.round((Date.now() - new Date(session.created_at).getTime()) / (1000 * 60));

  console.log(`Session ID: ${session.id}`);
  console.log(`  Campaign Name (campaign_name field): "${session.campaign_name}"`);
  console.log(`  ID: ${session.id}`);
  console.log(`  Total: ${total} prospects`);
  console.log(`  Status: ${pending} pending, ${approved} approved, ${rejected} rejected`);
  console.log(`  Age: ${age} minutes ago`);
  console.log(`  Status: ${session.status}`);
  console.log('');
}

console.log('═'.repeat(70));
console.log('\n💡 TO VIEW YOUR PROSPECTS:\n');
console.log('Go to: Data Approval tab');
console.log('Or navigate to: /workspace/' + stanWorkspaceId + '/data-approval');
console.log('');
console.log('📋 Direct link to most recent session:');
if (sessions && sessions.length > 0) {
  console.log(`/workspace/${stanWorkspaceId}/data-approval?session=${sessions[0].id}`);
}
console.log('');
