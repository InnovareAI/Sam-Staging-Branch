import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BLUE_LABEL_WORKSPACE_ID = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

async function findProspects() {
  console.log('🔍 Finding Stan\'s Prospects...\n');

  // Get the campaign session
  const { data: session } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .ilike('campaign_name', '%No pitch, just insight%')
    .single();

  if (!session) {
    console.log('❌ Campaign session not found');
    return;
  }

  console.log('✅ Campaign Session Found:');
  console.log(`   ID: ${session.id}`);
  console.log(`   Campaign: ${session.campaign_name}`);
  console.log(`   Total Prospects: ${session.total_prospects}`);
  console.log(`   Status: ${session.session_status}`);
  console.log('');

  // Check prospect_approval_data table
  console.log('1️⃣ prospect_approval_data table:');
  const { data: approvalData, error: error1 } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', session.id);

  console.log(`   Found: ${approvalData?.length || 0} prospects`);
  if (error1) console.log(`   Error: ${error1.message}`);
  if (approvalData && approvalData.length > 0) {
    console.log(`   First 3 prospects:`);
    approvalData.slice(0, 3).forEach(p => {
      console.log(`   - ${p.full_name || 'No name'} @ ${p.company || 'No company'}`);
      console.log(`     Status: ${p.approval_status || 'No status'}`);
    });
  }
  console.log('');

  // Check workspace_prospects table
  console.log('2️⃣ workspace_prospects table:');
  const { data: workspaceProspects, error: error2 } = await supabase
    .from('workspace_prospects')
    .select('*')
    .eq('workspace_id', BLUE_LABEL_WORKSPACE_ID);

  console.log(`   Found: ${workspaceProspects?.length || 0} prospects`);
  if (error2) console.log(`   Error: ${error2.message}`);
  console.log('');

  // Check if there are any orphaned prospects
  console.log('3️⃣ Checking for data migration needs:');
  if (approvalData && approvalData.length > 0 && (!workspaceProspects || workspaceProspects.length === 0)) {
    console.log('   ⚠️  ISSUE: Prospects in approval_data but NOT in workspace_prospects!');
    console.log(`   Need to migrate ${approvalData.length} prospects from approval to workspace table`);
    console.log('');
    console.log('   Approval Status Breakdown:');
    const approved = approvalData.filter(p => p.approval_status === 'approved').length;
    const pending = approvalData.filter(p => p.approval_status === 'pending').length;
    const rejected = approvalData.filter(p => p.approval_status === 'rejected').length;
    console.log(`   ✅ Approved: ${approved}`);
    console.log(`   ⏳ Pending: ${pending}`);
    console.log(`   ❌ Rejected: ${rejected}`);
  }
}

findProspects();
