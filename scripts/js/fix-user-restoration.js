/**
 * FIX USER RESTORATION ISSUES
 * ============================
 * Fixes database schema issues and completes user restoration
 * Creates missing organizations and handles column mismatches
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixUserRestoration() {
  console.log('🔧 Fixing user restoration issues...');
  
  try {
    // 1. Create missing 3CubedAI organization
    console.log('\n📋 Creating missing 3CubedAI organization...');
    
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('slug', '3cubed')
      .single();

    let cubedOrgId;
    if (!existingOrg) {
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          id: crypto.randomUUID(),
          name: '3CubedAI',
          slug: '3cubed',
          created_by: 'system_restoration'
        })
        .select()
        .single();

      if (orgError) {
        console.log('❌ Failed to create 3CubedAI organization:', orgError.message);
        return;
      }
      
      cubedOrgId = newOrg.id;
      console.log('✅ Created 3CubedAI organization:', cubedOrgId);

      // Create 3CubedAI workspace
      const { data: newWorkspace, error: workspaceError } = await supabase
        .from('workspaces')
        .insert({
          id: crypto.randomUUID(),
          name: '3CubedAI Workspace',
          slug: '3cubed-workspace',
          organization_id: cubedOrgId,
          owner_id: null
        })
        .select()
        .single();

      if (workspaceError) {
        console.log('❌ Failed to create 3CubedAI workspace:', workspaceError.message);
      } else {
        console.log('✅ Created 3CubedAI workspace:', newWorkspace.id);
      }
    } else {
      cubedOrgId = existingOrg.id;
      console.log('✅ 3CubedAI organization already exists:', cubedOrgId);
    }

    // 2. Check and fix user profiles for restored users
    console.log('\n👤 Fixing user profiles...');
    
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const { data: profileUsers } = await supabase
      .from('users')
      .select('id, email');

    const profileUserIds = new Set(profileUsers?.map(u => u.id) || []);

    for (const authUser of authUsers.users) {
      if (!profileUserIds.has(authUser.id)) {
        console.log(`🔄 Creating missing profile for: ${authUser.email}`);
        
        const metadata = authUser.user_metadata || {};
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            supabase_id: authUser.id,
            email: authUser.email,
            first_name: metadata.first_name || 'User',
            last_name: metadata.last_name || 'Name'
          });

        if (profileError) {
          console.log(`⚠️  Profile creation failed for ${authUser.email}:`, profileError.message);
        } else {
          console.log(`✅ Created profile for ${authUser.email}`);
        }
      }
    }

    // 3. Ensure all users have workspace memberships
    console.log('\n🏢 Ensuring workspace memberships...');
    
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id, name, organization_id');

    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('user_id, workspace_id');

    const membershipMap = new Map();
    memberships?.forEach(m => {
      if (!membershipMap.has(m.user_id)) {
        membershipMap.set(m.user_id, []);
      }
      membershipMap.get(m.user_id).push(m.workspace_id);
    });

    for (const authUser of authUsers.users) {
      const userMemberships = membershipMap.get(authUser.id) || [];
      
      if (userMemberships.length === 0) {
        console.log(`🔄 Adding workspace membership for: ${authUser.email}`);
        
        // Determine workspace based on email domain
        let targetWorkspace;
        const email = authUser.email.toLowerCase();
        
        if (email.includes('innovareai') || email.includes('tl@') || email.includes('cl@')) {
          targetWorkspace = workspaces?.find(w => w.name.includes('InnovareAI'));
        } else if (email.includes('3cubed')) {
          targetWorkspace = workspaces?.find(w => w.name.includes('3CubedAI'));
        } else if (email.includes('wtmatchmaker')) {
          targetWorkspace = workspaces?.find(w => w.name.includes('WT Matchmaker'));
        } else if (email.includes('sendingcell')) {
          targetWorkspace = workspaces?.find(w => w.name.includes('Sendingcell'));
        }

        if (targetWorkspace) {
          const { error: membershipError } = await supabase
            .from('workspace_members')
            .insert({
              workspace_id: targetWorkspace.id,
              user_id: authUser.id,
              role: email.includes('admin@') ? 'admin' : (email.includes('tl@') || email.includes('cl@') || email.includes('sophia@')) ? 'owner' : 'member'
            });

          if (membershipError) {
            console.log(`⚠️  Membership creation failed for ${authUser.email}:`, membershipError.message);
          } else {
            console.log(`✅ Added ${authUser.email} to ${targetWorkspace.name}`);
          }
        }
      }
    }

    // 4. Create remaining 3CubedAI users
    console.log('\n👥 Creating 3CubedAI users...');
    
    const cubedWorkspace = workspaces?.find(w => w.name.includes('3CubedAI'));
    
    if (cubedWorkspace) {
      const cubedUsers = [
        {
          email: 'sophia@3cubed.ai',
          firstName: 'Sophia',
          lastName: 'Caldwell',
          role: 'owner'
        },
        {
          email: 'admin@3cubed.ai',
          firstName: 'Admin',
          lastName: '3Cubed',
          role: 'admin'
        }
      ];

      for (const userData of cubedUsers) {
        // Check if user already exists
        const existingUser = authUsers.users.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
        
        if (!existingUser) {
          console.log(`🔄 Creating ${userData.email}...`);
          
          const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: userData.email,
            password: 'TempPassword123!',
            email_confirm: true,
            user_metadata: {
              first_name: userData.firstName,
              last_name: userData.lastName
            }
          });

          if (authError) {
            console.log(`❌ Failed to create ${userData.email}:`, authError.message);
            continue;
          }

          // Create profile
          await supabase
            .from('users')
            .insert({
              id: authUser.user.id,
              supabase_id: authUser.user.id,
              email: userData.email,
              first_name: userData.firstName,
              last_name: userData.lastName
            });

          // Add to workspace
          await supabase
            .from('workspace_members')
            .insert({
              workspace_id: cubedWorkspace.id,
              user_id: authUser.user.id,
              role: userData.role
            });

          // Set as owner if needed
          if (userData.role === 'owner') {
            await supabase
              .from('workspaces')
              .update({ owner_id: authUser.user.id })
              .eq('id', cubedWorkspace.id);
          }

          console.log(`✅ Created and configured ${userData.email}`);
        } else {
          console.log(`⏭️  ${userData.email} already exists`);
        }
      }
    }

    console.log('\n📊 User restoration fix completed!');

    // Final summary
    const { data: finalUsers } = await supabase.auth.admin.listUsers();
    const { data: finalProfiles } = await supabase.from('users').select('email');
    const { data: finalMemberships } = await supabase.from('workspace_members').select('*');

    console.log(`\n📈 Final Status:`);
    console.log(`👥 Auth users: ${finalUsers.users.length}`);
    console.log(`📝 User profiles: ${finalProfiles?.length || 0}`);
    console.log(`🏢 Workspace memberships: ${finalMemberships?.length || 0}`);

  } catch (error) {
    console.error('❌ Fix restoration failed:', error);
  }
}

fixUserRestoration();