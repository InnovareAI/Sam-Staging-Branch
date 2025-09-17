const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testFixedStatus() {
  try {
    console.log('🔍 Testing FIXED LinkedIn status API logic...\n')
    
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

    // NEW LOGIC: Get all integrations, then filter by workspace_id from settings
    const { data: legacyGlobalIntegrations } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'linkedin')
    
    console.log('\n📊 All LinkedIn integrations found:', legacyGlobalIntegrations?.length || 0)
    
    // NEW LOGIC: Filter integrations by workspace from settings
    const legacyWorkspaceIntegrations = legacyGlobalIntegrations?.filter(
      integration => integration.settings?.workspace_id === workspaceId
    ) || []
    
    console.log('📊 Workspace-filtered integrations:', legacyWorkspaceIntegrations?.length || 0)
    
    if (legacyWorkspaceIntegrations.length > 0) {
      console.log('\n✅ Workspace integrations that SHOULD be detected:')
      legacyWorkspaceIntegrations.forEach((integration, idx) => {
        console.log(`  ${idx + 1}. ID: ${integration.id}`)
        console.log(`     Unipile Account: ${integration.credentials?.unipile_account_id}`)
        console.log(`     Name: ${integration.credentials?.account_name}`)
        console.log(`     Status: ${integration.status}`)
        console.log(`     Settings Workspace: ${integration.settings?.workspace_id}`)
        console.log('')
      })
    }

    // NEW LOGIC: Map to workspace accounts with correct workspace_id from settings
    const workspaceAccounts = [
      ...(legacyWorkspaceIntegrations || []).map((row) => ({
        source: 'integrations',
        id: row.id,
        workspace_id: row.settings?.workspace_id || workspaceId,
        user_id: row.user_id,
        account_identifier: row.credentials?.account_email || row.credentials?.linkedin_public_identifier || row.account_identifier,
        account_name: row.credentials?.account_name || row.account_name,
        unipile_account_id: row.credentials?.unipile_account_id,
        connection_status: row.status || 'connected'
      }))
    ]

    const hasWorkspaceConnections = workspaceAccounts && workspaceAccounts.length > 0
    
    console.log('\n🎯 FIXED Frontend status API should return:')
    console.log('  hasWorkspaceConnections:', hasWorkspaceConnections)
    console.log('  has_linkedin:', hasWorkspaceConnections)
    console.log('  workspace_accounts count:', workspaceAccounts.length)
    
    if (hasWorkspaceConnections) {
      console.log('\n🎉 SUCCESS! LinkedIn should now be detected!')
      console.log('\n📋 Detected workspace accounts:')
      workspaceAccounts.forEach((acc, idx) => {
        console.log(`  ${idx + 1}. Source: ${acc.source}`)
        console.log(`     ID: ${acc.id}`)
        console.log(`     Workspace: ${acc.workspace_id}`)
        console.log(`     Unipile Account: ${acc.unipile_account_id}`)
        console.log(`     Name: ${acc.account_name}`)
        console.log(`     Status: ${acc.connection_status}`)
        console.log('')
      })
    } else {
      console.log('\n❌ Still no connections detected')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

testFixedStatus()