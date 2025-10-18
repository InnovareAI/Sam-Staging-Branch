#!/usr/bin/env node

/**
 * Test what the /api/email-providers endpoint actually returns
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

  const url = `https://${unipileDsn}/api/v1/${endpoint}`
  const response = await fetch(url, {
    headers: {
      'X-API-KEY': unipileApiKey,
      'Accept': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`Unipile API error: ${response.status}`)
  }

  return await response.json()
}

async function main() {
  const userEmail = 'tl@innovareai.com'
  
  console.log(`🧪 Testing /api/email-providers logic for ${userEmail}\n`)

  try {
    // Get user
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const user = users?.find(u => u.email === userEmail)

    console.log('👤 User:', user.id, user.email)

    // Get workspace
    const { data: userData } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()

    const workspaceId = userData?.current_workspace_id
    console.log('🏢 Workspace:', workspaceId)

    // Get workspace email accounts (same as API does)
    const { data: workspaceAccounts, error: wsError } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('account_type', 'email')

    console.log('\n📊 Workspace email accounts query result:')
    console.log('  Error:', wsError)
    console.log('  Count:', workspaceAccounts?.length || 0)
    console.log('  Data:', JSON.stringify(workspaceAccounts, null, 2))

    const workspaceAccountIds = new Set(workspaceAccounts?.map(a => a.unipile_account_id) || [])
    console.log('\n🔑 Workspace account IDs:', Array.from(workspaceAccountIds))

    // Get Unipile accounts
    const unipileResponse = await callUnipileAPI('accounts')
    const allAccounts = unipileResponse.items || []
    console.log('\n📡 Unipile accounts:', allAccounts.length, 'total')

    // Filter email accounts (same as API does)
    const emailAccounts = allAccounts
      .filter((account) => {
        const belongsToWorkspace = workspaceAccountIds.has(account.id)
        const accountType = account.type?.toUpperCase() || ''
        const isEmailType = accountType.includes('GOOGLE') || accountType.includes('OUTLOOK') || accountType === 'MESSAGING'
        
        console.log(`  - ${account.id} (${account.type}): workspace=${belongsToWorkspace}, email=${isEmailType}`)
        
        return belongsToWorkspace && isEmailType
      })
      .map((account) => {
        const connectionParams = account.connection_params || {}
        const isConnected = account.sources?.some((source) => source.status === 'OK')

        let providerType = 'email'
        const accountType = account.type?.toUpperCase() || ''
        if (accountType.includes('GOOGLE')) providerType = 'google'
        else if (accountType.includes('OUTLOOK')) providerType = 'microsoft'

        const email = connectionParams.mail?.username ||
                     connectionParams.im?.email ||
                     connectionParams.email ||
                     account.name ||
                     ''

        return {
          id: account.id,
          user_id: user.id,
          provider_type: providerType,
          provider_name: account.name || email || 'Email Account',
          email_address: email,
          status: isConnected ? 'connected' : 'disconnected',
          config: account.connection_params,
          last_sync: account.updated_at,
          created_at: account.created_at,
          updated_at: account.updated_at
        }
      })

    console.log('\n✅ Final response (what modal should see):')
    console.log('  Count:', emailAccounts.length)
    console.log('  Data:', JSON.stringify(emailAccounts, null, 2))

  } catch (error) {
    console.error('💥 Error:', error.message)
    console.error(error)
    process.exit(1)
  }
}

main()
