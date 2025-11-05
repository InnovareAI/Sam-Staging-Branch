// Check for existing prospects
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProspects() {
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08'; // Blue Label Labs
  const stanUserId = '6a927440-ebe1-49b4-ae5e-fbee5d27944d';

  console.log('🔍 Checking Stan Bounev\'s prospects...\n');

  // Check ALL approval sessions (not just recent)
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', stanUserId)
    .order('created_at', { ascending: false });

  console.log('📋 Total approval sessions:', sessions?.length || 0);
  if (sessions && sessions.length > 0) {
    sessions.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.campaign_name || 'Session ' + s.id.substring(0, 8)}`);
      console.log(`      Created: ${new Date(s.created_at).toLocaleString()}`);
      console.log(`      Total: ${s.total_prospects} | Approved: ${s.approved_count || 0}`);
      console.log(`      Status: ${s.status}`);
    });
  }

  // Check ALL approved prospects
  const { data: approved } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('approval_status', 'approved')
    .order('updated_at', { ascending: false });

  console.log('\n✅ Total approved prospects:', approved?.length || 0);
  if (approved && approved.length > 0) {
    console.log('\n   Sample (first 20):');
    approved.slice(0, 20).forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name || 'Unknown'}`);
      console.log(`      Title: ${p.title || 'N/A'}`);
      console.log(`      Company: ${p.company?.name || 'N/A'}`);
      console.log(`      Approved: ${new Date(p.updated_at).toLocaleString()}`);
    });

    if (approved.length > 20) {
      console.log(`   ... and ${approved.length - 20} more approved prospects`);
    }
  }

  // Check today's approvals
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: todayData } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('workspace_id', workspaceId)
    .gte('updated_at', today.toISOString());

  const todayApproved = todayData?.filter(p => p.approval_status === 'approved') || [];
  const todayPending = todayData?.filter(p => p.approval_status === 'pending') || [];

  console.log('\n📅 Today\'s activity:');
  console.log(`   Approved: ${todayApproved.length}`);
  console.log(`   Pending: ${todayPending.length}`);

  if (todayApproved.length > 0) {
    console.log('\n   Today\'s approved prospects:');
    todayApproved.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} - ${p.title} at ${p.company?.name}`);
    });
  }

  // Check campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, campaign_type, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n📊 Recent campaigns:', campaigns?.length || 0);
  campaigns?.forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.name}`);
    console.log(`      Status: ${c.status}, Type: ${c.campaign_type || 'messenger'}`);
    console.log(`      ID: ${c.id}`);
  });
}

checkProspects().catch(console.error);
