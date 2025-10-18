#!/usr/bin/env node

/**
 * Remove JF's Gmail account from workspace and Unipile
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function callUnipileAPI(endpoint, method = 'GET', body = null) {
  const unipileDsn = process.env.UNIPILE_DSN
  const unipileApiKey = process.env.UNIPILE_API_KEY

  const url = `https://${unipileDsn}/api/v1/${endpoint}`
  const options = {
    method,
    headers: {
      'X-API-KEY': unipileApiKey,
      'Accept': 'application/json',
      ...(body && { 'Content-Type': 'application/json' })
    },
    ...(body && { body: JSON.stringify(body) })
  }

  const response = await fetch(url, options)
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Unipile API error: ${response.status} - ${errorText}`)
  }

  return method === 'DELETE' ? { success: true } : await response.json()
}

async function main() {
  const jfEmail = 'jf@innovareai.com'
  const jfUnipileAccountId = 'eXWYctjDQHOSNMxVxbdcHA'

  console.log(`🗑️  Removing ${jfEmail} account...\n`)

  try {
    // 1. Remove from workspace_accounts
    console.log('1️⃣  Removing from workspace_accounts...')
    const { data: wsAccount, error: fetchError } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('unipile_account_id', jfUnipileAccountId)
      .single()

    if (fetchError) {
      console.log('⚠️  Account not found in workspace_accounts (might already be removed)')
    } else {
      console.log('   Found:', wsAccount)
      
      const { error: deleteError } = await supabase
        .from('workspace_accounts')
        .delete()
        .eq('id', wsAccount.id)

      if (deleteError) {
        console.error('❌ Failed to delete from workspace_accounts:', deleteError.message)
      } else {
        console.log('✅ Removed from workspace_accounts')
      }
    }

    // 2. Remove from user_unipile_accounts
    console.log('\n2️⃣  Removing from user_unipile_accounts...')
    const { data: userAssocs } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('unipile_account_id', jfUnipileAccountId)

    if (userAssocs && userAssocs.length > 0) {
      for (const assoc of userAssocs) {
        const { error: deleteError } = await supabase
          .from('user_unipile_accounts')
          .delete()
          .eq('id', assoc.id)

        if (deleteError) {
          console.error('❌ Failed to delete association:', deleteError.message)
        } else {
          console.log('✅ Removed association:', assoc.account_name)
        }
      }
    } else {
      console.log('⚠️  No associations found')
    }

    // 3. Delete from Unipile
    console.log('\n3️⃣  Deleting from Unipile...')
    try {
      await callUnipileAPI(`accounts/${jfUnipileAccountId}`, 'DELETE')
      console.log('✅ Deleted from Unipile')
    } catch (error) {
      console.error('❌ Failed to delete from Unipile:', error.message)
    }

    console.log('\n✨ Done! JF\'s Gmail account has been removed.')

  } catch (error) {
    console.error('💥 Error:', error.message)
    process.exit(1)
  }
}

main()
