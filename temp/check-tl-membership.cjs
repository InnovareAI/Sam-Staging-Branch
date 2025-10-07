const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTLMembership() {
  console.log('🔍 Checking tl@innovareai.com workspace memberships\n');

  // Find tl@innovareai.com user
  const { data: tlUser } = await supabase
    .from('users')
    .select('id, email, full_name')
    .eq('email', 'tl@innovareai.com')
    .maybeSingle();

  if (!tlUser) {
    console.log('❌ User tl@innovareai.com not found in users table');
    return;
  }

  console.log(`✅ Found: ${tlUser.email}`);
  console.log(`   ID: ${tlUser.id}`);
  console.log(`   Name: ${tlUser.full_name || 'Not set'}\n`);

  // Get workspace memberships
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', tlUser.id);

  console.log(`📦 Your Workspaces (${memberships.length}):\n`);

  for (const m of memberships) {
    const { data: ws } = await supabase
      .from('workspaces')
      .select('name, organization_id')
      .eq('id', m.workspace_id)
      .single();

    let orgInfo = 'No organization';
    if (ws.organization_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('name, billing_type')
        .eq('id', ws.organization_id)
        .single();
      if (org) {
        orgInfo = `${org.name} (${org.billing_type})`;
      }
    }

    console.log(`  ${m.role === 'owner' ? '👑' : '👤'} ${ws.name}`);
    console.log(`     Role: ${m.role}`);
    console.log(`     Org: ${orgInfo}`);
    console.log('');
  }
}

checkTLMembership().catch(console.error);
