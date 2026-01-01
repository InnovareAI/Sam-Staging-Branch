import { createClient } from '@supabase/supabase-js';

async function setDefaultWorkspace() {
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'; // InnovareAI workspace with 40 prospects

  console.log('\n🔧 Setting default workspace for tl@innovareai.com...\n');

  // Update user's current_workspace_id
  const { data, error } = await supabase
    .from('users')
    .update({ current_workspace_id: workspaceId })
    .eq('id', userId)
    .select();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Default workspace set!');
  console.log('   User ID:', userId);
  console.log('   Workspace ID:', workspaceId);
  console.log('\n👉 Now refresh your browser and the Data Approval tab should load automatically!\n');
}

setDefaultWorkspace();
