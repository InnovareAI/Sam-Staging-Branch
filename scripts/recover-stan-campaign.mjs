import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BROKEN_SESSION_ID = '6c63e4b7-9f5d-4b6c-a891-5088db06af07';

async function recoverCampaign() {
  console.log('🔍 Attempting to Recover Stan\'s Campaign...\n');

  // Get the session with all details
  const { data: session, error } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('id', BROKEN_SESSION_ID)
    .single();

  if (!session) {
    console.log('❌ Session not found');
    return;
  }

  console.log('✅ Found Campaign Session:');
  console.log(`   Campaign: ${session.campaign_name}`);
  console.log(`   Created: ${new Date(session.created_at).toLocaleString()}`);
  console.log(`   Expected Prospects: ${session.total_prospects}`);
  console.log('');

  console.log('📊 Search Criteria Stored:');
  if (session.icp_criteria) {
    console.log(JSON.stringify(session.icp_criteria, null, 2));
  } else {
    console.log('   ❌ No ICP criteria found');
  }
  console.log('');

  console.log('📊 Campaign Details:');
  console.log(`   Campaign Name: ${session.campaign_name}`);
  console.log(`   Campaign Tag: ${session.campaign_tag || 'None'}`);
  console.log(`   Prospect Source: ${session.prospect_source || 'Unknown'}`);
  console.log('');

  console.log('📊 Learning Insights:');
  if (session.learning_insights) {
    console.log(JSON.stringify(session.learning_insights, null, 2));
  } else {
    console.log('   No learning insights stored');
  }
  console.log('');

  // Check if there are ANY prospects in the system that might be orphaned
  console.log('🔍 Checking for orphaned prospects...');

  // Check workspace_prospects for this workspace around the same time
  const sessionDate = new Date(session.created_at);
  const dayBefore = new Date(sessionDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const dayAfter = new Date(sessionDate);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const { data: nearbyProspects } = await supabase
    .from('workspace_prospects')
    .select('id, full_name, company, created_at, approval_status')
    .eq('workspace_id', session.workspace_id)
    .gte('created_at', dayBefore.toISOString())
    .lte('created_at', dayAfter.toISOString());

  console.log(`   Found ${nearbyProspects?.length || 0} prospects created around that time`);
  if (nearbyProspects && nearbyProspects.length > 0) {
    console.log('   First 5:');
    nearbyProspects.slice(0, 5).forEach(p => {
      console.log(`   - ${p.full_name} @ ${p.company || 'No company'} (${p.approval_status})`);
    });
  }
  console.log('');

  // Recovery options
  console.log('🔧 Recovery Options:\n');

  if (session.icp_criteria && Object.keys(session.icp_criteria).length > 0) {
    console.log('✅ OPTION 1: Re-run the Search');
    console.log('   The search criteria is saved in the session.');
    console.log('   Stan can run the exact same search again using these criteria:');
    console.log('');
    console.log('   Search Criteria:');
    console.log(JSON.stringify(session.icp_criteria, null, 2));
    console.log('');
    console.log('   How to do it:');
    console.log('   1. Stan goes to the Prospecting Assistant');
    console.log('   2. Describes the same search (or we can provide the exact criteria)');
    console.log('   3. The search will run fresh and save the results correctly');
    console.log('');
  }

  console.log('✅ OPTION 2: Restore the Session');
  console.log('   If the prospects are somewhere in the system (different table, different format),');
  console.log('   we can try to find and link them to this session.');
  console.log('');

  console.log('❌ OPTION 3: Manual Recreation');
  console.log('   If the data is completely lost, Stan will need to:');
  console.log('   1. Use the campaign name to remember what he was searching for');
  console.log('   2. Run the search again from scratch');
  console.log('');

  // Recommendation
  console.log('📝 RECOMMENDED ACTION:');
  console.log('');
  if (session.icp_criteria && Object.keys(session.icp_criteria).length > 0) {
    console.log('   ✅ Use OPTION 1 - Re-run with saved criteria');
    console.log('   This is the cleanest solution and will work perfectly.');
  } else {
    console.log('   Use OPTION 3 - Manual recreation');
    console.log('   Search for: CISOs in AI Security focused companies');
    console.log('   Based on campaign name: "No pitch, just insight - CISO AI Security Q4"');
  }
}

recoverCampaign();
