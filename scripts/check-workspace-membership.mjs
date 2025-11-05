// Check workspace membership for debugging
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMembership() {
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  const userEmail = 'tl@innovareai.com';

  // Get user ID
  const { data: users } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', userEmail);

  if (!users || users.length === 0) {
    console.log('❌ User not found:', userEmail);
    return;
  }

  const userId = users[0].id;
  console.log('✅ User found:', { id: userId, email: userEmail });

  // Check workspace membership
  const { data: membership, error } = await supabase
    .from('workspace_members')
    .select('*, workspaces(name)')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  if (error) {
    console.log('❌ Membership query error:', error);
  }

  if (!membership) {
    console.log('\n❌ NOT A MEMBER of workspace:', workspaceId);
    console.log('\nTo fix this, run:');
    console.log(`
INSERT INTO workspace_members (workspace_id, user_id, role)
VALUES ('${workspaceId}', '${userId}', 'owner')
ON CONFLICT (workspace_id, user_id) DO NOTHING;
    `);
  } else {
    console.log('\n✅ IS A MEMBER:', membership);
  }

  // Show all workspaces user is a member of
  const { data: allMemberships } = await supabase
    .from('workspace_members')
    .select('*, workspaces(name)')
    .eq('user_id', userId);

  console.log('\n📋 All workspace memberships:');
  allMemberships?.forEach(m => {
    console.log(`  - ${m.workspaces.name} (${m.workspace_id}) - role: ${m.role}`);
  });
}

checkMembership().catch(console.error);
