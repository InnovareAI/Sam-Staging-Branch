require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkOwnership() {
  console.log('🔍 Checking session ownership...\n');

  // Get the recent sessions
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('id, campaign_name, user_id, workspace_id, created_at')
    .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('📊 Recent Sessions:');
  for (const session of sessions) {
    console.log(`\n  Session: ${session.campaign_name}`);
    console.log(`  ID: ${session.id.substring(0, 8)}`);
    console.log(`  User ID: ${session.user_id}`);
    console.log(`  Created: ${session.created_at}`);

    // Get user email
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const user = users.find(u => u.id === session.user_id);
    console.log(`  User Email: ${user?.email || 'Unknown'}`);
  }

  // Get all workspace members
  console.log('\n\n📋 Workspace Members:');
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009');

  const { data: { users } } = await supabase.auth.admin.listUsers();
  for (const member of members) {
    const user = users.find(u => u.id === member.user_id);
    console.log(`  - ${user?.email || 'Unknown'} (${member.user_id})`);
  }
}

checkOwnership().catch(console.error);
