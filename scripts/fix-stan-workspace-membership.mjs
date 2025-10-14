import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STAN_USER_ID = '6a927440-ebe1-49b4-ae5e-fbee5d27944d';
const BLUE_LABEL_WORKSPACE_ID = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

async function fixStanMembership() {
  console.log('🔧 Fixing Stan Bournev\'s Workspace Membership...\n');

  // Check current state
  console.log('📊 Current State:');
  const { data: currentMembership } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', STAN_USER_ID)
    .eq('workspace_id', BLUE_LABEL_WORKSPACE_ID)
    .single();

  if (currentMembership) {
    console.log('✅ Stan is already a member of Blue Label Labs workspace');
    console.log(`   Role: ${currentMembership.role}`);
    return;
  }

  console.log('❌ Stan is NOT a member of Blue Label Labs workspace');
  console.log('');

  // Add Stan as admin of his workspace
  console.log('🔧 Adding Stan as admin to Blue Label Labs workspace...');
  const { data: newMember, error } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: BLUE_LABEL_WORKSPACE_ID,
      user_id: STAN_USER_ID,
      role: 'admin'
    })
    .select()
    .single();

  if (error) {
    console.log('❌ Error adding membership:', error.message);
    return;
  }

  console.log('✅ Successfully added Stan to Blue Label Labs workspace!');
  console.log(`   Role: ${newMember.role}`);
  console.log('');

  // Update Stan's current_workspace_id
  console.log('🔧 Setting Blue Label Labs as Stan\'s current workspace...');
  const { data: updatedUser } = await supabase
    .from('users')
    .update({ current_workspace_id: BLUE_LABEL_WORKSPACE_ID })
    .eq('id', STAN_USER_ID)
    .select()
    .single();

  if (updatedUser) {
    console.log('✅ Updated Stan\'s current workspace');
  }
  console.log('');

  // Verify final state
  console.log('✅ Final State:');
  const { data: finalMembership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(name)')
    .eq('user_id', STAN_USER_ID)
    .eq('workspace_id', BLUE_LABEL_WORKSPACE_ID)
    .single();

  console.log(`   Workspace: ${finalMembership.workspaces.name}`);
  console.log(`   Role: ${finalMembership.role}`);
  console.log('');

  console.log('🎉 Stan can now run LinkedIn searches in Blue Label Labs workspace!');
}

fixStanMembership();
