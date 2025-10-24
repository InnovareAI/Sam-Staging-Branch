#!/usr/bin/env node
/**
 * Add a user to a workspace with admin privileges
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  const email = process.argv[2];
  const workspaceId = process.argv[3];
  const password = process.argv[4] || 'TempPass123!';

  if (!email || !workspaceId) {
    console.log('\nUsage: node add-user-to-workspace.js <email> <workspace_id> [password]\n');
    console.log('Example: node add-user-to-workspace.js user@example.com abc-123 MyPassword123\n');
    process.exit(0);
  }

  console.log(`\n🔧 Adding user to workspace...\n`);
  console.log(`Email: ${email}`);
  console.log(`Workspace: ${workspaceId}`);
  console.log(`Password: ${password}\n`);

  // Check if workspace exists
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('id', workspaceId)
    .single();

  if (wsError || !workspace) {
    console.error('❌ Workspace not found:', workspaceId);
    process.exit(1);
  }

  console.log(`✓ Workspace found: ${workspace.name}\n`);

  // Check if user exists
  let userId;
  let existingUser = null;
  
  // Try to find user by email
  try {
    const { data: allUsers } = await supabase.auth.admin.listUsers();
    existingUser = allUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
  } catch (err) {
    console.error('⚠️  Error listing users:', err.message);
  }

  if (existingUser) {
    console.log(`✓ User already exists: ${email}`);
    userId = existingUser.id;
    
    // Update password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      { password }
    );
    
    if (updateError) {
      console.error('⚠️  Could not update password:', updateError.message);
    } else {
      console.log(`✓ Password updated\n`);
    }
  } else {
    // Create new user
    console.log(`Creating new user: ${email}`);
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: email.split('@')[0]
      }
    });

    if (createError) {
      console.error('❌ Error creating user:', createError.message);
      process.exit(1);
    }

    userId = newUser.user.id;
    console.log(`✓ User created: ${userId}\n`);

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email,
        full_name: email.split('@')[0],
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      console.error('⚠️  Profile creation warning:', profileError.message);
    } else {
      console.log(`✓ Profile created\n`);
    }
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingMember) {
    // Update to admin
    const { error: updateError } = await supabase
      .from('workspace_members')
      .update({
        role: 'admin',
        updated_at: new Date().toISOString()
      })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('❌ Error updating membership:', updateError.message);
      process.exit(1);
    }
    console.log(`✓ Membership updated to admin\n`);
  } else {
    // Add as new member
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        role: 'admin',
        joined_at: new Date().toISOString()
      });

    if (memberError) {
      console.error('❌ Error adding to workspace:', memberError.message);
      process.exit(1);
    }
    console.log(`✓ Added to workspace as admin\n`);
  }

  console.log('✅ Complete!\n');
  console.log('Login credentials:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Workspace: ${workspace.name}\n`);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  console.log(`🔗 Login URL: ${baseUrl}/login\n`);
}

main().catch(console.error);
