#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function assignWorkspace(email) {
  console.log(`🔧 Assigning workspace for: ${email}\n`);
  
  try {
    // Get user
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('✅ User found:', user.id);
    console.log('   Email:', user.email);
    
    // Get all workspaces for this user
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(id, name)')
      .eq('user_id', user.id);
    
    console.log('\n📊 User workspace memberships:', memberships?.length || 0);
    
    if (!memberships || memberships.length === 0) {
      console.log('❌ User has no workspace memberships');
      
      // Create a default workspace for the user
      console.log('\n🏗️  Creating default workspace...');
      const slug = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
      const { data: newWorkspace, error: createError } = await supabase
        .from('workspaces')
        .insert({
          name: `${user.email}'s Workspace`,
          slug: slug,
          owner_id: user.id
        })
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Failed to create workspace:', createError);
        return;
      }
      
      console.log('✅ Workspace created:', newWorkspace.id);
      
      // Add user as member
      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: newWorkspace.id,
          user_id: user.id,
          role: 'owner'
        });
      
      if (memberError) {
        console.error('❌ Failed to add membership:', memberError);
        return;
      }
      
      console.log('✅ User added as workspace owner');
      
      // Set as current workspace
      const { error: updateError } = await supabase
        .from('users')
        .update({ current_workspace_id: newWorkspace.id })
        .eq('id', user.id);
      
      if (updateError) {
        console.error('❌ Failed to set current workspace:', updateError);
        return;
      }
      
      console.log('✅ Current workspace set:', newWorkspace.id);
      console.log('\n🎉 Workspace setup complete!');
      return;
    }
    
    // User has workspaces, pick the first one
    const firstWorkspace = memberships[0];
    console.log('\n📌 Available workspaces:');
    memberships.forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.workspaces?.name} (${m.workspace_id})`);
    });
    
    // Check current workspace
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();
    
    console.log('\n📍 Current workspace in DB:', userProfile?.current_workspace_id || 'None');
    
    if (!userProfile?.current_workspace_id) {
      console.log('\n🔄 Setting first workspace as current...');
      const { error: updateError } = await supabase
        .from('users')
        .update({ current_workspace_id: firstWorkspace.workspace_id })
        .eq('id', user.id);
      
      if (updateError) {
        console.error('❌ Failed to update workspace:', updateError);
        return;
      }
      
      console.log('✅ Current workspace set to:', firstWorkspace.workspaces?.name);
      console.log('   ID:', firstWorkspace.workspace_id);
    } else {
      console.log('✅ Workspace already assigned');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

const email = process.argv[2] || 'tl@innovareai.com';
assignWorkspace(email).catch(console.error);