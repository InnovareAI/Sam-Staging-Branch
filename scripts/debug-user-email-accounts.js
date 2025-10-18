#!/usr/bin/env node

/**
 * Debug script to check why a specific user's email accounts don't show up
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

async function main() {
  const userEmail = 'tl@innovareai.com'
  
  console.log(`🔍 Debugging email accounts for ${userEmail}\n`)

  try {
    // Get user
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const user = users?.find(u => u.email === userEmail)

    if (!user) {
      console.error(`❌ User ${userEmail} not found`)
      return
    }

    console.log(`✅ Found user:`, {
      id: user.id,
      email: user.email
    })

    // Get user's workspace
    const { data: userData } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()

    const workspaceId = userData?.current_workspace_id
    console.log(`\n🏢 Current workspace:`, workspaceId)

    if (!workspaceId) {
      console.error('❌ No workspace found for user')
      return
    }

    // Get ALL workspace_accounts for this workspace
    const { data: allWorkspaceAccounts } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)

    console.log(`\n📊 All workspace_accounts for workspace ${workspaceId}:`)
    console.log(`  Total: ${allWorkspaceAccounts?.length || 0}`)
    
    if (allWorkspaceAccounts) {
      for (const acc of allWorkspaceAccounts) {
        console.log(`  - ${acc.account_type}: ${acc.account_name} (${acc.account_identifier})`)
        console.log(`    Unipile ID: ${acc.unipile_account_id}`)
        console.log(`    User ID: ${acc.user_id}`)
        console.log(`    Status: ${acc.connection_status}`)
        console.log(`    Provider: ${acc.account_metadata?.provider}`)
        console.log('')
      }
    }

    // Get email accounts specifically
    const { data: emailAccounts } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('account_type', 'email')

    console.log(`\n📧 Email accounts in workspace_accounts:`)
    console.log(`  Count: ${emailAccounts?.length || 0}`)
    
    if (emailAccounts) {
      for (const acc of emailAccounts) {
        console.log(`  ✅ ${acc.account_name} (${acc.account_identifier})`)
        console.log(`     Unipile ID: ${acc.unipile_account_id}`)
        console.log(`     Status: ${acc.connection_status}`)
        console.log(`     User: ${acc.user_id}`)
      }
    }

    // Get all Unipile accounts
    const unipileResponse = await callUnipileAPI('accounts')
    const allUnipileAccounts = unipileResponse.items || []
    
    console.log(`\n📡 All Unipile accounts:`)
    console.log(`  Total: ${allUnipileAccounts.length}`)
    
    const emailUnipileAccounts = allUnipileAccounts.filter(acc => {
      const type = (acc.type || '').toUpperCase()
      return type.includes('GOOGLE') || type.includes('OUTLOOK') || type === 'MESSAGING'
    })
    
    console.log(`  Email providers: ${emailUnipileAccounts.length}`)
    for (const acc of emailUnipileAccounts) {
      console.log(`    - ${acc.type}: ${acc.name} (${acc.id})`)
      
      // Check if this Unipile account is in workspace_accounts
      const inWorkspace = allWorkspaceAccounts?.some(wa => wa.unipile_account_id === acc.id)
      console.log(`      In workspace_accounts: ${inWorkspace ? '✅ YES' : '❌ NO'}`)
    }

    // Check user_unipile_accounts association
    const { data: userAssociations } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', user.id)

    console.log(`\n🔗 User account associations (user_unipile_accounts):`)
    console.log(`  Count: ${userAssociations?.length || 0}`)
    
    if (userAssociations) {
      for (const assoc of userAssociations) {
        console.log(`  - ${assoc.platform}: ${assoc.account_name}`)
        console.log(`    Unipile ID: ${assoc.unipile_account_id}`)
        console.log(`    Email: ${assoc.account_email}`)
      }
    }

  } catch (error) {
    console.error('💥 Error:', error.message)
    console.error(error)
    process.exit(1)
  }
}

main()
