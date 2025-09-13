#!/usr/bin/env node

// Direct debug script to check current workspaces/organizations in the database
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://latxadqrvrrrcvkktrog.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function debugWorkspaces() {
  console.log('🔍 Debugging workspace IDs in database...');
  
  try {
    // Get all organizations
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: true });

    if (orgError) {
      console.error('❌ Error fetching organizations:', orgError);
      return;
    }

    console.log('\n📋 Current Organizations:');
    console.log('='.repeat(80));
    
    if (!organizations || organizations.length === 0) {
      console.log('⚠️  No organizations found in database!');
    } else {
      organizations.forEach((org, index) => {
        console.log(`${index + 1}. ${org.name}`);
        console.log(`   ID: ${org.id}`);
        console.log(`   Slug: ${org.slug || 'N/A'}`);
        console.log(`   Created: ${new Date(org.created_at).toLocaleString()}`);
        console.log('   ' + '-'.repeat(50));
      });
    }

    // Check for workspace_members table
    const { data: workspaceMembers, error: membersError } = await supabase
      .from('workspace_members')
      .select('workspace_id, user_id, role')
      .limit(10);

    if (membersError) {
      console.log('⚠️  Could not check workspace_members:', membersError.message);
    } else {
      console.log('\n👥 Sample Workspace Member Mappings:');
      console.log('='.repeat(80));
      
      if (!workspaceMembers || workspaceMembers.length === 0) {
        console.log('⚠️  No workspace_members entries found!');
      } else {
        workspaceMembers.forEach((entry, index) => {
          console.log(`${index + 1}. Workspace: ${entry.workspace_id}, User: ${entry.user_id}, Role: ${entry.role}`);
        });
      }
    }
    
    // Check for users table
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, current_workspace_id, default_workspace_id')
      .limit(5);

    if (userError) {
      console.log('⚠️  Could not check users:', userError.message);
    } else {
      console.log('\n👤 Sample Users and their Workspace References:');
      console.log('='.repeat(80));
      
      if (!users || users.length === 0) {
        console.log('⚠️  No users found!');
      } else {
        users.forEach((user, index) => {
          console.log(`${index + 1}. ${user.email}`);
          console.log(`   Current Workspace: ${user.current_workspace_id || 'None'}`);
          console.log(`   Default Workspace: ${user.default_workspace_id || 'None'}`);
          console.log('   ' + '-'.repeat(30));
        });
      }
    }

    // Specific check for the problematic UUID
    const problematicId = '550e8400-e29b-41d4-a716-446655440000';
    const { data: problemCheck, error: problemError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', problematicId);

    // Check if there's a separate workspaces table
    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspaces')
      .select('*');

    if (workspacesError) {
      console.log('\n⚠️  Could not check workspaces table:', workspacesError.message);
    } else {
      console.log('\n🏢 Workspaces Table:');
      console.log('='.repeat(80));
      
      if (!workspaces || workspaces.length === 0) {
        console.log('⚠️  No workspaces found!');
      } else {
        workspaces.forEach((workspace, index) => {
          console.log(`${index + 1}. ${workspace.name}`);
          console.log(`   ID: ${workspace.id}`);
          console.log(`   Organization: ${workspace.organization_id || 'N/A'}`);
          console.log(`   Owner: ${workspace.owner_id || 'N/A'}`);
          console.log(`   Created: ${new Date(workspace.created_at).toLocaleString()}`);
          console.log('   ' + '-'.repeat(50));
        });
      }
    }

    console.log('\n🔍 Checking for problematic UUID:', problematicId);
    console.log('='.repeat(80));
    
    if (problemError) {
      console.log('❌ Error checking problematic ID:', problemError.message);
    } else if (!problemCheck || problemCheck.length === 0) {
      console.log('✅ Problematic UUID does NOT exist in database (good!)');
    } else {
      console.log('⚠️  Problematic UUID FOUND in database:', problemCheck);
    }

    // Check workspace consistency
    console.log('\n🔍 Workspace ID Consistency Check:');
    console.log('='.repeat(80));
    
    const actualWorkspaceId = 'c86ecbcf-a28d-445d-b030-485804c9255d';
    const { data: workspaceCheck, error: workspaceCheckError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', actualWorkspaceId)
      .single();

    if (workspaceCheckError) {
      console.log('❌ Actual workspace ID not found in workspaces table:', workspaceCheckError.message);
    } else {
      console.log('✅ Found actual workspace:', workspaceCheck);
    }

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

debugWorkspaces();