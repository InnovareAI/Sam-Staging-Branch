import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function show3cubedMembers() {
  console.log('🔍 Finding 3cubed workspace members...\n')

  // Find 3cubed workspace
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('id, name, tenant, created_at')
    .eq('name', '3cubed Workspace')
    .single()

  if (wsError || !workspace) {
    console.error('❌ Workspace not found:', wsError?.message)
    return
  }

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

show3cubedMembers().catch(console.error)
