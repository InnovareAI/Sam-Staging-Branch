import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  console.log('\n🔍 CHECKING DATA APPROVAL SYSTEM\n');

  // 1. Check workspace_prospects (CRM table)
  console.log('1️⃣ Checking workspace_prospects table...');
  const { data: crmProspects, error: crmError } = await supabase
    .from('workspace_prospects')
    .select('id, first_name, last_name, job_title, company_name, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (crmError) {
    console.error('❌ Error:', crmError);
  } else {
    console.log(`✅ Found ${crmProspects?.length || 0} prospects in workspace_prospects`);
    if (crmProspects && crmProspects.length > 0) {
      console.log('Latest:');
      crmProspects.forEach((p, i) => {
        console.log(`   ${i+1}. ${p.first_name} ${p.last_name} - ${p.job_title} at ${p.company_name}`);
      });
    }
  }

  // 2. Check prospect_approval_sessions
  console.log('\n2️⃣ Checking prospect_approval_sessions...');
  const { data: sessions, error: sessionsError } = await supabase
    .from('prospect_approval_sessions')
    .select('id, user_id, organization_id, source, total_prospects, pending_count, session_status, created_at')
    .eq('organization_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (sessionsError) {
    console.error('❌ Error:', sessionsError);
    console.log('Error details:', JSON.stringify(sessionsError, null, 2));
  } else {
    console.log(`✅ Found ${sessions?.length || 0} approval sessions`);
    if (sessions && sessions.length > 0) {
      console.log('Sessions:');
      sessions.forEach((s, i) => {
        console.log(`   ${i+1}. ${s.id.slice(0, 20)}... - ${s.source} - ${s.total_prospects} prospects - ${s.session_status}`);
      });
    }
  }

  // 3. Check prospect_approval_data
  if (sessions && sessions.length > 0) {
    console.log('\n3️⃣ Checking prospect_approval_data...');
    const sessionId = sessions[0].id;
    const { data: approvalData, error: approvalError } = await supabase
      .from('prospect_approval_data')
      .select('prospect_id, name, title, company, approval_status, created_at')
      .eq('session_id', sessionId)
      .limit(5);

    if (approvalError) {
      console.error('❌ Error:', approvalError);
    } else {
      console.log(`✅ Found ${approvalData?.length || 0} prospects in approval data for session ${sessionId.slice(0, 20)}...`);
      if (approvalData && approvalData.length > 0) {
        console.log('Prospects:');
        approvalData.forEach((p, i) => {
          console.log(`   ${i+1}. ${p.name} - ${p.title} at ${p.company} - ${p.approval_status}`);
        });
      }
    }
  }

  // 4. Check if tables exist
  console.log('\n4️⃣ Checking table existence...');
  const tables = ['workspace_prospects', 'prospect_approval_sessions', 'prospect_approval_data'];

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .select('*')
      .limit(0);

    if (error) {
      console.log(`❌ ${table}: ${error.message}`);
    } else {
      console.log(`✅ ${table}: exists`);
    }
  }

  console.log('\n✅ Check complete\n');
}

check();
