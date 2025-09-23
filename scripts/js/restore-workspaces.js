#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🏠 RESTORING WORKSPACES FOR ALL ORGANIZATIONS');
console.log('===========================================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getOrganizations() {
  console.log('🔍 Fetching organizations...');
  
  const { data: organizations, error } = await supabase
    .from('organizations')
    .select('*')
    .order('name');
    
  if (error) {
    console.log('❌ Error fetching organizations:', error.message);
    return [];
  }
  
  console.log(`✅ Found ${organizations.length} organizations:`);
  organizations.forEach(org => {
    console.log(`   • ${org.name} (${org.slug})`);
  });
  
  return organizations;
}

async function getUser() {
  console.log('\n🔍 Fetching user account...');
  
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'tl@innovareai.com')
    .single();
    
  if (error) {
    console.log('❌ Error fetching user:', error.message);
    return null;
  }
  
  console.log('✅ Found user account:');
  console.log(`   • ${users.email} (${users.first_name})`);
  console.log(`   • User ID: ${users.id}`);
  
  return users;
}

async function createWorkspaceForOrganization(organization, user) {
  console.log(`\n🏗️  Creating workspace for ${organization.name}...`);
  
  const workspaceName = `${organization.name} Workspace`;
  const workspaceSlug = `${organization.slug}-workspace`;
  
  try {
    // Create workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert([{
        name: workspaceName,
        slug: workspaceSlug,
        owner_id: user.id,
        organization_id: organization.id,
        settings: {
          timezone: 'America/New_York',
          theme: 'dark',
          email_domain: organization.slug === 'innovareai' ? 'innovareai.com' : 
                       organization.slug === '3cubed' ? '3cubed.ai' : 
                       organization.slug === 'sendingcell' ? 'sendingcell.com' :
                       'example.com'
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();
      
    if (workspaceError) {
      console.log(`❌ Error creating workspace: ${workspaceError.message}`);
      return null;
    }
    
    console.log(`✅ Created workspace: ${workspace.name}`);
    console.log(`   • Workspace ID: ${workspace.id}`);
    console.log(`   • Slug: ${workspace.slug}`);
    
    // Add user as workspace member with admin role
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert([{
        workspace_id: workspace.id,
        user_id: user.id,
        role: 'admin',
        joined_at: new Date().toISOString()
      }]);
      
    if (memberError) {
      console.log(`❌ Error adding user to workspace: ${memberError.message}`);
    } else {
      console.log(`✅ Added ${user.email} as admin to workspace`);
    }
    
    return workspace;
    
  } catch (error) {
    console.log(`❌ Exception creating workspace for ${organization.name}:`, error.message);
    return null;
  }
}

async function verifyWorkspaces() {
  console.log('\n🔍 Verifying created workspaces...');
  
  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select(`
      *,
      organizations (name, slug),
      workspace_members (
        user_id,
        role,
        users (email, first_name)
      )
    `)
    .order('name');
    
  if (error) {
    console.log('❌ Error verifying workspaces:', error.message);
    return;
  }
  
  console.log(`\n✅ VERIFICATION COMPLETE - ${workspaces.length} workspaces created:`);
  workspaces.forEach(workspace => {
    console.log(`\n📁 ${workspace.name}`);
    console.log(`   • ID: ${workspace.id}`);
    console.log(`   • Slug: ${workspace.slug}`);
    console.log(`   • Organization: ${workspace.organizations.name}`);
    console.log(`   • Owner: ${workspace.owner_id}`);
    console.log(`   • Members: ${workspace.workspace_members.length}`);
    
    workspace.workspace_members.forEach(member => {
      console.log(`     - ${member.users.email} (${member.role})`);
    });
  });
}

async function main() {
  try {
    // Get organizations and user
    const organizations = await getOrganizations();
    const user = await getUser();
    
    if (!user) {
      console.log('\n❌ Cannot proceed without user account');
      return;
    }
    
    if (organizations.length === 0) {
      console.log('\n❌ Cannot proceed without organizations');
      return;
    }
    
    console.log(`\n🚀 Creating workspaces for ${organizations.length} organizations...`);
    
    // Create workspace for each organization
    const workspaces = [];
    for (const organization of organizations) {
      const workspace = await createWorkspaceForOrganization(organization, user);
      if (workspace) {
        workspaces.push(workspace);
      }
    }
    
    // Verify all workspaces
    await verifyWorkspaces();
    
    console.log('\n🎉 WORKSPACE RESTORATION COMPLETE!');
    console.log('===================================');
    console.log(`✅ Created ${workspaces.length} workspaces`);
    console.log('✅ All workspaces assigned to tl@innovareai.com as admin');
    console.log('✅ Super Admin panel should now show workspace data');
    console.log('\n🌐 You can now access workspaces at: https://app.meet-sam.com');
    
  } catch (error) {
    console.log('❌ Fatal error:', error.message);
  }
}

main().catch(console.error);