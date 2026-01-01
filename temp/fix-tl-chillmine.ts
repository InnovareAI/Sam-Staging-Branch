import { createClient } from '@supabase/supabase-js'

async function fixTLChillmine() {
  const email = 'tl@chillmine.io'

  console.log(`🔧 Fixing ${email}...\n`)

  // Get user
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const user = authUsers.users.find(u => u.email === email)

  if (!user) {
    console.log('❌ User not found')
    return
  }

  console.log(`User ID: ${user.id}`)

  // Check if this is a real user or should be deleted
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  console.log(`Profile exists: ${profile ? 'Yes' : 'No'}`)

  if (profile) {
    console.log(`Current workspace: ${profile.current_workspace_id || 'Not set'}`)
  }

  // Check workspace memberships
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', user.id)

  console.log(`Workspace memberships: ${memberships?.length || 0}\n`)

  if (!memberships || memberships.length === 0) {
    console.log('⚠️  User has no workspace memberships')
    console.log('This appears to be an old/test account')
    console.log('\nShould we delete this user? (It has no workspace access)')

    // Delete the user
    console.log('\nDeleting user...')
    const { error } = await supabase.auth.admin.deleteUser(user.id)

    if (error) {
      console.error('❌ Error deleting user:', error)
    } else {
      console.log('✅ User deleted successfully')
    }
  }
}

fixTLChillmine().catch(console.error)
