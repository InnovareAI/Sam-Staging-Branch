import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyApprovalData() {
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  console.log('\n🔍 TRACING DATA FLOW FOR APPROVAL SYSTEM\n');
  console.log('=' .repeat(60));

  // Step 1: Verify user exists and has workspace
  console.log('\n📌 STEP 1: User & Workspace');
  const { data: user } = await supabase
    .from('users')
    .select('id, email, current_workspace_id')
    .eq('id', userId)
    .single();
  console.log('   User:', user?.email);
  console.log('   Current Workspace:', user?.current_workspace_id);
  console.log('   Match:', user?.current_workspace_id === workspaceId ? '✅' : '❌');

  // Step 2: Check approval sessions
  console.log('\n📌 STEP 2: Approval Sessions');
  const { data: sessions, error: sessionsError } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (sessionsError) {
    console.log('   ❌ Error:', sessionsError.message);
    return;
  }

  console.log(`   Total Sessions: ${sessions?.length || 0}`);
  sessions?.forEach((s, i) => {
    console.log(`   Session ${i + 1}:`);
    console.log(`      ID: ${s.id.slice(0, 30)}...`);
    console.log(`      Status: ${s.status}`);
    console.log(`      Total Prospects: ${s.total_prospects}`);
    console.log(`      Pending: ${s.pending_count}`);
    console.log(`      Created: ${s.created_at}`);
  });

  // Step 3: Check prospect data for each session
  console.log('\n📌 STEP 3: Prospect Data');
  let totalProspects = 0;

  for (const session of sessions || []) {
    const { data: prospects, error: prospectsError } = await supabase
      .from('prospect_approval_data')
      .select('*')
      .eq('session_id', session.id);

    if (prospectsError) {
      console.log(`   ❌ Error loading session ${session.id.slice(0, 8)}: ${prospectsError.message}`);
      continue;
    }

    totalProspects += prospects?.length || 0;
    console.log(`   Session ${session.id.slice(0, 8)}: ${prospects?.length} prospects`);

    if (prospects && prospects.length > 0) {
      // Show first prospect as example
      const p = prospects[0];
      console.log(`      Sample Prospect:`);
      console.log(`         Name: ${p.name}`);
      console.log(`         Title: ${p.title}`);
      console.log(`         Company: ${typeof p.company === 'object' ? p.company?.name : p.company}`);
      console.log(`         Contact: ${typeof p.contact === 'object' ? JSON.stringify(p.contact).slice(0, 50) + '...' : p.contact}`);
    }
  }

  console.log(`\n   📊 TOTAL PROSPECTS: ${totalProspects}`);

  // Step 4: Test API response format
  console.log('\n📌 STEP 4: API Response Format Test');
  if (sessions && sessions.length > 0 && sessions[0]) {
    const { data: prospects } = await supabase
      .from('prospect_approval_data')
      .select('*')
      .eq('session_id', sessions[0].id);

    if (prospects && prospects.length > 0) {
      const mapped = prospects[0];
      console.log('   Mapped Prospect Structure:');
      console.log(`      id: ${mapped.prospect_id}`);
      console.log(`      name: ${mapped.name}`);
      console.log(`      title: ${mapped.title || ''}`);
      console.log(`      company.name: ${typeof mapped.company === 'object' ? mapped.company?.name : mapped.company}`);
      console.log(`      contact.email: ${typeof mapped.contact === 'object' ? mapped.contact?.email : 'N/A'}`);
      console.log(`      contact.linkedin_url: ${typeof mapped.contact === 'object' ? mapped.contact?.linkedin_url : 'N/A'}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Data trace complete. Found ${totalProspects} prospects across ${sessions?.length || 0} sessions.\n`);
}

verifyApprovalData().catch(console.error);
