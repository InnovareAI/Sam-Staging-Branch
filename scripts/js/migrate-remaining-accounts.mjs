#!/usr/bin/env node

/**
 * Migrate remaining unmigrated LinkedIn accounts
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

const UNMIGRATED_ACCOUNTS = [
  {
    userId: '6c823b89-52a9-45ff-a74b-46bc2f981e5b', // tl@3cubed.ai
    unipileId: 'fYhum67USvGJl96BmArOSw',
    workspaceId: 'ecb08e55-2b7e-4d49-8f50-d38e39ce2482', // 3cubed
    email: 'tl@3cubed.ai'
  },
  {
    userId: 'f6885ff3-deef-4781-8721-93011c990b1b', // tl@innovareai.com
    unipileId: '727JqVTuQFeoFS4GNnsNxA',
    workspaceId: 'babdcab8-1a78-4b2f-913e-6e9fd9821009', // InnovareAI
    email: 'tl@innovareai.com'
  }
]

async function migrateRemaining() {
  console.log('🔄 Migrating remaining unmigrated accounts...\n')

  for (const account of UNMIGRATED_ACCOUNTS) {
    console.log(`\n📌 Processing: ${account.email} → ${account.unipileId}`)

    // Check if already exists
    const { data: existing } = await supabase
      .from('workspace_accounts')
      .select('id')
      .eq('unipile_account_id', account.unipileId)
      .eq('workspace_id', account.workspaceId)
      .single()

    if (existing) {
      console.log('   ⏭️  Already migrated')
      continue
    }

    // Get from old table
    const { data: oldAccount } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('unipile_account_id', account.unipileId)
      .eq('user_id', account.userId)
      .single()

    if (!oldAccount) {
      console.log('   ❌ Not found in old table')
      continue
    }

    // Insert to workspace_accounts
    const { error } = await supabase
      .from('workspace_accounts')
      .insert({
        workspace_id: account.workspaceId,
        user_id: account.userId,
        unipile_account_id: account.unipileId,
        account_name: oldAccount.account_name || 'LinkedIn Account',
        account_identifier: account.email,
        account_type: 'linkedin',
        connection_status: oldAccount.connection_status === 'active' ? 'connected' : 'disconnected'
      })

    if (error) {
      console.log(`   ❌ Error: ${error.message}`)
    } else {
      console.log('   ✅ Migrated successfully')
    }
  }

  console.log('\n✅ Migration complete')
}

migrateRemaining()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
