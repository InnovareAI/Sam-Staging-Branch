import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addSamanthaToWorkspace() {
  // Get Samantha's user ID
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const samantha = users.find(u => u.email === 'samantha@truepeopleconsulting.com');

  if (!samantha) {
    console.log('❌ Samantha not found');
    return;
  }

  console.log('👤 Found Samantha:', samantha.id);

  // Get True People Consulting workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('name', 'True People Consulting')
    .single();

  console.log('🏢 Found workspace:', workspace.id);

  // Add Samantha to workspace
  const { data: member, error } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: samantha.id,
      role: 'admin'
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error adding member:', error);
    return;
  }

  console.log('✅ Added Samantha to True People Consulting as admin');

  // Update user's current_workspace_id
  const { error: updateError } = await supabase
    .from('users')
    .update({ current_workspace_id: workspace.id })
    .eq('id', samantha.id);

  if (updateError) {
    console.error('⚠️  Error updating current_workspace_id:', updateError);
  } else {
    console.log('✅ Set current_workspace_id');
  }

  console.log('\n✅ DONE - Samantha is now admin of True People Consulting');
}

addSamanthaToWorkspace();
