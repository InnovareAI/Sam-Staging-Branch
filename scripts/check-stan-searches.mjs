import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STAN_USER_ID = '6a927440-ebe1-49b4-ae5e-fbee5d27944d';
const BLUE_LABEL_WORKSPACE_ID = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

async function checkStanSearches() {
  console.log('🔍 Checking Stan\'s Search Activity...\n');

  // Check prospect approval sessions
  console.log('1️⃣ Prospect Approval Sessions:');
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('workspace_id', BLUE_LABEL_WORKSPACE_ID)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`   Found: ${sessions?.length || 0} sessions`);
  if (sessions && sessions.length > 0) {
    sessions.forEach(s => {
      console.log(`   - ${s.campaign_name || 'Unnamed'}`);
      console.log(`     Status: ${s.session_status}`);
      console.log(`     Prospects: ${s.total_prospects || 0}`);
      console.log(`     Created: ${new Date(s.created_at).toLocaleString()}`);
      if (s.error_message) {
        console.log(`     ❌ Error: ${s.error_message}`);
      }
    });
  }
  console.log('');

  // Check prospect search jobs
  console.log('2️⃣ Prospect Search Jobs:');
  const { data: jobs } = await supabase
    .from('prospect_search_jobs')
    .select('*')
    .eq('workspace_id', BLUE_LABEL_WORKSPACE_ID)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`   Found: ${jobs?.length || 0} jobs`);
  if (jobs && jobs.length > 0) {
    jobs.forEach(j => {
      console.log(`   - Search Type: ${j.search_type}`);
      console.log(`     Status: ${j.status}`);
      console.log(`     Target: ${j.target_count || 0}`);
      console.log(`     Found: ${j.found_count || 0}`);
      console.log(`     Created: ${new Date(j.created_at).toLocaleString()}`);
      if (j.error_message) {
        console.log(`     ❌ Error: ${j.error_message}`);
      }
    });
  }
  console.log('');

  // Check workspace prospects
  console.log('3️⃣ Workspace Prospects:');
  const { data: prospects } = await supabase
    .from('workspace_prospects')
    .select('id, full_name, company, approval_status, created_at')
    .eq('workspace_id', BLUE_LABEL_WORKSPACE_ID)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`   Total prospects: ${prospects?.length || 0}`);
  if (prospects && prospects.length > 0) {
    prospects.forEach(p => {
      console.log(`   - ${p.full_name} @ ${p.company || 'Unknown Company'}`);
      console.log(`     Status: ${p.approval_status}`);
    });
  }
  console.log('');

  // Check for the specific campaign mentioned in the error
  console.log('4️⃣ Searching for campaign: "20251014-IAI-No pitch, just insight - CISO AI Security Q4"');
  const { data: specificCampaign } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .ilike('campaign_name', '%No pitch, just insight%')
    .order('created_at', { ascending: false })
    .limit(1);

  if (specificCampaign && specificCampaign.length > 0) {
    const campaign = specificCampaign[0];
    console.log('   ✅ Found the campaign!');
    console.log(`   Campaign: ${campaign.campaign_name}`);
    console.log(`   Workspace ID: ${campaign.workspace_id}`);
    console.log(`   User ID: ${campaign.user_id}`);
    console.log(`   Status: ${campaign.session_status}`);
    console.log(`   Total Prospects: ${campaign.total_prospects || 0}`);
    console.log(`   Error: ${campaign.error_message || 'None'}`);
    console.log('');

    if (campaign.workspace_id !== BLUE_LABEL_WORKSPACE_ID) {
      console.log('   ⚠️  WARNING: This campaign is in a DIFFERENT workspace!');
      console.log(`   Campaign workspace: ${campaign.workspace_id}`);
      console.log(`   Blue Label Labs: ${BLUE_LABEL_WORKSPACE_ID}`);
    }
  } else {
    console.log('   ❌ Campaign not found in database');
  }
}

checkStanSearches();
