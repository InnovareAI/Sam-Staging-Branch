import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
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

async function verifyConnection() {
  console.log('🔍 Verifying LinkedIn Connection Status...\n')
  
  try {
    const userId = '2197f460-2078-44b5-9bf8-bbfb2dd5d23c'
    const userEmail = 'tl@innovareai.com'
    
    // 1. Check user workspace status
    console.log('📋 Step 1: Checking user workspace assignment...')
    const { data: user } = await supabase
      .from('users')
      .select('id, email, current_workspace_id')
      .eq('id', userId)
      .single()
    
    console.log(`   User: ${user.email}`)
    console.log(`   Workspace ID: ${user.current_workspace_id}`)
    
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name, slug')
      .eq('id', user.current_workspace_id)
      .single()
    
    console.log(`   Workspace: ${workspace.name} (${workspace.slug})`)
    console.log('   ✅ User has valid workspace\n')
    
    // 2. Check Unipile for LinkedIn accounts
    console.log('📋 Step 2: Checking Unipile for LinkedIn accounts...')
    const unipileData = await callUnipileAPI('accounts')
    const allAccounts = Array.isArray(unipileData) ? unipileData : (unipileData.items || unipileData.accounts || [])
    const linkedInAccounts = allAccounts.filter(acc => acc.type === 'LINKEDIN')
    
    console.log(`   Total accounts in Unipile: ${allAccounts.length}`)
    console.log(`   LinkedIn accounts: ${linkedInAccounts.length}\n`)
    
    if (linkedInAccounts.length === 0) {
      console.log('❌ NO LINKEDIN ACCOUNTS FOUND IN UNIPILE\n')
      return
    }
    
    // 3. Show LinkedIn account details
    console.log('📋 Step 3: LinkedIn Account Details...\n')
    linkedInAccounts.forEach((account, index) => {
      console.log(`   Account ${index + 1}:`)
      console.log(`   - ID: ${account.id}`)
      console.log(`   - Name: ${account.name}`)
      console.log(`   - Created: ${new Date(account.created_at).toLocaleString()}`)
      
      if (account.connection_params?.im) {
        const im = account.connection_params.im
        console.log(`   - Username: ${im.username || 'N/A'}`)
        console.log(`   - Email: ${im.email || 'N/A'}`)
        console.log(`   - Public ID: ${im.publicIdentifier || 'N/A'}`)
        if (im.premiumFeatures) {
          console.log(`   - Premium: ${im.premiumFeatures.join(', ')}`)
        }
      }
      
      if (account.sources && account.sources.length > 0) {
        console.log(`   - Status: ${account.sources[0].status}`)
      }
      console.log()
    })
    
    // 4. Check database associations
    console.log('📋 Step 4: Checking database associations...')
    const { data: userAccounts } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'LINKEDIN')
    
    console.log(`   User associations in DB: ${userAccounts?.length || 0}`)
    
    if (userAccounts && userAccounts.length > 0) {
      userAccounts.forEach((assoc, index) => {
        console.log(`   Association ${index + 1}:`)
        console.log(`   - Unipile Account ID: ${assoc.unipile_account_id}`)
        console.log(`   - Account Name: ${assoc.account_name || 'N/A'}`)
        console.log(`   - Account Email: ${assoc.account_email || 'N/A'}`)
        console.log()
      })
    }
    
    // 5. Check workspace_accounts table
    console.log('📋 Step 5: Checking workspace_accounts...')
    const { data: workspaceAccounts } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', user.current_workspace_id)
      .eq('provider', 'linkedin')
    
    console.log(`   LinkedIn accounts in workspace: ${workspaceAccounts?.length || 0}\n`)
    
    if (workspaceAccounts && workspaceAccounts.length > 0) {
      workspaceAccounts.forEach((acc, index) => {
        console.log(`   Workspace Account ${index + 1}:`)
        console.log(`   - Status: ${acc.status}`)
        console.log(`   - Unipile ID: ${acc.unipile_account_id || 'N/A'}`)
        console.log()
      })
    }
    
    // 6. Summary
    console.log('=' .repeat(70))
    console.log('📊 LINKEDIN CONNECTION SUMMARY')
    console.log('='.repeat(70))
    console.log(`✅ User: ${userEmail}`)
    console.log(`✅ Workspace: ${workspace.name}`)
    console.log(`${linkedInAccounts.length > 0 ? '✅' : '❌'} LinkedIn Accounts in Unipile: ${linkedInAccounts.length}`)
    console.log(`${userAccounts && userAccounts.length > 0 ? '✅' : '⚠️ '} User Associations: ${userAccounts?.length || 0}`)
    console.log(`${workspaceAccounts && workspaceAccounts.length > 0 ? '✅' : '⚠️ '} Workspace Accounts: ${workspaceAccounts?.length || 0}`)
    
    if (linkedInAccounts.length > 0 && linkedInAccounts[0].sources?.[0]?.status === 'OK') {
      console.log('\n🎉 LinkedIn is FULLY CONNECTED and ACTIVE!')
    } else if (linkedInAccounts.length > 0) {
      console.log('\n⚠️  LinkedIn account exists but may need verification')
    } else {
      console.log('\n❌ No LinkedIn connection found')
    }
    console.log('='.repeat(70))
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error)
  }
}

verifyConnection()
