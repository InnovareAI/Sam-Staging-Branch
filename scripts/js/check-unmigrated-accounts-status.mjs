#!/usr/bin/env node

/**
 * Check status of unmigrated accounts to see if they're active or duplicates
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function checkUnmigrated() {
  console.log('🔍 Checking unmigrated accounts status...\n')

  // Check tl@3cubed.ai accounts
  console.log('User: tl@3cubed.ai (6c823b89-52a9-45ff-a74b-46bc2f981e5b)')
  console.log('-'.repeat(80))

  const { data: accounts1 } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('user_id', '6c823b89-52a9-45ff-a74b-46bc2f981e5b')
    .eq('platform', 'LINKEDIN')

  accounts1?.forEach(acc => {
    console.log(`\n  Unipile ID: ${acc.unipile_account_id}`)
    console.log(`  Account Name: ${acc.account_name}`)
    console.log(`  Status: ${acc.connection_status}`)
    console.log(`  Created: ${acc.created_at}`)
    console.log(`  Last Activity: ${acc.updated_at}`)
  })

  // Check tl@innovareai.com accounts
  console.log('\n\nUser: tl@innovareai.com (f6885ff3-deef-4781-8721-93011c990b1b)')
  console.log('-'.repeat(80))

  const { data: accounts2 } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('user_id', 'f6885ff3-deef-4781-8721-93011c990b1b')
    .eq('platform', 'LINKEDIN')

  accounts2?.forEach(acc => {
    console.log(`\n  Unipile ID: ${acc.unipile_account_id}`)
    console.log(`  Account Name: ${acc.account_name}`)
    console.log(`  Status: ${acc.connection_status}`)
    console.log(`  Created: ${acc.created_at}`)
    console.log(`  Last Activity: ${acc.updated_at}`)
  })
}

checkUnmigrated()
  .then(() => process.exit(0))
  .catch(console.error)
