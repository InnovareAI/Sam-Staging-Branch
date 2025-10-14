import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BROKEN_SESSION_ID = '6c63e4b7-9f5d-4b6c-a891-5088db06af07';

async function fixBrokenCampaign() {
  console.log('🔧 Fixing Stan\'s Broken Campaign Session...\n');

  // Get current session state
  const { data: session } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('id', BROKEN_SESSION_ID)
    .single();

  if (!session) {
    console.log('❌ Session not found');
    return;
  }

  console.log('📊 Current Session State:');
  console.log(`   Campaign: ${session.campaign_name}`);
  console.log(`   Status: ${session.status || 'undefined'}`);
  console.log(`   Total Prospects: ${session.total_prospects || 0}`);
  console.log(`   Pending: ${session.pending_count || 0}`);
  console.log(`   Approved: ${session.approved_count || 0}`);
  console.log(`   Rejected: ${session.rejected_count || 0}`);
  console.log('');

  // Check if prospects actually exist
  const { data: prospects, error: prospectError } = await supabase
    .from('prospect_approval_data')
    .select('id')
    .eq('session_id', BROKEN_SESSION_ID);

  console.log(`   Actual prospects in database: ${prospects?.length || 0}`);

  if (prospects && prospects.length > 0) {
    console.log('✅ Prospects exist! Session is OK, just needs user to view them.');
    return;
  }

  console.log('');
  console.log('❌ No prospects found - this is a broken session');
  console.log('');

  // Update session to mark as archived (failed sessions should be archived)
  console.log('🔧 Updating session status to "archived"...');
  const { data: updated, error } = await supabase
    .from('prospect_approval_sessions')
    .update({
      status: 'archived',
      pending_count: 0,
      total_prospects: 0
    })
    .eq('id', BROKEN_SESSION_ID)
    .select()
    .single();

  if (error) {
    console.log('❌ Error updating session:', error.message);
    return;
  }

  console.log('✅ Session updated successfully!');
  console.log('');
  console.log('📊 New Session State:');
  console.log(`   Status: ${updated.status}`);
  console.log(`   Total Prospects: ${updated.total_prospects}`);
  console.log(`   Pending Count: ${updated.pending_count}`);
  console.log('');

  console.log('✅ Stan can now retry his search without conflicts!');
  console.log('');
  console.log('📝 Next Steps:');
  console.log('   1. Stan should hard refresh browser (Cmd+Shift+R)');
  console.log('   2. Run the search again');
  console.log('   3. LinkedIn is properly connected and should work now');
}

fixBrokenCampaign();
