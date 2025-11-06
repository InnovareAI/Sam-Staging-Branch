require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Target user and workspace from the bug report
const TARGET_USER_EMAIL = 'tl@innovareai.com';
const TARGET_WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
const WORKING_USER_EMAIL = 'cl@innovareai.com'; // For comparison

async function auditUserWorkspaceAccess() {
  console.log('🔍 USER WORKSPACE ACCESS AUDIT');
  console.log('='.repeat(80));
  console.log(`Target User: ${TARGET_USER_EMAIL}`);
  console.log(`Target Workspace: ${TARGET_WORKSPACE_ID}`);
  console.log('='.repeat(80));
  console.log('');

  try {
    // ========================================================================
    // SECTION 1: USER AUTHENTICATION DATA
    // ========================================================================
    console.log('📋 SECTION 1: AUTHENTICATION DATA');
    console.log('-'.repeat(80));

    // Get target user from auth.users
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const targetUser = users.find(u => u.email === TARGET_USER_EMAIL);
    const workingUser = users.find(u => u.email === WORKING_USER_EMAIL);

    if (!targetUser) {
      console.error(`❌ CRITICAL: User ${TARGET_USER_EMAIL} not found in auth.users!`);
      return;
    }

    console.log(`\n✅ Target User Found:`);
    console.log(`   User ID: ${targetUser.id}`);
    console.log(`   Email: ${targetUser.email}`);
    console.log(`   Email Confirmed: ${targetUser.email_confirmed_at ? 'Yes' : 'No'}`);
    console.log(`   Created: ${new Date(targetUser.created_at).toLocaleString()}`);
    console.log(`   Last Sign In: ${targetUser.last_sign_in_at ? new Date(targetUser.last_sign_in_at).toLocaleString() : 'Never'}`);
    console.log(`   User Metadata:`, JSON.stringify(targetUser.user_metadata, null, 2));
    console.log(`   App Metadata:`, JSON.stringify(targetUser.app_metadata, null, 2));

    if (workingUser) {
      console.log(`\n✅ Comparison User Found (${WORKING_USER_EMAIL}):`);
      console.log(`   User ID: ${workingUser.id}`);
      console.log(`   Email: ${workingUser.email}`);
      console.log(`   Email Confirmed: ${workingUser.email_confirmed_at ? 'Yes' : 'No'}`);
    }

    // ========================================================================
    // SECTION 2: WORKSPACE_MEMBERS TABLE (PRIMARY ACCESS CONTROL)
    // ========================================================================
    console.log('\n\n📋 SECTION 2: WORKSPACE_MEMBERS TABLE (PRIMARY ACCESS CONTROL)');
    console.log('-'.repeat(80));

    // Get all workspace_members records for target user
    const { data: targetMemberships, error: targetMemberError } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('user_id', targetUser.id)
      .order('joined_at', { ascending: false });

    if (targetMemberError) {
      console.error(`❌ ERROR fetching workspace_members: ${targetMemberError.message}`);
      console.error(`   Code: ${targetMemberError.code}`);
      console.error(`   Details:`, targetMemberError.details);
    } else {
      console.log(`\n✅ Found ${targetMemberships?.length || 0} workspace membership(s) for ${TARGET_USER_EMAIL}:`);

      if (targetMemberships && targetMemberships.length > 0) {
        targetMemberships.forEach((membership, index) => {
          console.log(`\n   Membership #${index + 1}:`);
          console.log(`      workspace_id: ${membership.workspace_id}`);
          console.log(`      user_id: ${membership.user_id}`);
          console.log(`      role: ${membership.role}`);
          console.log(`      status: ${membership.status}`);
          console.log(`      joined_at: ${new Date(membership.joined_at).toLocaleString()}`);
          console.log(`      linkedin_unipile_account_id: ${membership.linkedin_unipile_account_id || 'N/A'}`);

          if (membership.workspace_id === TARGET_WORKSPACE_ID) {
            console.log(`      ⭐ THIS IS THE TARGET WORKSPACE!`);
          }
        });
      } else {
        console.log(`\n   ⚠️  WARNING: No workspace memberships found!`);
      }
    }

    // Check for target workspace specifically
    const { data: targetWorkspaceMember, error: specificMemberError } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('user_id', targetUser.id)
      .eq('workspace_id', TARGET_WORKSPACE_ID)
      .single();

    console.log(`\n\n🎯 Specific Check: ${TARGET_USER_EMAIL} membership in InnovareAI Workspace:`);
    if (specificMemberError) {
      if (specificMemberError.code === 'PGRST116') {
        console.error(`   ❌ CRITICAL: No workspace_members record found!`);
        console.error(`   This explains the "Access denied to workspace" error!`);
      } else {
        console.error(`   ❌ ERROR: ${specificMemberError.message}`);
      }
    } else if (targetWorkspaceMember) {
      console.log(`   ✅ Record exists:`);
      console.log(`      Role: ${targetWorkspaceMember.role}`);
      console.log(`      Status: ${targetWorkspaceMember.status}`);

      if (targetWorkspaceMember.role !== 'owner') {
        console.log(`      ⚠️  WARNING: Role is not 'owner'`);
      }
      if (targetWorkspaceMember.status !== 'active') {
        console.log(`      ⚠️  WARNING: Status is not 'active'`);
      }
    }

    // Get working user's memberships for comparison
    if (workingUser) {
      const { data: workingMemberships, error: workingMemberError } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('user_id', workingUser.id);

      if (!workingMemberError && workingMemberships) {
        console.log(`\n\n📊 Comparison: ${WORKING_USER_EMAIL} has ${workingMemberships.length} membership(s):`);
        workingMemberships.forEach((membership, index) => {
          console.log(`\n   Membership #${index + 1}:`);
          console.log(`      workspace_id: ${membership.workspace_id}`);
          console.log(`      role: ${membership.role}`);
          console.log(`      status: ${membership.status}`);

          if (membership.workspace_id === TARGET_WORKSPACE_ID) {
            console.log(`      ⭐ THIS IS THE TARGET WORKSPACE!`);
          }
        });
      }
    }

    // ========================================================================
    // SECTION 3: CHECK FOR DEPRECATED WORKSPACE_USERS TABLE
    // ========================================================================
    console.log('\n\n📋 SECTION 3: DEPRECATED WORKSPACE_USERS TABLE CHECK');
    console.log('-'.repeat(80));

    try {
      const { data: deprecatedUsers, error: deprecatedError } = await supabase
        .from('workspace_users')
        .select('*')
        .eq('user_id', targetUser.id)
        .limit(1);

      if (deprecatedError) {
        if (deprecatedError.code === '42P01') {
          console.log(`   ✅ GOOD: workspace_users table does not exist (expected)`);
        } else {
          console.log(`   ℹ️  Error querying workspace_users: ${deprecatedError.message}`);
        }
      } else {
        console.log(`   ⚠️  WARNING: workspace_users table exists! (deprecated)`);
        if (deprecatedUsers && deprecatedUsers.length > 0) {
          console.log(`   Found ${deprecatedUsers.length} record(s) in deprecated table`);
        }
      }
    } catch (error) {
      console.log(`   ✅ workspace_users table not found (expected)`);
    }

    // ========================================================================
    // SECTION 4: WORKSPACE DETAILS
    // ========================================================================
    console.log('\n\n📋 SECTION 4: TARGET WORKSPACE DETAILS');
    console.log('-'.repeat(80));

    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', TARGET_WORKSPACE_ID)
      .single();

    if (workspaceError) {
      console.error(`   ❌ ERROR fetching workspace: ${workspaceError.message}`);
    } else {
      console.log(`\n✅ Workspace Found:`);
      console.log(`   ID: ${workspace.id}`);
      console.log(`   Name: ${workspace.name}`);
      console.log(`   Created: ${new Date(workspace.created_at).toLocaleString()}`);
      console.log(`   Subdomain: ${workspace.subdomain || 'N/A'}`);
      console.log(`   Settings:`, JSON.stringify(workspace.settings, null, 2));
    }

    // Get all members of target workspace
    const { data: allWorkspaceMembers, error: allMembersError } = await supabase
      .from('workspace_members')
      .select('user_id, role, status, joined_at')
      .eq('workspace_id', TARGET_WORKSPACE_ID)
      .order('joined_at', { ascending: true });

    if (!allMembersError && allWorkspaceMembers) {
      console.log(`\n\n👥 All Members of InnovareAI Workspace (${allWorkspaceMembers.length} total):`);

      for (const member of allWorkspaceMembers) {
        const user = users.find(u => u.id === member.user_id);
        console.log(`\n   User: ${user?.email || 'Unknown'}`);
        console.log(`      user_id: ${member.user_id}`);
        console.log(`      role: ${member.role}`);
        console.log(`      status: ${member.status}`);
        console.log(`      joined: ${new Date(member.joined_at).toLocaleString()}`);

        if (member.user_id === targetUser.id) {
          console.log(`      ⭐ THIS IS THE TARGET USER!`);
        }
      }
    }

    // ========================================================================
    // SECTION 5: DATA INTEGRITY CHECKS
    // ========================================================================
    console.log('\n\n📋 SECTION 5: DATA INTEGRITY CHECKS');
    console.log('-'.repeat(80));

    // Check for orphaned workspace_members (user doesn't exist in auth.users)
    console.log('\n🔍 Checking for orphaned workspace_members records...');
    const { data: allMembers } = await supabase
      .from('workspace_members')
      .select('user_id, workspace_id');

    let orphanedCount = 0;
    if (allMembers) {
      for (const member of allMembers) {
        const userExists = users.find(u => u.id === member.user_id);
        if (!userExists) {
          orphanedCount++;
          console.log(`   ⚠️  Orphaned record: user_id=${member.user_id}, workspace_id=${member.workspace_id}`);
        }
      }
      if (orphanedCount === 0) {
        console.log(`   ✅ No orphaned workspace_members records found`);
      } else {
        console.log(`   ⚠️  Found ${orphanedCount} orphaned workspace_members record(s)`);
      }
    }

    // Check for users without any workspace memberships
    console.log('\n🔍 Checking for users without workspace memberships...');
    let usersWithoutWorkspace = 0;
    for (const user of users) {
      const { data: memberships } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (!memberships || memberships.length === 0) {
        usersWithoutWorkspace++;
        console.log(`   ⚠️  User without workspace: ${user.email} (${user.id})`);
      }
    }
    if (usersWithoutWorkspace === 0) {
      console.log(`   ✅ All users have workspace memberships`);
    } else {
      console.log(`   ⚠️  Found ${usersWithoutWorkspace} user(s) without workspace memberships`);
    }

    // Check for duplicate memberships (same user, same workspace, multiple records)
    console.log('\n🔍 Checking for duplicate workspace memberships...');
    // Manual check
    const membershipMap = new Map();
    if (allMembers) {
      for (const member of allMembers) {
        const key = `${member.user_id}-${member.workspace_id}`;
        membershipMap.set(key, (membershipMap.get(key) || 0) + 1);
      }

      let duplicatesFound = false;
      for (const [key, count] of membershipMap.entries()) {
        if (count > 1) {
          duplicatesFound = true;
          const [userId, workspaceId] = key.split('-');
          console.log(`   ⚠️  Duplicate: user_id=${userId}, workspace_id=${workspaceId}, count=${count}`);
        }
      }
      if (!duplicatesFound) {
        console.log(`   ✅ No duplicate memberships found`);
      }
    }

    // Check for null or invalid foreign keys
    console.log('\n🔍 Checking for null or invalid foreign keys...');
    const { data: invalidMembers } = await supabase
      .from('workspace_members')
      .select('*')
      .or('user_id.is.null,workspace_id.is.null');

    if (!invalidMembers || invalidMembers.length === 0) {
      console.log(`   ✅ No null foreign keys found`);
    } else {
      console.log(`   ❌ Found ${invalidMembers.length} record(s) with null foreign keys`);
      invalidMembers.forEach(member => {
        console.log(`      Record ID: ${member.id}, user_id: ${member.user_id || 'NULL'}, workspace_id: ${member.workspace_id || 'NULL'}`);
      });
    }

    // ========================================================================
    // SECTION 6: SCHEMA VERIFICATION
    // ========================================================================
    console.log('\n\n📋 SECTION 6: SCHEMA VERIFICATION');
    console.log('-'.repeat(80));

    console.log('\n🔍 Verifying workspace_members table schema...');

    // Check table structure
    const { data: tableInfo, error: tableError } = await supabase
      .from('workspace_members')
      .select('*')
      .limit(1);

    if (!tableError && tableInfo && tableInfo.length > 0) {
      const sampleRecord = tableInfo[0];
      console.log(`   ✅ Table exists and has the following columns:`);
      Object.keys(sampleRecord).forEach(column => {
        console.log(`      - ${column}: ${typeof sampleRecord[column]}`);
      });
    } else {
      console.log(`   ⚠️  Could not verify table structure`);
    }

    // Expected schema
    const expectedColumns = ['id', 'workspace_id', 'user_id', 'role', 'status', 'joined_at', 'linkedin_unipile_account_id'];
    console.log(`\n   Expected columns: ${expectedColumns.join(', ')}`);

    // ========================================================================
    // SECTION 7: ROOT CAUSE ANALYSIS
    // ========================================================================
    console.log('\n\n📋 SECTION 7: ROOT CAUSE ANALYSIS');
    console.log('-'.repeat(80));

    const issues = [];

    if (!targetWorkspaceMember) {
      issues.push({
        severity: 'CRITICAL',
        issue: 'Missing workspace_members record',
        description: `User ${TARGET_USER_EMAIL} has no record in workspace_members for workspace ${TARGET_WORKSPACE_ID}`,
        impact: 'User cannot access workspace - explains "Access denied" error',
        fix: `INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES ('${TARGET_WORKSPACE_ID}', '${targetUser.id}', 'owner', 'active');`
      });
    } else {
      if (targetWorkspaceMember.status !== 'active') {
        issues.push({
          severity: 'HIGH',
          issue: 'Inactive membership status',
          description: `User's membership status is '${targetWorkspaceMember.status}' instead of 'active'`,
          impact: 'User may be denied access based on status check',
          fix: `UPDATE workspace_members SET status = 'active' WHERE workspace_id = '${TARGET_WORKSPACE_ID}' AND user_id = '${targetUser.id}';`
        });
      }

      if (targetWorkspaceMember.role !== 'owner' && targetWorkspaceMember.role !== 'admin') {
        issues.push({
          severity: 'MEDIUM',
          issue: 'Insufficient role permissions',
          description: `User's role is '${targetWorkspaceMember.role}' but should be 'owner' for full access`,
          impact: 'User may not have permission to create campaigns',
          fix: `UPDATE workspace_members SET role = 'owner' WHERE workspace_id = '${TARGET_WORKSPACE_ID}' AND user_id = '${targetUser.id}';`
        });
      }
    }

    if (issues.length === 0) {
      console.log('\n✅ No data integrity issues found!');
      console.log('   User should have proper workspace access.');
      console.log('   If still seeing "Access denied", check:');
      console.log('   1. RLS policies on workspace_members table');
      console.log('   2. Application code workspace verification logic');
      console.log('   3. Session/authentication token validity');
    } else {
      console.log(`\n❌ Found ${issues.length} data integrity issue(s):\n`);
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. [${issue.severity}] ${issue.issue}`);
        console.log(`   Description: ${issue.description}`);
        console.log(`   Impact: ${issue.impact}`);
        console.log(`   Fix SQL: ${issue.fix}`);
        console.log('');
      });
    }

    // ========================================================================
    // SECTION 8: RECOMMENDATIONS
    // ========================================================================
    console.log('\n\n📋 SECTION 8: RECOMMENDATIONS');
    console.log('-'.repeat(80));

    console.log('\n1. Immediate Actions:');
    if (issues.length > 0) {
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. Execute SQL fix for: ${issue.issue}`);
      });
    } else {
      console.log('   ✅ No immediate actions required for data integrity');
    }

    console.log('\n2. Verification Steps:');
    console.log('   a. After applying fixes, re-run this audit script');
    console.log('   b. Test user login and workspace access');
    console.log('   c. Verify campaign creation works');
    console.log('   d. Check application logs for RLS policy errors');

    console.log('\n3. Code Review:');
    console.log('   a. Review workspace access check logic in:');
    console.log('      - /app/api/campaigns/*/route.ts');
    console.log('      - Middleware authentication');
    console.log('   b. Ensure code queries workspace_members (not workspace_users)');
    console.log('   c. Verify proper error handling for missing memberships');

    console.log('\n4. Monitoring:');
    console.log('   a. Set up alerts for workspace membership creation failures');
    console.log('   b. Add logging for workspace access checks');
    console.log('   c. Create automated data integrity checks (weekly)');

    // ========================================================================
    // FINAL SUMMARY
    // ========================================================================
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 AUDIT COMPLETE');
    console.log('='.repeat(80));
    console.log(`Date: ${new Date().toLocaleString()}`);
    console.log(`Target User: ${TARGET_USER_EMAIL} (${targetUser.id})`);
    console.log(`Target Workspace: ${TARGET_WORKSPACE_ID}`);
    console.log(`Issues Found: ${issues.length}`);
    if (issues.length > 0) {
      console.log(`Severity Breakdown:`);
      const critical = issues.filter(i => i.severity === 'CRITICAL').length;
      const high = issues.filter(i => i.severity === 'HIGH').length;
      const medium = issues.filter(i => i.severity === 'MEDIUM').length;
      if (critical > 0) console.log(`   - CRITICAL: ${critical}`);
      if (high > 0) console.log(`   - HIGH: ${high}`);
      if (medium > 0) console.log(`   - MEDIUM: ${medium}`);
    }
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ FATAL ERROR during audit:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the audit
auditUserWorkspaceAccess();
