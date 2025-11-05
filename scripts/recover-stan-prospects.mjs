// Try to recover Stan's approved prospects
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function recoverProspects() {
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  console.log('🔍 Analyzing Stan\'s prospect data for recovery...\n');

  // Get sessions with approved counts that don't match
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('id, campaign_name, approved_count, total_prospects, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  console.log('📋 Checking sessions for mismatches:\n');

  for (const session of sessions || []) {
    if (!session.approved_count || session.approved_count === 0) continue;

    // Check actual approved prospects in this session
    const { data: prospects } = await supabase
      .from('prospect_approval_data')
      .select('id, name, approval_status')
      .eq('session_id', session.id)
      .eq('approval_status', 'approved');

    const actualApproved = prospects?.length || 0;
    const recordedApproved = session.approved_count || 0;

    if (actualApproved !== recordedApproved) {
      console.log('⚠️  MISMATCH FOUND:');
      console.log('   Session:', session.campaign_name);
      console.log('   Session says:', recordedApproved, 'approved');
      console.log('   Actually found:', actualApproved, 'approved');
      console.log('   Missing:', recordedApproved - actualApproved, 'prospects');
      console.log('   Session ID:', session.id);

      // Check if prospects exist but with different status
      const { data: allProspectsInSession } = await supabase
        .from('prospect_approval_data')
        .select('approval_status')
        .eq('session_id', session.id);

      if (allProspectsInSession) {
        const statusCount = {};
        allProspectsInSession.forEach(p => {
          statusCount[p.approval_status] = (statusCount[p.approval_status] || 0) + 1;
        });
        console.log('   Status breakdown:', statusCount);
      }

      // Check if they were moved to campaigns
      const { data: campaignProspects } = await supabase
        .from('campaign_prospects')
        .select('campaign_id, first_name, last_name')
        .eq('workspace_id', workspaceId)
        .eq('personalization_data->session_id', session.id);

      if (campaignProspects && campaignProspects.length > 0) {
        console.log('   ✅ Found', campaignProspects.length, 'prospects in campaigns');
        const campaigns = new Set(campaignProspects.map(p => p.campaign_id));
        console.log('   In campaigns:', Array.from(campaigns).map(id => id.substring(0, 8)).join(', '));
      }

      console.log('');
    }
  }

  // Summary
  console.log('\n📊 RECOVERY OPTIONS:');
  console.log('1. Prospects that were moved to campaigns are still accessible');
  console.log('2. Prospects that changed status might be recoverable');
  console.log('3. Truly deleted prospects cannot be recovered');
}

recoverProspects().catch(console.error);
