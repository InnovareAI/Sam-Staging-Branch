/**
 * RESTORE DELETED USERS SCRIPT
 * ============================
 * Restores all users that were accidentally deleted during database operations
 * Creates users for all 4 organizations with proper tenant isolation
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Essential users to restore for each organization
const USERS_TO_RESTORE = [
  // InnovareAI Users
  {
    email: 'tl@innovareai.com',
    firstName: 'Thomas',
    lastName: 'Linssen',
    organization: 'InnovareAI',
    workspace: 'InnovareAI Workspace',
    role: 'owner',
    password: 'TempPassword123!',
    isSuperAdmin: true
  },
  {
    email: 'cl@innovareai.com', 
    firstName: 'Charlie',
    lastName: 'Linssen',
    organization: 'InnovareAI',
    workspace: 'InnovareAI Workspace',
    role: 'owner',
    password: 'TempPassword123!',
    isSuperAdmin: true
  },
  {
    email: 'sp@innovareai.com',
    firstName: 'Sarah',
    lastName: 'Powell',
    organization: 'InnovareAI', 
    workspace: 'InnovareAI Workspace',
    role: 'admin',
    password: 'TempPassword123!',
    isSuperAdmin: false
  },

  // 3CubedAI Users
  {
    email: 'sophia@3cubed.ai',
    firstName: 'Sophia',
    lastName: 'Caldwell',
    organization: '3CubedAI',
    workspace: '3CubedAI Workspace', 
    role: 'owner',
    password: 'TempPassword123!',
    isSuperAdmin: false
  },
  {
    email: 'admin@3cubed.ai',
    firstName: 'Admin',
    lastName: '3Cubed',
    organization: '3CubedAI',
    workspace: '3CubedAI Workspace',
    role: 'admin', 
    password: 'TempPassword123!',
    isSuperAdmin: false
  },

  // WT Matchmaker Users
  {
    email: 'admin@wtmatchmaker.com',
    firstName: 'WT',
    lastName: 'Admin',
    organization: 'WT Matchmaker',
    workspace: 'WT Matchmaker Workspace',
    role: 'owner',
    password: 'TempPassword123!',
    isSuperAdmin: false
  },

  // Sendingcell Users  
  {
    email: 'admin@sendingcell.com',
    firstName: 'Sendingcell',
    lastName: 'Admin', 
    organization: 'Sendingcell',
    workspace: 'Sendingcell Workspace',
    role: 'owner',
    password: 'TempPassword123!',
    isSuperAdmin: false
  }
];

async function restoreDeletedUsers() {
  console.log('🔄 Starting user restoration process...');
  
  try {
    // First, get all existing organizations and workspaces
    const { data: organizations } = await supabase
      .from('organizations')
      .select('id, name, slug');

    const { data: workspaces } = await supabase
      .from('workspaces') 
      .select('id, name, organization_id');

    console.log(`📊 Found ${organizations?.length || 0} organizations, ${workspaces?.length || 0} workspaces`);

    // Check existing users to avoid duplicates
    const { data: existingUsers } = await supabase
      .from('users')
      .select('email, id');

    const existingEmails = new Set(existingUsers?.map(u => u.email.toLowerCase()) || []);
    console.log(`👥 Found ${existingUsers?.length || 0} existing users`);

    let restoredCount = 0;
    let skippedCount = 0;

    for (const userData of USERS_TO_RESTORE) {
      const userEmail = userData.email.toLowerCase();
      
      if (existingEmails.has(userEmail)) {
        console.log(`⏭️  Skipping ${userData.email} - already exists`);
        skippedCount++;
        continue;
      }

      console.log(`\n👤 Restoring user: ${userData.email}`);

      // Find the organization
      const organization = organizations?.find(org => 
        org.name.toLowerCase().includes(userData.organization.toLowerCase())
      );

      if (!organization) {
        console.log(`❌ Organization not found for ${userData.organization}`);
        continue;
      }

      // Find the workspace
      const workspace = workspaces?.find(ws => 
        ws.organization_id === organization.id &&
        ws.name.toLowerCase().includes(userData.workspace.toLowerCase().split(' ')[0])
      );

      if (!workspace) {
        console.log(`❌ Workspace not found for ${userData.workspace}`);
        continue;
      }

      try {
        // Create user in Supabase Auth
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: userData.email,
          password: userData.password,
          email_confirm: true,
          user_metadata: {
            first_name: userData.firstName,
            last_name: userData.lastName,
            organization_id: organization.id,
            workspace_id: workspace.id,
            is_super_admin: userData.isSuperAdmin
          }
        });

        if (authError) {
          console.log(`❌ Auth creation failed for ${userData.email}:`, authError.message);
          continue;
        }

        console.log(`✅ Auth user created: ${authUser.user.id}`);

        // Create user profile
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: authUser.user.id,
            supabase_id: authUser.user.id,
            email: userData.email,
            first_name: userData.firstName,
            last_name: userData.lastName,
            current_workspace_id: workspace.id,
            default_workspace_id: workspace.id
          });

        if (profileError) {
          console.log(`⚠️  Profile creation failed for ${userData.email}:`, profileError.message);
        } else {
          console.log(`✅ User profile created`);
        }

        // Add to workspace
        const { error: membershipError } = await supabase
          .from('workspace_members')
          .insert({
            workspace_id: workspace.id,
            user_id: authUser.user.id,
            role: userData.role,
            invited_by: null
          });

        if (membershipError) {
          console.log(`⚠️  Workspace membership failed for ${userData.email}:`, membershipError.message);
        } else {
          console.log(`✅ Added to workspace as ${userData.role}`);
        }

        // Update workspace owner if role is owner
        if (userData.role === 'owner') {
          await supabase
            .from('workspaces')
            .update({ owner_id: authUser.user.id })
            .eq('id', workspace.id);
          console.log(`✅ Set as workspace owner`);
        }

        restoredCount++;
        console.log(`✅ Successfully restored ${userData.email}`);

      } catch (error) {
        console.log(`❌ Failed to restore ${userData.email}:`, error.message);
      }
    }

    console.log(`\n📊 User Restoration Summary:`);
    console.log(`✅ Restored: ${restoredCount} users`);
    console.log(`⏭️  Skipped: ${skippedCount} users (already existed)`);
    console.log(`📝 Total processed: ${USERS_TO_RESTORE.length} users`);

    // Audit log
    await supabase
      .from('tenant_isolation_audit')
      .insert({
        event_type: 'users_restoration_completed',
        details: {
          restored_count: restoredCount,
          skipped_count: skippedCount,
          total_users: USERS_TO_RESTORE.length,
          restored_at: new Date().toISOString()
        }
      });

    console.log(`\n🎯 All users have been restored with proper tenant isolation!`);

  } catch (error) {
    console.error('❌ User restoration failed:', error);
    process.exit(1);
  }
}

// Run the restoration
restoreDeletedUsers();