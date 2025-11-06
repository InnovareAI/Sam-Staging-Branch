require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugWorkspaceError() {
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b'; // tl@innovareai.com
  
  console.log('\n🔍 DEBUGGING WORKSPACE ACCESS ERROR\n');
  
  // 1. Get user's workspace memberships
  console.log('1️⃣ User workspace memberships:');
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, status')
    .eq('user_id', userId);
  console.log(JSON.stringify(memberships, null, 2));
  
  // 2. Get workspace details for user's workspaces
  console.log('\n2️⃣ Workspace details:');
  for (const membership of memberships || []) {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id, name, owner_id')
      .eq('id', membership.workspace_id)
      .single();
    console.log(`  - ${workspace.name} (${workspace.id})`);
    console.log(`    Owner: ${workspace.owner_id}`);
    console.log(`    User role: ${membership.role}`);
  }
  
  // 3. Check recent campaigns - what workspace are they trying to use?
  console.log('\n3️⃣ Recent campaign activity (last 24 hours):');
  const { data: recentCampaigns } = await supabase
    .from('campaigns')
    .select('id, name, workspace_id, created_by, created_at')
    .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log(JSON.stringify(recentCampaigns, null, 2));
  
  // 4. Check prospect_approval_data - what workspace is the data in?
  console.log('\n4️⃣ Recent prospect approvals (check workspace_id):');
  const { data: approvals } = await supabase
    .from('prospect_approval_data')
    .select('id, workspace_id, campaign_name, approved_at')
    .eq('status', 'approved')
    .order('approved_at', { ascending: false })
    .limit(5);
    
  console.log(JSON.stringify(approvals, null, 2));
}

debugWorkspaceError().catch(console.error);
