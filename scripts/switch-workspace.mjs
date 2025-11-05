// Switch user's current workspace to Blue Label Labs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function switchWorkspace() {
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';
  const targetWorkspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08'; // Blue Label Labs

  console.log('🔄 Switching workspace...\n');

  const { data, error } = await supabase
    .from('users')
    .update({ current_workspace_id: targetWorkspaceId })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('❌ Failed:', error);
    return;
  }

  console.log('✅ Workspace switched to Blue Label Labs');
  console.log(`   User: tl@innovareai.com`);
  console.log(`   New workspace: ${targetWorkspaceId}`);
  console.log('\n🔄 Now refresh app.meet-sam.com and check Data Approval');
}

switchWorkspace().catch(console.error);
