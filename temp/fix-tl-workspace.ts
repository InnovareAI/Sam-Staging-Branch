import { createClient } from '@supabase/supabase-js'

async function fixTLWorkspace() {
  console.log('🔧 Finding and fixing tl@innovareai.com workspace...\n')

  // Search for user with email like tl@innov%
  const { data: users } = await supabase
    .from('users')
    .select('*')
    .ilike('email', 'tl@innov%')

  if (!users || users.length === 0) {
    console.log('❌ No users found with email like tl@innov%')
    return
  }

  console.log(`Found ${users.length} user(s):`)
  users.forEach(u => {
    console.log(`  - ${u.email} (${u.id})`)
    console.log(`    Current workspace: ${u.current_workspace_id || 'NONE'}`)
  })

  const user = users[0]
  console.log(`\nWorking with user: ${user.email}`)

  // Check existing memberships
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('*, workspaces(name)')
    .eq('user_id', user.id)

  console.log(`\nCurrent memberships: ${memberships?.length || 0}`)
  memberships?.forEach(m => {
    console.log(`  - Workspace: ${(m.workspaces as any)?.name} (${m.workspace_id})`)
    console.log(`    Role: ${m.role}`)
  })

  // Find InnovareAI workspace
  const { data: innovareWorkspace } = await supabase
    .from('workspaces')
    .select('*')
    .ilike('name', '%innovare%')
    .single()

  if (!innovareWorkspace) {
    console.log('\n❌ InnovareAI workspace not found!')
    return
  }

  console.log(`\n✅ Found InnovareAI workspace: ${innovareWorkspace.name} (${innovareWorkspace.id})`)

  // Check if already a member
  const existingMembership = memberships?.find(m => m.workspace_id === innovareWorkspace.id)

  if (existingMembership) {
    console.log('✅ User is already a member of InnovareAI workspace')
  } else {
    console.log('\n➕ Adding user to InnovareAI workspace...')
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        user_id: user.id,
        workspace_id: innovareWorkspace.id,
        role: 'admin'
      })

    if (memberError) {
      console.error('❌ Error adding membership:', memberError)
      return
    }
    console.log('✅ Added user to workspace')
  }

  // Update current_workspace_id
  if (user.current_workspace_id !== innovareWorkspace.id) {
    console.log('\n🔄 Updating current_workspace_id...')
    const { error: updateError } = await supabase
      .from('users')
      .update({ current_workspace_id: innovareWorkspace.id })
      .eq('id', user.id)

    if (updateError) {
      console.error('❌ Error updating current workspace:', updateError)
      return
    }
    console.log('✅ Updated current workspace')
  }

  console.log('\n✅ ALL DONE! User should now have access to InnovareAI workspace')
  console.log(`\nUser can now sign in at: https://app.meet-sam.com/signin`)
}

fixTLWorkspace().catch(console.error)
