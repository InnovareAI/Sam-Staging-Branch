#!/usr/bin/env tsx
/**
 * Workspace Integrity Monitor
 *
 * Checks for data integrity issues in workspace associations:
 * - Orphaned workspace memberships (workspace_id doesn't exist in workspaces table)
 * - Users without workspace memberships
 * - Users with current_workspace_id not in their memberships
 * - Workspace members with invalid user_id (no auth.users record)
 *
 * Should be run via cron every 12 hours
 */

import { createClient } from '@supabase/supabase-js'

interface IntegrityIssue {
  type: 'orphaned_membership' | 'no_membership' | 'invalid_current_workspace' | 'invalid_user' | 'missing_profile'
  severity: 'critical' | 'warning' | 'info'
  userId?: string
  email?: string
  workspaceId?: string
  workspaceName?: string
  description: string
}

async function checkWorkspaceIntegrity() {
  console.log('🔍 Workspace Integrity Check')
  console.log(`📅 ${new Date().toISOString()}`)
  console.log('─'.repeat(80))
  console.log()

  const issues: IntegrityIssue[] = []

  try {
    // 1. Get all workspace memberships
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('id, user_id, workspace_id, role, status')

    // 2. Get all workspaces
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id, name')

    // 3. Get all auth users
    const { data: authUsers } = await supabase.auth.admin.listUsers()

    // 4. Get all user profiles
    const { data: userProfiles } = await supabase
      .from('users')
      .select('id, email, current_workspace_id')

    const workspaceMap = new Map(workspaces?.map(w => [w.id, w.name]) || [])
    const authUserMap = new Map(authUsers.users.map(u => [u.id, u.email]) || [])
    const profileMap = new Map(userProfiles?.map(p => [p.id, p]) || [])

    console.log('📊 Data Summary:')
    console.log(`   Workspace Memberships: ${memberships?.length || 0}`)
    console.log(`   Workspaces: ${workspaces?.length || 0}`)
    console.log(`   Auth Users: ${authUsers.users.length}`)
    console.log(`   User Profiles: ${userProfiles?.length || 0}`)
    console.log()

    // Check 1: Orphaned workspace memberships
    console.log('🔎 Check 1: Orphaned Workspace Memberships')
    memberships?.forEach(membership => {
      if (!workspaceMap.has(membership.workspace_id)) {
        const email = authUserMap.get(membership.user_id) || 'Unknown'
        issues.push({
          type: 'orphaned_membership',
          severity: 'critical',
          userId: membership.user_id,
          email,
          workspaceId: membership.workspace_id,
          description: `User ${email} has membership to non-existent workspace ${membership.workspace_id}`
        })
      }
    })
    console.log(issues.filter(i => i.type === 'orphaned_membership').length > 0
      ? `   ❌ Found ${issues.filter(i => i.type === 'orphaned_membership').length} orphaned memberships`
      : '   ✅ No orphaned memberships found')

    // Check 2: Invalid user references in memberships
    console.log('🔎 Check 2: Invalid User References')
    memberships?.forEach(membership => {
      if (!authUserMap.has(membership.user_id)) {
        issues.push({
          type: 'invalid_user',
          severity: 'critical',
          userId: membership.user_id,
          workspaceId: membership.workspace_id,
          workspaceName: workspaceMap.get(membership.workspace_id),
          description: `Workspace "${workspaceMap.get(membership.workspace_id)}" has membership for non-existent user ${membership.user_id}`
        })
      }
    })
    console.log(issues.filter(i => i.type === 'invalid_user').length > 0
      ? `   ❌ Found ${issues.filter(i => i.type === 'invalid_user').length} invalid user references`
      : '   ✅ No invalid user references found')

    // Check 3: Users without workspace memberships
    console.log('🔎 Check 3: Users Without Workspace Memberships')
    authUsers.users.forEach(user => {
      const hasMembership = memberships?.some(m => m.user_id === user.id)
      if (!hasMembership) {
        issues.push({
          type: 'no_membership',
          severity: 'warning',
          userId: user.id,
          email: user.email,
          description: `User ${user.email} has no workspace memberships`
        })
      }
    })
    console.log(issues.filter(i => i.type === 'no_membership').length > 0
      ? `   ⚠️  Found ${issues.filter(i => i.type === 'no_membership').length} users without memberships`
      : '   ✅ All users have workspace memberships')

    // Check 4: Users without profiles
    console.log('🔎 Check 4: Users Without Profiles')
    authUsers.users.forEach(user => {
      if (!profileMap.has(user.id)) {
        issues.push({
          type: 'missing_profile',
          severity: 'warning',
          userId: user.id,
          email: user.email,
          description: `User ${user.email} has no profile in users table`
        })
      }
    })
    console.log(issues.filter(i => i.type === 'missing_profile').length > 0
      ? `   ⚠️  Found ${issues.filter(i => i.type === 'missing_profile').length} users without profiles`
      : '   ✅ All users have profiles')

    // Check 5: Invalid current_workspace_id
    console.log('🔎 Check 5: Invalid Current Workspace References')
    userProfiles?.forEach(profile => {
      if (profile.current_workspace_id) {
        const hasMembership = memberships?.some(m =>
          m.user_id === profile.id && m.workspace_id === profile.current_workspace_id
        )
        if (!hasMembership) {
          const email = authUserMap.get(profile.id) || profile.email || 'Unknown'
          issues.push({
            type: 'invalid_current_workspace',
            severity: 'warning',
            userId: profile.id,
            email,
            workspaceId: profile.current_workspace_id,
            workspaceName: workspaceMap.get(profile.current_workspace_id),
            description: `User ${email} has current_workspace_id set to workspace they're not a member of`
          })
        }
      }
    })
    console.log(issues.filter(i => i.type === 'invalid_current_workspace').length > 0
      ? `   ⚠️  Found ${issues.filter(i => i.type === 'invalid_current_workspace').length} invalid current workspace references`
      : '   ✅ All current workspace references are valid')

    console.log()
    console.log('─'.repeat(80))

    // Summary
    const criticalIssues = issues.filter(i => i.severity === 'critical')
    const warningIssues = issues.filter(i => i.severity === 'warning')

    if (issues.length === 0) {
      console.log('✅ ALL CHECKS PASSED - No integrity issues found!')
      return { success: true, issues: [] }
    }

    console.log('⚠️  INTEGRITY ISSUES DETECTED')
    console.log()
    console.log(`🔴 Critical Issues: ${criticalIssues.length}`)
    console.log(`🟡 Warnings: ${warningIssues.length}`)
    console.log()

    if (criticalIssues.length > 0) {
      console.log('🔴 CRITICAL ISSUES:')
      criticalIssues.forEach((issue, i) => {
        console.log(`\n${i + 1}. ${issue.type.toUpperCase()}`)
        console.log(`   ${issue.description}`)
        if (issue.email) console.log(`   Email: ${issue.email}`)
        if (issue.userId) console.log(`   User ID: ${issue.userId}`)
        if (issue.workspaceName) console.log(`   Workspace: ${issue.workspaceName}`)
        if (issue.workspaceId) console.log(`   Workspace ID: ${issue.workspaceId}`)
      })
    }

    if (warningIssues.length > 0) {
      console.log('\n🟡 WARNINGS:')
      warningIssues.forEach((issue, i) => {
        console.log(`\n${i + 1}. ${issue.type.toUpperCase()}`)
        console.log(`   ${issue.description}`)
        if (issue.email) console.log(`   Email: ${issue.email}`)
      })
    }

    console.log()
    console.log('─'.repeat(80))
    console.log('⚠️  ACTION REQUIRED: Please review and fix these issues')

    return { success: false, issues }

  } catch (error) {
    console.error('❌ Error during integrity check:', error)
    return { success: false, error, issues: [] }
  }
}

// Run the check
checkWorkspaceIntegrity()
  .then(result => {
    process.exit(result.success ? 0 : 1)
  })
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
