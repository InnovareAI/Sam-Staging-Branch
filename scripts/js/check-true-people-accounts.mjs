#!/usr/bin/env node

/**
 * Check True People Consulting workspace for LinkedIn accounts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const TRUE_PEOPLE_WORKSPACE_ID = 'dea5a7f2-673c-4429-972d-6ba5fca473fb'

async function checkTruePeople() {
  console.log('🔍 Checking True People Consulting workspace...\n')

  // Get workspace members
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', TRUE_PEOPLE_WORKSPACE_ID)

  console.log(`👥 Members: ${members.length}\n`)

  for (const member of members) {
    const { data: userData } = await supabase.auth.admin.getUserById(member.user_id)
    const userEmail = userData?.user?.email || 'N/A'

    console.log(`\n👤 ${userEmail} (${member.role})`)
    console.log('   User ID:', member.user_id)

    // Check workspace_accounts
    const { data: newAccounts } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', TRUE_PEOPLE_WORKSPACE_ID)
      .eq('user_id', member.user_id)
      .eq('account_type', 'linkedin')

    console.log(`   Workspace Accounts: ${newAccounts?.length || 0}`)
    newAccounts?.forEach(acc => {
      console.log(`      - ${acc.account_name} (${acc.unipile_account_id})`)
    })

    // Check old table
    const { data: oldAccounts } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', member.user_id)
      .eq('platform', 'LINKEDIN')

    if (oldAccounts && oldAccounts.length > 0) {
      console.log(`   Old Table Accounts: ${oldAccounts.length}`)
      oldAccounts.forEach(acc => {
        console.log(`      - ${acc.account_name} (${acc.unipile_account_id})`)
        console.log(`        Status: ${acc.connection_status}`)
        console.log(`        Created: ${acc.created_at}`)
      })
    }
  }

  console.log('\n\n📊 SUMMARY:')
  console.log('If any user needs their LinkedIn account migrated to True People workspace,')
  console.log('please confirm which account should be assigned.')
}

checkTruePeople()
  .then(() => process.exit(0))
  .catch(console.error)
