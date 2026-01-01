import { createClient } from '@supabase/supabase-js'

async function fixSendingcellTenant() {
  const workspaceId = 'b070d94f-11e2-41d4-a913-cc5a8c017208'

  console.log('🔧 Fixing Sendingcell Workspace tenant...\n')

  // Get current workspace details
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, tenant')
    .eq('id', workspaceId)
    .single()

  if (!workspace) {
    console.error('❌ Workspace not found')
    return
  }

  console.log(`Current workspace: ${workspace.name}`)
  console.log(`Current tenant: ${workspace.tenant || 'N/A'}`)

  // Update tenant to 'sendingcell'
  const { error } = await supabase
    .from('workspaces')
    .update({ tenant: 'sendingcell' })
    .eq('id', workspaceId)

  if (error) {
    console.error('❌ Error updating tenant:', error)
    return
  }

  console.log('\n✅ Tenant updated!')
  console.log(`   ${workspace.name}`)
  console.log(`   Tenant: 3cubed → sendingcell`)
}

fixSendingcellTenant().catch(console.error)
