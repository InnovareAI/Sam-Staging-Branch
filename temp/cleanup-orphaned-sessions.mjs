import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🧹 CLEANING UP ORPHANED APPROVAL SESSIONS\n');

// Get all sessions that are orphaned (no prospects linked via approval_session_id)
// Since campaign_prospects doesn't have approval_session_id column, ALL sessions are orphaned
const { data: orphanedSessions } = await supabase
  .from('prospect_approval_sessions')
  .select('id, campaign_id, workspace_id, status, total_prospects, created_at')
  .in('status', ['active', 'pending'])
  .order('created_at', { ascending: false });

console.log(`Found ${orphanedSessions?.length || 0} orphaned sessions to delete\n`);

for (const session of orphanedSessions || []) {
  console.log(`  Session ${session.id.substring(0, 8)}: ${session.total_prospects} prospects (${session.status}) - ${new Date(session.created_at).toLocaleDateString()}`);
}

console.log('\n🔧 Deleting orphaned sessions...\n');

// Delete them
const { error, count } = await supabase
  .from('prospect_approval_sessions')
  .delete()
  .in('status', ['active', 'pending']);

if (error) {
  console.error('❌ Error deleting sessions:', error.message);
} else {
  console.log(`✅ Deleted ${count || orphanedSessions?.length} orphaned sessions`);
}

// Verify cleanup
const { count: remainingCount } = await supabase
  .from('prospect_approval_sessions')
  .select('*', { count: 'exact', head: true })
  .in('status', ['active', 'pending']);

console.log(`\n📊 Remaining active/pending sessions: ${remainingCount || 0}`);
console.log('\n');
