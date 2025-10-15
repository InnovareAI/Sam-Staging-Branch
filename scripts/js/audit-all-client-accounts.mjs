#!/usr/bin/env node

/**
 * Audit ALL client accounts to verify correct IDs in workspace_accounts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function auditAllAccounts() {
  console.log('🔍 AUDITING ALL CLIENT ACCOUNTS\n')
  console.log('='.repeat(80))

  // Get all workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, owner_id')
    .order('name')

  console.log(`📊 Found ${workspaces.length} workspaces\n`)

  let totalAccounts = 0
  let issues = []

  for (const workspace of workspaces) {
    console.log(`\n📁 Workspace: ${workspace.name} (${workspace.id})`)
    console.log('-'.repeat(80))

    // Get workspace members
    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id, role')
      .eq('workspace_id', workspace.id)

    console.log(`   👥 Members: ${members.length}`)

    // Get user details
    for (const member of members) {
      const { data: userData } = await supabase.auth.admin.getUserById(member.user_id)
      const userEmail = userData?.user?.email || 'N/A'
      const userName = userData?.user?.user_metadata?.full_name || 'N/A'

      console.log(`\n   👤 User: ${userName} (${userEmail})`)
      console.log(`      User ID: ${member.user_id}`)
      console.log(`      Role: ${member.role}`)

      // Get user's LinkedIn accounts
      const { data: accounts } = await supabase
        .from('workspace_accounts')
        .select('id, unipile_account_id, account_name, connection_status')
        .eq('workspace_id', workspace.id)
        .eq('user_id', member.user_id)
        .eq('account_type', 'linkedin')

      if (!accounts || accounts.length === 0) {
        console.log('      ⚠️  No LinkedIn accounts')
      } else {
        console.log(`      ✅ LinkedIn accounts: ${accounts.length}`)
        accounts.forEach(acc => {
          totalAccounts++
          console.log(`         - ${acc.account_name || 'Unnamed'}`)
          console.log(`           Unipile ID: ${acc.unipile_account_id}`)
          console.log(`           Status: ${acc.connection_status}`)

          // Verify account is not duplicated for other users
          supabase
            .from('workspace_accounts')
            .select('user_id')
            .eq('unipile_account_id', acc.unipile_account_id)
            .then(({ data: duplicates }) => {
              if (duplicates && duplicates.length > 1) {
                issues.push({
                  type: 'DUPLICATE',
                  account: acc.account_name,
                  unipile_id: acc.unipile_account_id,
                  users: duplicates.map(d => d.user_id)
                })
              }
            })
        })
      }

      // Check for orphaned accounts in old table
      const { data: oldAccounts } = await supabase
        .from('user_unipile_accounts')
        .select('unipile_account_id, account_name')
        .eq('user_id', member.user_id)
        .eq('platform', 'LINKEDIN')

      if (oldAccounts && oldAccounts.length > 0) {
        console.log(`      ⚠️  OLD TABLE: ${oldAccounts.length} accounts still in user_unipile_accounts`)
        oldAccounts.forEach(old => {
          // Check if migrated
          const migrated = accounts?.find(a => a.unipile_account_id === old.unipile_account_id)
          if (!migrated) {
            issues.push({
              type: 'NOT_MIGRATED',
              user: userEmail,
              account: old.account_name,
              unipile_id: old.unipile_account_id
            })
            console.log(`         ❌ NOT MIGRATED: ${old.account_name} (${old.unipile_account_id})`)
          } else {
            console.log(`         ✅ Migrated: ${old.account_name}`)
          }
        })
      }
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(80))
  console.log('📊 AUDIT SUMMARY')
  console.log('='.repeat(80))
  console.log(`Total Workspaces: ${workspaces.length}`)
  console.log(`Total LinkedIn Accounts: ${totalAccounts}`)
  console.log(`Issues Found: ${issues.length}`)

  if (issues.length > 0) {
    console.log('\n⚠️  ISSUES DETECTED:\n')
    issues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue.type}:`)
      if (issue.type === 'DUPLICATE') {
        console.log(`   Account: ${issue.account}`)
        console.log(`   Unipile ID: ${issue.unipile_id}`)
        console.log(`   Shared by ${issue.users.length} users: ${issue.users.join(', ')}`)
        console.log('   ❌ VIOLATION: Same account assigned to multiple users!')
      } else if (issue.type === 'NOT_MIGRATED') {
        console.log(`   User: ${issue.user}`)
        console.log(`   Account: ${issue.account}`)
        console.log(`   Unipile ID: ${issue.unipile_id}`)
        console.log('   ⚠️  Account exists in old table but not migrated')
      }
      console.log('')
    })
  } else {
    console.log('\n✅ NO ISSUES - All accounts properly configured')
  }

  console.log('='.repeat(80))
}

auditAllAccounts()
  .then(() => {
    console.log('\n✅ Audit complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Audit error:', error)
    process.exit(1)
  })
