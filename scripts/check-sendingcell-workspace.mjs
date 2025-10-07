#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSendingCell() {
  console.log('🔍 Checking SendingCell workspace...\n');

  // Find SendingCell workspace
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*')
    .ilike('name', '%sendingcell%');

  if (!workspaces || workspaces.length === 0) {
    console.log('❌ No SendingCell workspace found\n');
    return;
  }

  console.log(`Found ${workspaces.length} workspace(s):`);
  workspaces.forEach(ws => {
    console.log(`   - ${ws.name} (${ws.id})`);
  });

  const workspace = workspaces[0];
  console.log(`\n📁 Using workspace: ${workspace.name}\n`);

  // Get Jim's membership
  const jimEmail = 'jim.heim@sendingcell.com';
  const { data: jimUser } = await supabase
    .from('users')
    .select('*')
    .eq('email', jimEmail)
    .single();

  if (!jimUser) {
    console.log(`❌ Jim Heim not found in users table\n`);
    return;
  }

  console.log(`👤 Jim Heim:`);
  console.log(`   User ID: ${jimUser.id}`);
  console.log(`   Current Workspace: ${jimUser.current_workspace_id}`);
  console.log(`   Email: ${jimUser.email}\n`);

  // Check workspace membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspace.id)
    .eq('user_id', jimUser.id)
    .single();

  if (membership) {
    console.log(`✅ Jim IS a member of ${workspace.name}`);
    console.log(`   Role: ${membership.role}`);
    console.log(`   Joined: ${membership.created_at}\n`);
  } else {
    console.log(`❌ Jim is NOT a member of ${workspace.name}\n`);
    console.log(`💡 Adding Jim to SendingCell workspace...\n`);

    const { error } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: jimUser.id,
        role: 'owner'
      });

    if (error) {
      console.error(`   ❌ Failed to add membership:`, error);
    } else {
      console.log(`   ✅ Jim added to SendingCell workspace as owner`);
      
      // Update user's current workspace
      const { error: updateError } = await supabase
        .from('users')
        .update({ current_workspace_id: workspace.id })
        .eq('id', jimUser.id);

      if (updateError) {
        console.error(`   ⚠️  Failed to update current workspace:`, updateError);
      } else {
        console.log(`   ✅ Updated Jim's current workspace to SendingCell`);
      }
    }
  }

  // Check auth redirect URLs
  console.log(`\n🔗 Checking Supabase auth configuration...`);
  console.log(`   Make sure these URLs are in Supabase Auth settings:`);
  console.log(`   - https://www.sendingcell.com/**`);
  console.log(`   - https://sendingcell.com/**`);
  console.log(`   - http://localhost:3000/**`);
}

checkSendingCell().catch(console.error);
