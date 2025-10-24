import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixBlueLabel() {
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  const stanUserId = '6a927440-ebe1-49b4-ae5e-fbee5d27944d';
  
  console.log('🔧 Fixing Blue Label Labs workspace...\n');
  
  // 1. Add Stan as workspace member
  console.log('1️⃣ Adding Stan to workspace...');
  const { data: existingStan } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', stanUserId)
    .single();
    
  if (!existingStan) {
    const { error: stanError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspaceId,
        user_id: stanUserId,
        role: 'admin',
        joined_at: new Date().toISOString()
      });
      
    if (stanError) {
      console.error('   ❌ Failed to add Stan:', stanError.message);
    } else {
      console.log('   ✅ Stan added as admin');
      
      // Set as his current workspace
      await supabase
        .from('users')
        .update({ current_workspace_id: workspaceId })
        .eq('id', stanUserId);
      console.log('   ✅ Set as Stan\'s current workspace');
    }
  } else {
    console.log('   ℹ️  Stan is already a member');
  }
  
  // 2. Verify workspace members (without join to avoid RLS issues)
  console.log('\n2️⃣ Verifying workspace members...');
  const { data: members, error: membersError } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', workspaceId);
    
  if (membersError) {
    console.error('   ❌ Error fetching members:', membersError);
  }
    
  console.log(`   📊 Total members: ${members?.length || 0}`);
  if (members && members.length > 0) {
    for (const m of members) {
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', m.user_id)
        .single();
      console.log(`   • ${user?.email || m.user_id} (${m.role})`);
    }
  }
  
  console.log('\n✅ Blue Label Labs workspace fixed!');
}

fixBlueLabel();
