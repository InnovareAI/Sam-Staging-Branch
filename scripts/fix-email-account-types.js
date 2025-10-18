#!/usr/bin/env node

/**
 * Fix workspace_accounts that were incorrectly saved as 'linkedin' type
 * when they should be 'email' type (Gmail, Outlook, etc.)
 * 
 * This script:
 * 1. Fetches all accounts from Unipile
 * 2. Identifies email provider accounts (GOOGLE, OUTLOOK, MESSAGING, etc.)
 * 3. Updates workspace_accounts where account_type is wrong
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function callUnipileAPI(endpoint) {
  const unipileDsn = process.env.UNIPILE_DSN
  const unipileApiKey = process.env.UNIPILE_API_KEY

  if (!unipileDsn || !unipileApiKey) {
    throw new Error('Unipile credentials not configured')
  }

  const url = `https://${unipileDsn}/api/v1/${endpoint}`
  const response = await fetch(url, {
    headers: {
      'X-API-KEY': unipileApiKey,
      'Accept': 'application/json'
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Unipile API error: ${response.status} - ${errorText}`)
  }

  return await response.json()
}

function isEmailProvider(unipileType) {
  const type = (unipileType || '').toUpperCase()
  return type.includes('GOOGLE') ||
         type.includes('OUTLOOK') ||
         type === 'MESSAGING' ||
         type.includes('MICROSOFT') ||
         type.includes('OFFICE365') ||
         type.includes('GMAIL')
}

async function main() {
  console.log('🔧 Starting email account type correction...\n')

  try {
    // Get all Unipile accounts
    console.log('📡 Fetching accounts from Unipile...')
    const unipileResponse = await callUnipileAPI('accounts')
    const allAccounts = unipileResponse.items || []
    console.log(`✅ Found ${allAccounts.length} total Unipile accounts\n`)

    // Build a map of Unipile account IDs to their types
    const accountTypeMap = new Map()
    const emailAccountIds = []
    
    for (const account of allAccounts) {
      accountTypeMap.set(account.id, account.type)
      if (isEmailProvider(account.type)) {
        emailAccountIds.push(account.id)
        console.log(`📧 Email account detected: ${account.id} (${account.type}) - ${account.name}`)
      }
    }
    console.log(`\n📊 Found ${emailAccountIds.length} email provider accounts in Unipile\n`)

    // Get workspace_accounts that might be miscategorized
    console.log('💾 Checking workspace_accounts table...')
    const { data: workspaceAccounts, error: fetchError } = await supabase
      .from('workspace_accounts')
      .select('*')
      .in('unipile_account_id', emailAccountIds)

    if (fetchError) {
      throw new Error(`Failed to fetch workspace accounts: ${fetchError.message}`)
    }

    console.log(`✅ Found ${workspaceAccounts.length} workspace_accounts entries for email providers\n`)

    // Find accounts with wrong type
    const accountsToFix = []
    for (const wsAccount of workspaceAccounts) {
      if (wsAccount.account_type !== 'email') {
        accountsToFix.push(wsAccount)
        console.log(`❌ Wrong type detected:`, {
          id: wsAccount.id,
          unipile_account_id: wsAccount.unipile_account_id,
          current_type: wsAccount.account_type,
          should_be: 'email',
          account_name: wsAccount.account_name,
          workspace_id: wsAccount.workspace_id,
          user_id: wsAccount.user_id
        })
      }
    }

    if (accountsToFix.length === 0) {
      console.log('✅ All email accounts are correctly categorized!')
      return
    }

    console.log(`\n🔧 Found ${accountsToFix.length} accounts to fix. Proceeding with updates...\n`)

    // Fix each account
    let successCount = 0
    let failCount = 0

    for (const account of accountsToFix) {
      const { error: updateError } = await supabase
        .from('workspace_accounts')
        .update({ account_type: 'email' })
        .eq('id', account.id)

      if (updateError) {
        console.error(`❌ Failed to update account ${account.id}:`, updateError.message)
        failCount++
      } else {
        console.log(`✅ Fixed account ${account.id} (${account.account_name})`)
        successCount++
      }
    }

    console.log(`\n📊 Summary:`)
    console.log(`  ✅ Successfully fixed: ${successCount}`)
    console.log(`  ❌ Failed: ${failCount}`)
    console.log(`  📧 Total email accounts: ${emailAccountIds.length}`)

    if (successCount > 0) {
      console.log('\n✨ Done! Email accounts should now appear in the integration modal.')
    }

  } catch (error) {
    console.error('💥 Error:', error.message)
    process.exit(1)
  }
}

main()
