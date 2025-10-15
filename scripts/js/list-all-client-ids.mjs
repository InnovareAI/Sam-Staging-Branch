#!/usr/bin/env node

/**
 * List all client LinkedIn account IDs (Unipile IDs) by workspace
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function listAllClientIDs() {
  console.log('📋 CLIENT LINKEDIN ACCOUNT IDs\n')
  console.log('='.repeat(100))

  // Get all workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .order('name')

  for (const workspace of workspaces) {
    console.log(`\n🏢 ${workspace.name}`)
    console.log('-'.repeat(100))

    // Get all LinkedIn accounts in this workspace
    const { data: accounts } = await supabase
      .from('workspace_accounts')
      .select('user_id, unipile_account_id, account_name, connection_status, account_identifier')
      .eq('workspace_id', workspace.id)
      .eq('account_type', 'linkedin')
      .order('account_name')

    if (!accounts || accounts.length === 0) {
      console.log('   No LinkedIn accounts configured\n')
      continue
    }

    for (const account of accounts) {
      // Get user email
      const { data: userData } = await supabase.auth.admin.getUserById(account.user_id)
      const userEmail = userData?.user?.email || account.account_identifier

      console.log(`\n   👤 ${account.account_name}`)
      console.log(`      Email: ${userEmail}`)
      console.log(`      Unipile ID: ${account.unipile_account_id}`)
      console.log(`      Status: ${account.connection_status}`)
      console.log(`      User ID: ${account.user_id}`)
    }
    console.log('')
  }

  console.log('\n' + '='.repeat(100))
  console.log('\n📊 QUICK REFERENCE - UNIPILE IDs BY USER:\n')
  console.log('='.repeat(100))

  // Get all unique users with LinkedIn accounts
  const { data: allAccounts } = await supabase
    .from('workspace_accounts')
    .select('user_id, unipile_account_id, account_name, workspace_id')
    .eq('account_type', 'linkedin')

  // Group by user
  const userMap = new Map()

  for (const account of allAccounts) {
    const { data: userData } = await supabase.auth.admin.getUserById(account.user_id)
    const userEmail = userData?.user?.email || 'N/A'

    if (!userMap.has(account.user_id)) {
      userMap.set(account.user_id, {
        email: userEmail,
        accounts: []
      })
    }

    userMap.get(account.user_id).accounts.push({
      name: account.account_name,
      unipileId: account.unipile_account_id,
      workspaceId: account.workspace_id
    })
  }

  // Print grouped by user
  for (const [userId, data] of userMap) {
    console.log(`\n${data.email}:`)
    data.accounts.forEach(acc => {
      console.log(`   - ${acc.unipileId} (${acc.name})`)
    })
  }

  console.log('\n' + '='.repeat(100))
}

listAllClientIDs()
  .then(() => process.exit(0))
  .catch(console.error)
