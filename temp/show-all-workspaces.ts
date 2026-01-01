import { createClient } from '@supabase/supabase-js'

async function showAllWorkspaces() {
  console.log('🔍 Fetching all workspaces...\n')

  // Get all workspaces
  const { data: workspaces, error: wsError } = await supabase
    .from('workspaces')
    .select('id, name, tenant, created_at')
    .order('name')

  if (wsError) {
    console.error('❌ Error fetching workspaces:', wsError)
    return
  }

  console.log(`📊 Found ${workspaces?.length || 0} total workspaces\n`)
  console.log('='.repeat(80))

  // Get all members
  const { data: allMembers } = await supabase
    .from('workspace_members')
    .select('workspace_id, user_id, role, status')

  // Get user details
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const userMap = new Map(authUsers.users.map(u => [u.id, u]))

  const { data: userProfiles } = await supabase
    .from('users')
    .select('id, email, first_name, last_name')
  const profileMap = new Map(userProfiles?.map(p => [p.id, p]) || [])

  // Display each workspace
  workspaces?.forEach((workspace, index) => {
    console.log(`\n${index + 1}. 📋 ${workspace.name}`)
    console.log(`   ID: ${workspace.id}`)
    console.log(`   Tenant: ${workspace.tenant || 'N/A'}`)
    console.log(`   Created: ${workspace.created_at}`)

    // Get members for this workspace
    const members = allMembers?.filter(m => m.workspace_id === workspace.id) || []
    console.log(`   Members: ${members.length}`)

    if (members.length > 0) {
      members.forEach(member => {
        const authUser = userMap.get(member.user_id)
        const profile = profileMap.get(member.user_id)
        const email = authUser?.email || profile?.email || 'Unknown'
        const name = profile?.first_name || authUser?.user_metadata?.first_name || 'N/A'

        console.log(`      • ${email} (${name}) - ${member.role}`)
      })
    } else {
      console.log(`      ⚠️  No members`)
    }

    console.log('   ' + '─'.repeat(76))
  })

  console.log('\n' + '='.repeat(80))
  console.log('\n📊 SUMMARY')
  console.log(`   Total workspaces: ${workspaces?.length || 0}`)
  console.log(`   Total workspace memberships: ${allMembers?.length || 0}`)

  // Workspaces by tenant
  const byTenant = workspaces?.reduce((acc, ws) => {
    const tenant = ws.tenant || 'No tenant'
    acc[tenant] = (acc[tenant] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('\n📁 By tenant:')
  Object.entries(byTenant || {}).forEach(([tenant, count]) => {
    console.log(`   ${tenant}: ${count}`)
  })
}

showAllWorkspaces().catch(console.error)
