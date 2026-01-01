import { createClient } from '@supabase/supabase-js'

async function createSamanthaProfile() {
  const userId = '1d1004ef-3cc7-47b3-942d-58c86f0a27c2'
  const email = 'samantha@truepeopleconsulting.com'

  console.log(`🔧 Creating users table profile for ${email}...\n`)

  // Get auth user metadata
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const authUser = authUsers.users.find(u => u.id === userId)

  if (!authUser) {
    console.error('❌ Auth user not found')
    return
  }

  console.log('Auth user metadata:', authUser.user_metadata)

  // Get True People Consulting workspace ID
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('name', 'True People Consulting')
    .single()

  if (!workspace) {
    console.error('❌ Workspace not found')
    return
  }

  console.log(`Workspace: ${workspace.name} (${workspace.id})`)

  // Create user profile
  const { data, error } = await supabase
    .from('users')
    .insert({
      id: userId,
      email: email,
      first_name: authUser.user_metadata?.first_name || 'Samantha',
      last_name: authUser.user_metadata?.last_name || '',
      current_workspace_id: workspace.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    console.error('❌ Error creating profile:', error)
    return
  }

  console.log('\n✅ Created user profile!')
  console.log(JSON.stringify(data, null, 2))
}

createSamanthaProfile().catch(console.error)
