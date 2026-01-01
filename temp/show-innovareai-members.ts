import { createClient } from '@supabase/supabase-js'

async function showInnovareAIMembers() {
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'

  console.log('📋 InnovareAI Workspace Members\n')

  // Get all members
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role, status, joined_at')
    .eq('workspace_id', workspaceId)
    .order('role', { ascending: false })

  // Get user details
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const userMap = new Map(authUsers.users.map(u => [u.id, u]))

  const { data: userProfiles } = await supabase
    .from('users')
    .select('id, email, first_name, last_name')
  const profileMap = new Map(userProfiles?.map(p => [p.id, p]) || [])

  console.log(`Total members: ${members?.length || 0}\n`)

  members?.forEach((member, index) => {
    const authUser = userMap.get(member.user_id)
    const profile = profileMap.get(member.user_id)
    const email = authUser?.email || profile?.email || 'Unknown'
    const name = profile?.first_name || authUser?.user_metadata?.first_name || 'N/A'

    console.log(`${index + 1}. ${email} (${name})`)
    console.log(`   Role: ${member.role}`)
    console.log(`   Status: ${member.status}`)
    console.log(`   Joined: ${member.joined_at}`)
    console.log()
  })
}

showInnovareAIMembers().catch(console.error)
