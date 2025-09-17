const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testLinkedInStatus() {
  try {
    // Find the user by email
    const { data: users, error: userError } = await supabase.auth.admin.listUsers()
    if (userError) {
      console.error('❌ Failed to list users:', userError)
      return
    }
    
    const user = users.users.find(u => u.email === 'tl@innovareai.com')
    if (!user) {
      console.error('❌ User not found')
      return
    }
    
    console.log('👤 Found user:', user.id, user.email)
    
    // Get user's workspace
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()
    
    const workspaceId = userProfile?.current_workspace_id || user.id
    console.log('🏢 Using workspace:', workspaceId)
    
    // Check LinkedIn integrations
    const { data: linkedinIntegrations } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'linkedin')
    
    console.log('📋 LinkedIn integrations:', linkedinIntegrations?.length || 0)
    
    if (linkedinIntegrations?.length > 0) {
      linkedinIntegrations.forEach((integration, idx) => {
        console.log(`  ${idx + 1}. Account:`, {
          id: integration.id,
          unipile_account_id: integration.credentials?.unipile_account_id,
          account_name: integration.credentials?.account_name,
          status: integration.status,
          workspace_id: integration.settings?.workspace_id
        })
      })
    }
    
    // Check Unipile accounts
    const unipileDsn = process.env.UNIPILE_DSN
    const unipileApiKey = process.env.UNIPILE_API_KEY
    
    if (unipileDsn && unipileApiKey) {
      console.log('\n🔗 Checking Unipile accounts...')
      const unipileUrl = `https://${unipileDsn}/api/v1/accounts`
      const response = await fetch(unipileUrl, {
        headers: {
          'X-API-KEY': unipileApiKey,
          'Accept': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        const linkedinAccounts = data.items?.filter(acc => acc.type === 'LINKEDIN') || []
        
        console.log('📊 Unipile LinkedIn accounts:', linkedinAccounts.length)
        linkedinAccounts.forEach((acc, idx) => {
          console.log(`  ${idx + 1}. Unipile Account:`, {
            id: acc.id,
            name: acc.name,
            status: acc.sources?.[0]?.status || 'unknown',
            email: acc.connection_params?.im?.email || acc.connection_params?.im?.username
          })
        })
        
        // Check if our new account exists
        const newAccount = linkedinAccounts.find(acc => acc.id === 'jOUMUaXJQsSfL0i34rLKXw')
        if (newAccount) {
          console.log('\n✅ New account found in Unipile:', {
            id: newAccount.id,
            name: newAccount.name,
            status: newAccount.sources?.[0]?.status
          })
        } else {
          console.log('\n❌ New account jOUMUaXJQsSfL0i34rLKXw not found in Unipile')
        }
      } else {
        console.error('❌ Unipile API error:', response.status)
      }
    } else {
      console.log('⚠️ Unipile configuration missing')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

testLinkedInStatus()