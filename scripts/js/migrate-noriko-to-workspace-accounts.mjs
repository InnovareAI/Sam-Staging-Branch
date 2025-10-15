#!/usr/bin/env node

/**
 * Migrate Noriko's LinkedIn account from user_unipile_accounts to workspace_accounts
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

async function migrateNorikoAccount() {
  const norikoUserId = '567ba664-812c-4bed-8c2f-96113b99f899'
  const norikoEmail = 'ny@3cubed.ai'
  const unipileAccountId = 'aJcX-idiQryacq2zOrDs9g'
  const workspaceId = 'ecb08e55-2b7e-4d49-8f50-d38e39ce2482' // 3cubed workspace

  console.log('🔄 Migrating Noriko\'s LinkedIn account to workspace_accounts...\n')

  // Check if already exists in workspace_accounts
  const { data: existing } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('unipile_account_id', unipileAccountId)
    .single()

  if (existing) {
    console.log('✅ Account already exists in workspace_accounts:')
    console.log(JSON.stringify(existing, null, 2))
    return
  }

  // Get from user_unipile_accounts
  const { data: oldAccount } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('unipile_account_id', unipileAccountId)
    .single()

  if (!oldAccount) {
    console.error('❌ Account not found in user_unipile_accounts')
    return
  }

  console.log('📋 Found account in user_unipile_accounts:')
  console.log(`  Account Name: ${oldAccount.account_name}`)
  console.log(`  Unipile ID: ${oldAccount.unipile_account_id}`)
  console.log(`  User ID: ${oldAccount.user_id}`)
  console.log(`  Workspace ID: ${workspaceId}\n`)

  // Insert into workspace_accounts (using only columns that exist)
  const { data: newAccount, error } = await supabase
    .from('workspace_accounts')
    .insert({
      workspace_id: workspaceId,
      user_id: norikoUserId,
      unipile_account_id: unipileAccountId,
      account_name: oldAccount.account_name || 'Noriko Yokoi, Ph.D.',
      account_identifier: norikoEmail, // Required field
      account_type: 'linkedin',
      connection_status: 'connected'
    })
    .select()
    .single()

  if (error) {
    console.error('❌ Error inserting into workspace_accounts:', error)
    return
  }

  console.log('✅ Successfully migrated account to workspace_accounts:')
  console.log(JSON.stringify(newAccount, null, 2))
}

migrateNorikoAccount()
  .then(() => {
    console.log('\n✅ Migration complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Migration error:', error)
    process.exit(1)
  })
