import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addUserToBlueLabel() {
  const userEmail = 'tl+bll@innovareai.com';
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  
  console.log('🔍 Finding user...');
  
  // Find user by email
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', userEmail)
    .single();
    
  if (userError || !user) {
    console.error('❌ User not found:', userEmail);
    return;
  }
  
  console.log('✅ Found user:', user.email, user.id);
  
  // Check if already a member
  const { data: existing } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', user.id)
    .eq('workspace_id', workspaceId)
    .single();
    
  if (existing) {
    console.log('ℹ️  User is already a member of Blue Label Labs');
    return;
  }
  
  // Add user to workspace
  console.log('➕ Adding user to Blue Label Labs workspace...');
  const { error: insertError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspaceId,
      user_id: user.id,
      role: 'admin',
      joined_at: new Date().toISOString()
    });
    
  if (insertError) {
    console.error('❌ Failed to add user:', insertError);
    return;
  }
  
  console.log('✅ User added to workspace successfully!');
  
  // Update user's current workspace
  const { error: updateError } = await supabase
    .from('users')
    .update({ current_workspace_id: workspaceId })
    .eq('id', user.id);
    
  if (updateError) {
    console.error('⚠️  Failed to set current workspace:', updateError);
  } else {
    console.log('✅ Set as current workspace');
  }
}

addUserToBlueLabel();
