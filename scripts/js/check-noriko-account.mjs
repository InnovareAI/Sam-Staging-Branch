#!/usr/bin/env node

/**
 * Check Noriko Yokoi's account_id in the database
 * Looking for account_id: aJcX-idiQryacq2zOrDs9g
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkNorikoAccount() {
  console.log('🔍 Searching for Noriko Yokoi in 3cubed workspace...\n')

  const targetAccountId = 'aJcX-idiQryacq2zOrDs9g'
  const workspaceName = '3cubed'

  // Find the 3cubed workspace
  console.log('📋 Step 0: Finding 3cubed workspace...')
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, name, created_at')
    .ilike('name', '%3cubed%')
    .single()

  if (workspaceError || !workspace) {
    console.error('❌ Could not find 3cubed workspace:', workspaceError)
    return
  }

  console.log(`✅ Found workspace: ${workspace.name} (ID: ${workspace.id})\n`)

  // Step 1: Find user by name or email
  console.log('📋 Step 1: Searching auth.users table...')
  const { data: users, error: userError } = await supabase.auth.admin.listUsers()

  if (userError) {
    console.error('❌ Error fetching users:', userError)
    return
  }

  const norikoUsers = users.users.filter(u => {
    const fullName = u.user_metadata?.full_name || ''
    const email = u.email || ''
    return fullName.toLowerCase().includes('noriko') ||
           email.toLowerCase().includes('noriko') ||
           email.toLowerCase().includes('yokoi')
  })

  if (norikoUsers.length === 0) {
    console.log('❌ No users found matching "Noriko" or "Yokoi"\n')
  } else {
    console.log(`✅ Found ${norikoUsers.length} user(s):\n`)

    // Check which ones are in the 3cubed workspace
    for (const u of norikoUsers) {
      console.log(`  User ID: ${u.id}`)
      console.log(`  Email: ${u.email}`)
      console.log(`  Name: ${u.user_metadata?.full_name || 'N/A'}`)
      console.log(`  Created: ${u.created_at}`)

      // Check workspace membership
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('role, created_at')
        .eq('workspace_id', workspace.id)
        .eq('user_id', u.id)
        .single()

      if (membership) {
        console.log(`  ✅ Member of 3cubed workspace (role: ${membership.role})`)
      } else {
        console.log(`  ❌ NOT a member of 3cubed workspace`)
      }
      console.log('')
    }
  }

  // Step 2: Check user_unipile_accounts for Noriko
  console.log('📋 Step 2: Checking user_unipile_accounts table...')

  const { data: allAccounts, error: accountsError } = await supabase
    .from('user_unipile_accounts')
    .select('*')

  if (accountsError) {
    console.error('❌ Error fetching Unipile accounts:', accountsError)
    return
  }

  console.log(`📊 Total Unipile accounts in database: ${allAccounts?.length || 0}\n`)

  // Filter accounts for Noriko
  const norikoAccounts = allAccounts?.filter(acc => {
    const name = (acc.account_name || '').toLowerCase()
    const email = (acc.account_email || '').toLowerCase()
    return name.includes('noriko') || name.includes('yokoi') ||
           email.includes('noriko') || email.includes('yokoi')
  }) || []

  if (norikoAccounts.length === 0) {
    console.log('❌ No Unipile accounts found for Noriko\n')
  } else {
    console.log(`✅ Found ${norikoAccounts.length} Unipile account(s) for Noriko:\n`)

    for (const acc of norikoAccounts) {
      console.log(`  Account ID: ${acc.id}`)
      console.log(`  User ID: ${acc.user_id}`)
      console.log(`  Unipile Account ID: ${acc.unipile_account_id}`)
      console.log(`  Account Name: ${acc.account_name || 'N/A'}`)
      console.log(`  Account Email: ${acc.account_email || 'N/A'}`)
      console.log(`  Platform: ${acc.platform}`)
      console.log(`  Status: ${acc.connection_status}`)
      console.log(`  Created: ${acc.created_at}`)

      // Check if it matches the target account_id
      if (acc.unipile_account_id === targetAccountId) {
        console.log(`  ✅ ✅ ✅ MATCH! This account_id matches: ${targetAccountId}`)
      } else {
        console.log(`  ❌ NO MATCH (expected: ${targetAccountId}, got: ${acc.unipile_account_id})`)
      }
      console.log('')
    }
  }

  // Step 3: Check if the target account_id exists anywhere
  console.log(`📋 Step 3: Checking if account_id "${targetAccountId}" exists...`)

  const { data: targetAccount, error: targetError } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('unipile_account_id', targetAccountId)
    .single()

  if (targetError && targetError.code !== 'PGRST116') {
    console.error('❌ Error checking target account:', targetError)
  } else if (!targetAccount) {
    console.log(`❌ Account ID "${targetAccountId}" NOT FOUND in database\n`)
  } else {
    console.log(`✅ Account ID "${targetAccountId}" EXISTS in database:\n`)
    console.log(`  User ID: ${targetAccount.user_id}`)
    console.log(`  Account Name: ${targetAccount.account_name || 'N/A'}`)
    console.log(`  Account Email: ${targetAccount.account_email || 'N/A'}`)
    console.log(`  Platform: ${targetAccount.platform}`)
    console.log(`  Status: ${targetAccount.connection_status}`)

    // Get user details
    if (targetAccount.user_id) {
      const { data: userData } = await supabase.auth.admin.getUserById(targetAccount.user_id)
      if (userData.user) {
        console.log(`\n  ✅ Linked to user:`)
        console.log(`     Email: ${userData.user.email}`)
        console.log(`     Name: ${userData.user.user_metadata?.full_name || 'N/A'}`)
      }
    }
    console.log('')
  }

  // Summary
  console.log('━'.repeat(60))
  console.log('📊 SUMMARY')
  console.log('━'.repeat(60))
  console.log(`Target Account ID: ${targetAccountId}`)
  console.log(`Users named Noriko found: ${norikoUsers.length}`)
  console.log(`Unipile accounts for Noriko: ${norikoAccounts.length}`)
  console.log(`Target account_id exists: ${targetAccount ? '✅ YES' : '❌ NO'}`)

  if (norikoAccounts.length > 0) {
    const match = norikoAccounts.find(acc => acc.unipile_account_id === targetAccountId)
    if (match) {
      console.log(`\n✅ ✅ ✅ CONFIRMED: Noriko Yokoi's account_id MATCHES ${targetAccountId}`)
    } else {
      console.log(`\n❌ MISMATCH: Noriko's account has different account_id(s):`)
      norikoAccounts.forEach(acc => {
        console.log(`   - ${acc.unipile_account_id}`)
      })
    }
  }
  console.log('')
}

checkNorikoAccount()
  .then(() => {
    console.log('✅ Check complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script error:', error)
    process.exit(1)
  })
