#!/usr/bin/env node
/**
 * Add Dave to Sendingcell workspace
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addDaveToWorkspace() {
  const email = 'dave.stuteville@sendingcell.com';
  const workspaceId = 'b070d94f-11e2-41d4-a913-cc5a8c017208'; // Sendingcell
  
  console.log(`🔧 Adding ${email} to Sendingcell workspace...\n`);

  // Find user
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    process.exit(1);
  }

  const userId = user.id;
  console.log(`✅ Found user: ${user.email} (${userId})\n`);

  // Check if membership already exists
  const { data: existing } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    console.log('✅ User already has workspace membership');
    console.log('   Role:', existing.role);
    process.exit(0);
  }

  // Add workspace membership
  const { error } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      role: 'member',
      joined_at: new Date().toISOString()
    });

  if (error) {
    console.error('❌ Failed to add workspace membership:', error);
    process.exit(1);
  }

  console.log('✅ Successfully added to Sendingcell workspace');
  console.log('   Role: member');
  console.log('\n🎉 Dave can now upload documents to the knowledge base!');
}

addDaveToWorkspace().catch(console.error);
