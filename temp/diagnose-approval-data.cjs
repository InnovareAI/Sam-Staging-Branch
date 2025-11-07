require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseApprovalData() {
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08'; // Stan's workspace

  console.log('🔍 DIAGNOSING APPROVAL SYSTEM DATA\n');
  console.log('='.repeat(70));

  // Check approval sessions
  console.log('\n📋 APPROVAL SESSIONS:');
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (sessions && sessions.length > 0) {
    console.log(`Found ${sessions.length} sessions:\n`);
    sessions.forEach((s, i) => {
      console.log(`${i + 1}. Session ID: ${s.id}`);
      console.log(`   Campaign: ${s.campaign_name}`);
      console.log(`   Status: ${s.status}`);
      console.log(`   Total: ${s.total_prospects}, Pending: ${s.pending_count}, Approved: ${s.approved_count}`);
      console.log(`   Created: ${new Date(s.created_at).toLocaleString()}`);
      console.log('');
    });
  } else {
    console.log('❌ No sessions found\n');
  }

  // Check approval data (prospects)
  console.log('👥 APPROVAL DATA (Prospects):');
  const { data: prospects, count } = await supabase
    .from('prospect_approval_data')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`Total prospects: ${count || 0}\n`);

  if (prospects && prospects.length > 0) {
    console.log(`Showing latest ${prospects.length} prospects:\n`);
    prospects.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}`);
      console.log(`   Prospect ID: ${p.prospect_id}`);
      console.log(`   Session ID: ${p.session_id}`);
      console.log(`   Status: ${p.approval_status}`);
      console.log(`   Company: ${typeof p.company === 'object' ? p.company.name : p.company}`);
      console.log(`   Contact: ${JSON.stringify(p.contact)}`);
      console.log(`   Created: ${new Date(p.created_at).toLocaleString()}`);
      console.log('');
    });
  } else {
    console.log('❌ No prospect data found\n');
  }

  // Check approval decisions
  console.log('✅ APPROVAL DECISIONS:');
  const { data: decisions } = await supabase
    .from('prospect_approval_decisions')
    .select('*')
    .order('decided_at', { ascending: false })
    .limit(10);

  if (decisions && decisions.length > 0) {
    console.log(`Found ${decisions.length} decisions:\n`);
    decisions.forEach((d, i) => {
      console.log(`${i + 1}. Prospect ID: ${d.prospect_id}`);
      console.log(`   Decision: ${d.decision}`);
      console.log(`   Session ID: ${d.session_id}`);
      console.log(`   Decided: ${new Date(d.decided_at).toLocaleString()}`);
      console.log('');
    });
  } else {
    console.log('No decisions recorded yet\n');
  }

  // Check if there's data mismatch
  if (sessions && sessions.length > 0 && (!prospects || prospects.length === 0)) {
    console.log('\n⚠️  WARNING: Sessions exist but no prospect data found!');
    console.log('This explains why users get "data not found" errors.\n');

    console.log('Latest session details:');
    const latest = sessions[0];
    console.log(`  Session ID: ${latest.id}`);
    console.log(`  Campaign: ${latest.campaign_name}`);
    console.log(`  Expected ${latest.total_prospects} prospects but found 0 in prospect_approval_data\n`);
  }

  console.log('='.repeat(70));
}

diagnoseApprovalData().catch(console.error);
