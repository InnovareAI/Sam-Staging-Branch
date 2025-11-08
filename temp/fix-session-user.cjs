const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixSession() {
  const wsId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  const sessionId = '0ac9d110-4da6-4f2d-83e2-1b696b8e5829';
  const stanEmail = 'stan01@signali.ai';  // Stan's email

  console.log('Finding Stan\'s user ID...\n');

  // Find Stan's user ID
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const stanUser = users.find(u => u.email?.toLowerCase() === stanEmail.toLowerCase());

  if (!stanUser) {
    console.log('❌ Stan not found. Looking for all users in workspace...\n');

    // Show all members
    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', wsId);

    console.log('Workspace members:', members?.length);

    for (const member of members || []) {
      const user = users.find(u => u.id === member.user_id);
      if (user) {
        console.log(`  - ${user.email} (${user.id})`);
      }
    }
    return;
  }

  console.log(`✅ Found Stan: ${stanUser.email}`);
  console.log(`   User ID: ${stanUser.id}\n`);

  // Update the session to Stan's user_id
  const { error } = await supabase
    .from('prospect_approval_sessions')
    .update({ user_id: stanUser.id })
    .eq('id', sessionId);

  if (error) {
    console.log(`❌ Error updating session: ${error.message}`);
  } else {
    console.log(`✅ Session updated to Stan's user_id`);
    console.log(`   Session ID: ${sessionId}`);
    console.log(`   Campaign: 20251106-BLL-CISO Outreach - Mid Market`);
    console.log('\n✅ Stan should now see this session in the approval screen\n');
  }
}

fixSession().catch(console.error);
