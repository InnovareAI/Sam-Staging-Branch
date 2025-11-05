// Add user to workspace
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addMembership() {
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';
  const userEmail = 'tl@innovareai.com';

  console.log('Adding user to workspace...');
  console.log('  User:', userEmail, '(', userId, ')');
  console.log('  Workspace:', workspaceId);

  const { data, error } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      role: 'owner'
    })
    .select();

  if (error) {
    console.error('❌ Failed to add membership:', error);
    return;
  }

  console.log('✅ Successfully added user as workspace owner!');
  console.log('   ', data);

  // Verify
  const { data: verification } = await supabase
    .from('workspace_members')
    .select('role, created_at')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  console.log('\n✅ Verified membership:', verification);
}

addMembership().catch(console.error);
