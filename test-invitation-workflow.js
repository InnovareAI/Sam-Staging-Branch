#!/usr/bin/env node

// Test script for cross-tenant invitation workflow
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://latxadqrvrrrcvkktrog.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testCrossTenantInvitation() {
  console.log('🧪 Testing cross-tenant invitation workflow...\n');
  
  try {
    // Get all workspaces to understand tenant structure
    const { data: workspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name, slug')
      .order('created_at', { ascending: false });

    if (workspaceError) {
      console.error('❌ Error fetching workspaces:', workspaceError);
      return;
    }

    console.log('📋 Available Workspaces:');
    console.log('='.repeat(60));
    workspaces?.forEach((ws, index) => {
      console.log(`${index + 1}. ${ws.name} (${ws.slug})`);
      console.log(`   ID: ${ws.id}`);
      console.log('   ' + '-'.repeat(40));
    });

    if (!workspaces || workspaces.length < 2) {
      console.log('⚠️ Need at least 2 workspaces to test cross-tenant workflow');
      return;
    }

    const workspace1 = workspaces[0]; // InnovareAI
    const workspace2 = workspaces[1]; // 3cubed

    console.log(`\n🎯 Test Scenario: Invite user to ${workspace1.name}, then try ${workspace2.name}`);
    console.log('='.repeat(80));

    const testEmail = 'cross.tenant.test@example.com';

    // Step 1: Test invitation to first workspace
    console.log(`\n1️⃣ Testing invitation to ${workspace1.name}...`);
    
    const inviteResponse1 = await fetch('http://localhost:3000/api/admin/simple-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        workspaceId: workspace1.id,
        firstName: 'Cross',
        lastName: 'Tenant',
        company: 'InnovareAI',
        role: 'member'
      })
    });

    const result1 = await inviteResponse1.json();
    
    if (inviteResponse1.ok) {
      console.log('✅ First invitation successful:', result1.message);
      console.log(`   User ID: ${result1.user?.id}`);
      console.log(`   Workspace: ${result1.user?.workspace}`);
    } else {
      console.log('❌ First invitation failed:', result1.error);
      return;
    }

    // Step 2: Test invitation to second workspace (should fail due to cross-tenant protection)
    console.log(`\n2️⃣ Testing invitation to ${workspace2.name} (should be blocked)...`);
    
    const inviteResponse2 = await fetch('http://localhost:3000/api/admin/simple-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        workspaceId: workspace2.id,
        firstName: 'Cross',
        lastName: 'Tenant',
        company: '3cubedai',
        role: 'member'
      })
    });

    const result2 = await inviteResponse2.json();
    
    if (inviteResponse2.status === 409) {
      console.log('✅ Cross-tenant protection working correctly!');
      console.log(`   Response: ${result2.error}`);
      console.log(`   Code: ${result2.code}`);
    } else if (inviteResponse2.ok) {
      console.log('⚠️ SECURITY ISSUE: Cross-tenant invitation succeeded when it should have failed!');
      console.log('   This means the safety protocol is not working correctly.');
    } else {
      console.log('❓ Unexpected error:', result2.error);
    }

    // Step 3: Verify database state
    console.log('\n3️⃣ Verifying database state...');
    
    const { data: testUser, error: userError } = await supabase
      .from('workspace_members')
      .select(`
        workspace_id,
        role,
        workspaces!inner(name, slug)
      `)
      .eq('user_id', result1.user?.id);

    if (userError) {
      console.error('❌ Error checking user memberships:', userError);
    } else {
      console.log('👤 User memberships:');
      testUser?.forEach((membership, index) => {
        console.log(`   ${index + 1}. ${membership.workspaces.name} (${membership.role})`);
      });
      
      if (testUser?.length === 1) {
        console.log('✅ User correctly has membership in only one workspace');
      } else {
        console.log(`⚠️ User has ${testUser?.length || 0} memberships - may indicate cross-tenant leak`);
      }
    }

    // Step 4: Clean up test data
    console.log('\n4️⃣ Cleaning up test data...');
    
    if (result1.user?.id) {
      // Delete from workspace_members
      const { error: memberDeleteError } = await supabase
        .from('workspace_members')
        .delete()
        .eq('user_id', result1.user.id);

      if (memberDeleteError) {
        console.warn('⚠️ Failed to clean up workspace membership:', memberDeleteError.message);
      }

      // Delete from users table
      const { error: userDeleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', result1.user.id);

      if (userDeleteError) {
        console.warn('⚠️ Failed to clean up user record:', userDeleteError.message);
      }

      // Delete from auth.users (requires admin API)
      try {
        const { error: authDeleteError } = await supabase.auth.admin.deleteUser(result1.user.id);
        if (authDeleteError) {
          console.warn('⚠️ Failed to clean up auth user:', authDeleteError.message);
        } else {
          console.log('✅ Test data cleaned up successfully');
        }
      } catch (error) {
        console.warn('⚠️ Failed to clean up auth user:', error);
      }
    }

    console.log('\n🏁 Cross-tenant invitation workflow test completed!');
    
  } catch (error) {
    console.error('💥 Test script error:', error);
  }
}

testCrossTenantInvitation();