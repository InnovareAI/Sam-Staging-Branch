// Check what user tl@innovareai.com can see in BLL workspace
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUserWorkspaceView() {
  const bllWorkspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  const userEmail = 'tl@innovareai.com';

  console.log('🔍 CHECKING WHAT USER CAN SEE IN BLL WORKSPACE\n');
  console.log('=' .repeat(80) + '\n');

  // 1. Find the user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === userEmail);

  if (!user) {
    console.log('❌ User not found:', userEmail);
    return;
  }

  console.log('👤 USER INFO:');
  console.log(`   Email: ${user.email}`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Created: ${new Date(user.created_at).toLocaleString()}\n`);

  // 2. Check workspace membership
  console.log('🏢 WORKSPACE MEMBERSHIPS:\n');

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(name)')
    .eq('user_id', user.id);

  console.log(`   Total workspaces: ${memberships?.length || 0}\n`);

  memberships?.forEach(m => {
    const isBLL = m.workspace_id === bllWorkspaceId;
    console.log(`   ${isBLL ? '🎯' : '  '} ${m.workspaces?.name || m.workspace_id}`);
    console.log(`      Role: ${m.role}`);
    console.log(`      ID: ${m.workspace_id}`);
    if (isBLL) console.log(`      ✅ THIS IS THE BLL WORKSPACE`);
    console.log('');
  });

  const hasBLLAccess = memberships?.some(m => m.workspace_id === bllWorkspaceId);

  if (!hasBLLAccess) {
    console.log('❌ USER DOES NOT HAVE ACCESS TO BLL WORKSPACE!');
    console.log('   This is why they can\'t see the data.\n');
    return;
  }

  console.log('✅ User has access to BLL workspace\n');
  console.log('=' .repeat(80) + '\n');

  // 3. Check what's in BLL workspace
  console.log('📊 DATA IN BLL WORKSPACE:\n');

  // Approval sessions
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('id, campaign_name, approved_count, status, created_at, user_id')
    .eq('workspace_id', bllWorkspaceId)
    .order('created_at', { ascending: false });

  console.log(`APPROVAL SESSIONS: ${sessions?.length || 0}\n`);

  sessions?.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.campaign_name || s.id.substring(0, 8)}`);
    console.log(`      Approved: ${s.approved_count}`);
    console.log(`      Status: ${s.status}`);
    console.log(`      Created: ${new Date(s.created_at).toLocaleString()}`);
    console.log(`      User: ${s.user_id?.substring(0, 8)}`);
  });

  // Campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, campaign_type, created_at, created_by')
    .eq('workspace_id', bllWorkspaceId)
    .order('created_at', { ascending: false });

  console.log(`\n\nCAMPAIGNS: ${campaigns?.length || 0}\n`);

  campaigns?.forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.name}`);
    console.log(`      Status: ${c.status}`);
    console.log(`      Type: ${c.campaign_type}`);
    console.log(`      Created: ${new Date(c.created_at).toLocaleString()}`);
    console.log(`      Created by: ${c.created_by?.substring(0, 8)}`);
  });

  // Check the specific CISO session we restored
  console.log('\n\n' + '=' .repeat(80));
  console.log('\n🎯 STAN\'S RESTORED CISO SESSION:\n');

  const cisoSessionId = '5c86a789-a926-4d79-8120-cc3e76939d75';

  const { data: cisoSession } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('id', cisoSessionId)
    .single();

  if (!cisoSession) {
    console.log('❌ CISO session not found!');
  } else {
    console.log(`✅ Session exists: ${cisoSession.campaign_name}`);
    console.log(`   Workspace: ${cisoSession.workspace_id}`);
    console.log(`   User: ${cisoSession.user_id}`);
    console.log(`   Approved count: ${cisoSession.approved_count}`);
    console.log(`   Status: ${cisoSession.status}\n`);

    // Check approved prospects
    const { data: approvedProspects } = await supabase
      .from('prospect_approval_data')
      .select('id, name, approval_status')
      .eq('session_id', cisoSessionId)
      .eq('approval_status', 'approved');

    console.log(`   ✅ Approved prospects in database: ${approvedProspects?.length || 0}`);

    if (approvedProspects && approvedProspects.length > 0) {
      console.log('\n   Sample approved prospects:');
      approvedProspects.slice(0, 5).forEach((p, i) => {
        console.log(`      ${i + 1}. ${p.name}`);
      });
    }
  }

  // 4. Check current_workspace_id for the user
  console.log('\n\n' + '=' .repeat(80));
  console.log('\n🔍 USER\'S CURRENT WORKSPACE:\n');

  const { data: profile } = await supabase
    .from('users')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single();

  console.log(`   Current workspace ID: ${profile?.current_workspace_id || 'None'}`);

  if (profile?.current_workspace_id) {
    const { data: currentWorkspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', profile.current_workspace_id)
      .single();

    console.log(`   Current workspace name: ${currentWorkspace?.name || 'Unknown'}`);

    if (profile.current_workspace_id !== bllWorkspaceId) {
      console.log('\n   ⚠️  USER IS IN A DIFFERENT WORKSPACE!');
      console.log(`   Current: ${currentWorkspace?.name}`);
      console.log(`   Expected: Blue Label Labs`);
      console.log('\n   This is why they can\'t see Stan\'s data!\n');
    } else {
      console.log('\n   ✅ User is in the correct workspace\n');
    }
  }

  console.log('\n✅ Workspace view check complete!\n');
}

checkUserWorkspaceView().catch(console.error);
