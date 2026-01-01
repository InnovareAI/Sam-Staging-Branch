import { createClient } from '@supabase/supabase-js'

async function showTGWMembers() {
  console.log('🔍 Searching for TGW-related workspace...\n')

  // Search for workspaces containing "tgw" (case-insensitive)
  const { data: workspaces, error: wsError } = await supabase
    .from('workspaces')
    .select('id, name, tenant, created_at')
    .or('name.ilike.%tgw%,tenant.ilike.%tgw%')

  if (wsError) {
    console.error('❌ Error searching workspaces:', wsError)
    return
  }

  if (!workspaces || workspaces.length === 0) {
    console.log('❌ No workspace found matching "TGW"\n')
    console.log('Searching for WT Matchmaker Workspace instead...\n')

    // Try WT Matchmaker
    const { data: wtWorkspace } = await supabase
      .from('workspaces')
      .select('id, name, tenant, created_at')
      .eq('name', 'WT Matchmaker Workspace')
      .single()

    if (wtWorkspace) {
      workspaces.push(wtWorkspace)
    } else {
      console.log('❌ WT Matchmaker Workspace not found either\n')
      console.log('Available workspaces:')
      const { data: allWorkspaces } = await supabase
        .from('workspaces')
        .select('name, tenant')
        .order('name')

      allWorkspaces?.forEach((ws, i) => {
        console.log(`   ${i + 1}. ${ws.name} (${ws.tenant || 'N/A'})`)
      })
      return
    }
  }

  const workspace = workspaces[0]

  console.log(`📋 Workspace: ${workspace.name}`)
  console.log(`   ID: ${workspace.id}`)
  console.log(`   Tenant: ${workspace.tenant || 'N/A'}`)
  console.log(`   Created: ${workspace.created_at}\n`)

  // Get all members
  const { data: members, error: memberError } = await supabase
    .from('workspace_members')
    .select('user_id, role, status, joined_at')
    .eq('workspace_id', workspace.id)

  if (memberError) {
    console.error('❌ Error fetching members:', memberError)
    return
  }

  console.log(`👥 Found ${members?.length || 0} members:\n`)

  // Get user details for each member
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const userMap = new Map(authUsers.users.map(u => [u.id, u]))

  // Get users table data
  const { data: userProfiles } = await supabase
    .from('users')
    .select('id, email, first_name, last_name')

  const profileMap = new Map(userProfiles?.map(p => [p.id, p]) || [])

  members?.forEach((member, index) => {
    const authUser = userMap.get(member.user_id)
    const profile = profileMap.get(member.user_id)

    console.log(`${index + 1}. ${'─'.repeat(75)}`)
    console.log(`   Email: ${authUser?.email || profile?.email || 'Unknown'}`)
    console.log(`   Name: ${profile?.first_name || authUser?.user_metadata?.first_name || 'N/A'} ${profile?.last_name || authUser?.user_metadata?.last_name || ''}`.trim())
    console.log(`   User ID: ${member.user_id}`)
    console.log(`   Role: ${member.role}`)
    console.log(`   Status: ${member.status}`)
    console.log(`   Joined: ${member.joined_at}`)
  })

  console.log('\n' + '='.repeat(80))
  console.log(`\n📊 Summary: ${members?.length || 0} total members`)

  const roleCount = members?.reduce((acc, m) => {
    acc[m.role] = (acc[m.role] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('\n👤 By role:')
  Object.entries(roleCount || {}).forEach(([role, count]) => {
    console.log(`   ${role}: ${count}`)
  })
}

showTGWMembers().catch(console.error)
