// Check all of Stan's data for recovery opportunities
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAllStanData() {
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  const stanUserId = '6a927440-ebe1-49b4-ae5e-fbee5d27944d';

  console.log('🔍 COMPREHENSIVE DATA RECOVERY CHECK FOR STAN BOUNEV\n');
  console.log('=' .repeat(80) + '\n');

  // 1. Check ALL approval sessions (not just the CISO one)
  console.log('1️⃣ APPROVAL SESSIONS:\n');

  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', stanUserId)
    .order('created_at', { ascending: false });

  console.log(`Total sessions: ${sessions?.length || 0}\n`);

  for (const session of sessions || []) {
    const { data: approved } = await supabase
      .from('prospect_approval_data')
      .select('id')
      .eq('session_id', session.id)
      .eq('approval_status', 'approved');

    const actualApproved = approved?.length || 0;
    const recordedApproved = session.approved_count || 0;
    const mismatch = recordedApproved - actualApproved;

    console.log(`📋 ${session.campaign_name || 'Session ' + session.id.substring(0, 8)}`);
    console.log(`   Created: ${new Date(session.created_at).toLocaleString()}`);
    console.log(`   Status: ${session.status}`);
    console.log(`   Total prospects: ${session.total_prospects}`);
    console.log(`   Recorded approved: ${recordedApproved}`);
    console.log(`   Actually approved: ${actualApproved}`);

    if (mismatch > 0) {
      console.log(`   ⚠️  MISSING: ${mismatch} approved prospects can be recovered!`);
    } else if (actualApproved > 0) {
      console.log(`   ✅ Approved prospects intact`);
    }
    console.log('');
  }

  // 2. Check all campaigns
  console.log('\n2️⃣ CAMPAIGNS:\n');

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  console.log(`Total campaigns: ${campaigns?.length || 0}\n`);

  for (const campaign of campaigns || []) {
    // Get prospect count for this campaign
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('id, status')
      .eq('campaign_id', campaign.id);

    const prospectsByStatus = {};
    prospects?.forEach(p => {
      prospectsByStatus[p.status] = (prospectsByStatus[p.status] || 0) + 1;
    });

    console.log(`📊 ${campaign.name}`);
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Type: ${campaign.campaign_type || 'messenger'}`);
    console.log(`   Created: ${new Date(campaign.created_at).toLocaleString()}`);
    console.log(`   Prospects: ${prospects?.length || 0}`);

    if (prospects && prospects.length > 0) {
      console.log(`   Status breakdown:`, prospectsByStatus);
    }

    // Check if campaign has message sequences
    if (campaign.message_sequence) {
      console.log(`   📝 Has message sequence: ${campaign.message_sequence.length || 0} messages`);
      if (campaign.message_sequence.length > 0) {
        console.log(`      Sample: "${campaign.message_sequence[0]?.substring(0, 60)}..."`);
      }
    }

    console.log('');
  }

  // 3. Check for orphaned campaign prospects (prospects without campaigns)
  console.log('\n3️⃣ ORPHANED CAMPAIGN PROSPECTS:\n');

  const { data: allCampaignProspects } = await supabase
    .from('campaign_prospects')
    .select('campaign_id, status')
    .eq('workspace_id', workspaceId);

  const campaignIds = new Set((campaigns || []).map(c => c.id));
  const orphaned = allCampaignProspects?.filter(p => !campaignIds.has(p.campaign_id)) || [];

  console.log(`Orphaned prospects: ${orphaned.length}`);
  if (orphaned.length > 0) {
    console.log(`⚠️  Found ${orphaned.length} prospects linked to deleted campaigns`);
  }

  // 4. Check for draft/pending campaigns
  console.log('\n4️⃣ DRAFT OR PENDING CAMPAIGNS:\n');

  const drafts = campaigns?.filter(c =>
    c.status === 'draft' ||
    c.status === 'pending' ||
    c.status === 'paused'
  ) || [];

  console.log(`Draft/Pending/Paused campaigns: ${drafts.length}`);

  for (const draft of drafts) {
    console.log(`   📝 ${draft.name}`);
    console.log(`      Status: ${draft.status}`);
    console.log(`      Created: ${new Date(draft.created_at).toLocaleString()}`);

    // Check if it has prospects ready
    const { data: draftProspects } = await supabase
      .from('campaign_prospects')
      .select('id')
      .eq('campaign_id', draft.id);

    console.log(`      Prospects ready: ${draftProspects?.length || 0}`);
  }

  // 5. Summary of recoverable data
  console.log('\n' + '=' .repeat(80));
  console.log('\n📊 RECOVERY SUMMARY:\n');

  const totalMissingApprovals = sessions?.reduce((sum, s) => {
    const recorded = s.approved_count || 0;
    // We'd need to query each one, but for summary we can estimate
    return sum;
  }, 0);

  const sessionsWithIssues = sessions?.filter(s => s.approved_count > 0) || [];

  console.log(`✅ RECOVERED:`);
  console.log(`   - 25 CISO prospects from "Mid-Market CISOs" session (already restored)\n`);

  console.log(`⚠️  POTENTIALLY RECOVERABLE:`);
  console.log(`   - ${sessionsWithIssues.length} approval sessions to check`);
  console.log(`   - ${drafts.length} draft/paused campaigns`);
  console.log(`   - ${orphaned.length} orphaned campaign prospects\n`);

  console.log(`📋 CAMPAIGNS READY TO LAUNCH:`);
  const readyToLaunch = campaigns?.filter(c =>
    c.status === 'draft' &&
    (c.message_sequence?.length || 0) > 0
  ) || [];
  console.log(`   - ${readyToLaunch.length} campaigns with message sequences ready\n`);

  // 6. Check if there are any other approval sessions with mismatches
  console.log('\n5️⃣ DETAILED APPROVAL SESSION ANALYSIS:\n');

  for (const session of sessions || []) {
    if (session.approved_count > 0) {
      const { data: approved } = await supabase
        .from('prospect_approval_data')
        .select('id, name, title')
        .eq('session_id', session.id)
        .eq('approval_status', 'approved');

      const actualApproved = approved?.length || 0;
      const recordedApproved = session.approved_count || 0;

      if (recordedApproved !== actualApproved && session.id !== '5c86a789-a926-4d79-8120-cc3e76939d75') {
        console.log(`⚠️  MISMATCH: ${session.campaign_name || session.id.substring(0, 8)}`);
        console.log(`   Expected: ${recordedApproved}, Found: ${actualApproved}`);
        console.log(`   Missing: ${recordedApproved - actualApproved} prospects`);
        console.log(`   Session ID: ${session.id}\n`);
      }
    }
  }

  console.log('\n✅ Recovery check complete!\n');
}

checkAllStanData().catch(console.error);
