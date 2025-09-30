#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixWorkspace(email) {
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === email);
  
  if (!user) {
    console.log('❌ User not found');
    return;
  }
  
  console.log('✅ User:', user.email);
  
  // Find existing workspace with slug 'tl'
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('slug', 'tl')
    .single();
  
  if (!workspace) {
    console.log('❌ No workspace found');
    return;
  }
  
  console.log('✅ Found workspace:', workspace.name, workspace.id);
  
  // Add membership
  const { error: memberError } = await supabase
    .from('workspace_members')
    .upsert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: 'owner'
    }, {
      onConflict: 'workspace_id,user_id'
    });
  
  if (memberError) {
    console.log('⚠️ Membership error:', memberError.message);
  } else {
    console.log('✅ Membership set');
  }
  
  // Set as current workspace
  const { error: updateError } = await supabase
    .from('users')
    .update({ current_workspace_id: workspace.id })
    .eq('id', user.id);
  
  if (updateError) {
    console.log('❌ Update error:', updateError.message);
  } else {
    console.log('✅ Current workspace set!');
  }
}

fixWorkspace('tl@innovareai.com').catch(console.error);