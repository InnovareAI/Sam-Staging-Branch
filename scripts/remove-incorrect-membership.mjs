// Remove tl@innovareai.com from Blue Label Labs (client workspace)
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function removeIncorrectMembership() {
  const blueLabelsWorkspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b'; // tl@innovareai.com

  console.log('🗑️  Removing incorrect workspace membership...');
  console.log('   User: tl@innovareai.com');
  console.log('   Workspace: Blue Label Labs (client workspace)');

  const { data, error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', blueLabelsWorkspaceId)
    .eq('user_id', userId)
    .select();

  if (error) {
    console.error('❌ Failed to remove membership:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('✅ Successfully removed membership');
    console.log('   Removed:', data.length, 'membership(s)');
  } else {
    console.log('⚠️  No membership found to remove');
  }

  // Verify removal
  const { data: verification } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', blueLabelsWorkspaceId)
    .eq('user_id', userId);

  if (verification && verification.length > 0) {
    console.log('❌ ERROR: Membership still exists!');
  } else {
    console.log('✅ Verified: tl@innovareai.com is no longer a member of Blue Label Labs');
  }

  // Show correct memberships for Blue Label Labs
  const { data: correctMembers } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', blueLabelsWorkspaceId);

  const { data: users } = await supabase
    .from('users')
    .select('id, email')
    .in('id', correctMembers?.map(m => m.user_id) || []);

  console.log('\n📋 Correct Blue Label Labs members:');
  users?.forEach((u, i) => {
    console.log(`   ${i + 1}. ${u.email}`);
  });
}

removeIncorrectMembership().catch(console.error);
