#!/usr/bin/env node

/**
 * CRITICAL: Migrate ALL LinkedIn accounts from user_unipile_accounts to workspace_accounts
 * Ensures complete tenant isolation - each user only uses their OWN accounts
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

async function migrateAllAccounts() {
  console.log('🔄 Migrating ALL LinkedIn accounts to workspace_accounts...\n')
  console.log('⚠️  CRITICAL: Ensuring tenant isolation - users only use their OWN accounts\n')

  // Get ALL accounts from user_unipile_accounts
  const { data: oldAccounts, error: fetchError } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('platform', 'LINKEDIN')

  if (fetchError) {
    console.error('❌ Error fetching accounts:', fetchError)
    return
  }

  console.log(`📊 Found ${oldAccounts.length} LinkedIn accounts in user_unipile_accounts\n`)

  let migrated = 0
  let skipped = 0
  let errors = 0

  for (const account of oldAccounts) {
    console.log(`\n🔍 Processing: ${account.account_name || 'Unnamed'} (${account.unipile_account_id})`)

    // Check if already migrated
    const { data: existing } = await supabase
      .from('workspace_accounts')
      .select('id')
      .eq('unipile_account_id', account.unipile_account_id)
      .single()

    if (existing) {
      console.log('   ⏭️  Already migrated, skipping')
      skipped++
      continue
    }

    // Get user's email for account_identifier
    const { data: userData } = await supabase.auth.admin.getUserById(account.user_id)
    const userEmail = userData?.user?.email

    if (!userEmail) {
      console.log('   ❌ Could not find user email, skipping')
      errors++
      continue
    }

    // Get user's workspace membership to determine workspace_id
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', account.user_id)
      .limit(1)

    if (!memberships || memberships.length === 0) {
      console.log('   ❌ User not member of any workspace, skipping')
      errors++
      continue
    }

    const workspaceId = memberships[0].workspace_id

    // Insert into workspace_accounts
    const { error: insertError } = await supabase
      .from('workspace_accounts')
      .insert({
        workspace_id: workspaceId,
        user_id: account.user_id,
        unipile_account_id: account.unipile_account_id,
        account_name: account.account_name || 'LinkedIn Account',
        account_identifier: userEmail,
        account_type: 'linkedin',
        connection_status: account.connection_status === 'active' ? 'connected' : 'disconnected'
      })

    if (insertError) {
      console.log(`   ❌ Error migrating: ${insertError.message}`)
      errors++
    } else {
      console.log(`   ✅ Migrated to workspace: ${workspaceId}`)
      migrated++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 MIGRATION SUMMARY')
  console.log('='.repeat(60))
  console.log(`✅ Successfully migrated: ${migrated}`)
  console.log(`⏭️  Already migrated (skipped): ${skipped}`)
  console.log(`❌ Errors: ${errors}`)
  console.log(`📈 Total processed: ${oldAccounts.length}`)
  console.log('='.repeat(60))
}

migrateAllAccounts()
  .then(() => {
    console.log('\n✅ Migration complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Migration error:', error)
    process.exit(1)
  })
