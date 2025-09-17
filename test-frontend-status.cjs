const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testFrontendStatus() {
  try {
    console.log('🔍 Testing what the frontend LinkedIn status API would return...\n')
    
    // Find the user
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
    
    console.log('👤 User found:', user.id, user.email)
    
    // Get user's current workspace
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()

    if (!userProfile?.current_workspace_id) {
      console.log('❌ No active workspace found')
      return
    }

    const workspaceId = userProfile.current_workspace_id
    console.log('🏢 Active workspace:', workspaceId)

    // Check legacy integrations table (what the status API checks)
    const { data: legacyWorkspaceIntegrations } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'linkedin')
      .eq('workspace_id', workspaceId)

    const { data: legacyGlobalIntegrations } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'linkedin')

    console.log('\n📊 Status API would find:')
    console.log('  Legacy workspace integrations:', legacyWorkspaceIntegrations?.length || 0)
    console.log('  Legacy global integrations:', legacyGlobalIntegrations?.length || 0)
    
    if (legacyGlobalIntegrations?.length > 0) {
      console.log('\n📋 Global integrations details:')
      legacyGlobalIntegrations.forEach((integration, idx) => {
        console.log(`  ${idx + 1}. ID: ${integration.id}`)
        console.log(`     Workspace in settings: ${integration.settings?.workspace_id || 'none'}`)
        console.log(`     Workspace in column: ${integration.workspace_id || 'none'}`)
        console.log(`     Unipile Account: ${integration.credentials?.unipile_account_id}`)
        console.log(`     Status: ${integration.status}`)
        console.log('')
      })
    }

    // Check if there are workspace_accounts table entries (new table)
    const { data: workspaceAccountRows } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('account_type', 'linkedin')

    console.log('📊 New workspace_accounts table entries:', workspaceAccountRows?.length || 0)

    // Simulate the status API logic
    const workspaceAccounts = [
      ...(legacyWorkspaceIntegrations || []).map((row) => ({
        source: 'integrations',
        id: row.id,
        workspace_id: row.workspace_id,
        user_id: row.user_id,
        account_identifier: row.credentials?.account_email || row.credentials?.linkedin_public_identifier || row.account_identifier,
        account_name: row.credentials?.account_name || row.account_name,
        unipile_account_id: row.credentials?.unipile_account_id,
        connection_status: row.status || 'connected'
      })),
      ...(workspaceAccountRows || []).map((row) => ({
        source: 'workspace_accounts',
        id: row.id,
        workspace_id: row.workspace_id,
        user_id: row.user_id,
        account_identifier: row.account_identifier,
        account_name: row.account_name,
        unipile_account_id: row.unipile_account_id,
        connection_status: row.connection_status || 'connected'
      }))
    ]

    const hasWorkspaceConnections = workspaceAccounts && workspaceAccounts.length > 0
    
    console.log('\n🎯 Frontend status API would return:')
    console.log('  hasWorkspaceConnections:', hasWorkspaceConnections)
    console.log('  has_linkedin:', hasWorkspaceConnections)
    console.log('  workspace_accounts count:', workspaceAccounts.length)
    
    if (workspaceAccounts.length > 0) {
      console.log('\n✅ Workspace accounts that would be detected:')
      workspaceAccounts.forEach((acc, idx) => {
        console.log(`  ${idx + 1}. Source: ${acc.source}`)
        console.log(`     ID: ${acc.id}`)
        console.log(`     Unipile Account: ${acc.unipile_account_id}`)
        console.log(`     Name: ${acc.account_name}`)
        console.log('')
      })
    } else {
      console.log('\n❌ No workspace accounts detected - this is why frontend shows no LinkedIn!')
      console.log('\n🔍 Debugging workspace mismatch:')
      
      // Check if the issue is workspace_id mismatch
      legacyGlobalIntegrations?.forEach((integration, idx) => {
        const settingsWorkspace = integration.settings?.workspace_id
        const actualWorkspace = workspaceId
        
        console.log(`Integration ${idx + 1}:`)
        console.log(`  Settings workspace: ${settingsWorkspace}`)
        console.log(`  Current workspace: ${actualWorkspace}`)
        console.log(`  Match: ${settingsWorkspace === actualWorkspace ? 'YES' : 'NO'}`)
        console.log(`  Workspace column: ${integration.workspace_id || 'null'}`)
        console.log('')
      })
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

testFrontendStatus()