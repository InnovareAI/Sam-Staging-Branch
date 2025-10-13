import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function fixSamanthaWorkspace() {
  const email = 'samantha@truepeopleconsulting.com'
  const userId = '1d1004ef-3cc7-47b3-942d-58c86f0a27c2'

  console.log(`🔧 Fixing workspace for ${email}...\n`)

  // Get her workspace membership
  const { data: memberships, error: memberError } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)

  if (memberError) {
    console.error('❌ Error fetching memberships:', memberError)
    return
  }

  if (!memberships || memberships.length === 0) {
    console.error('❌ No workspace memberships found')
    return
  }

  console.log(`Found ${memberships.length} membership(s)`)

  // Get True People Consulting workspace ID
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('name', 'True People Consulting')
    .single()

  if (!workspace) {
    console.error('❌ True People Consulting workspace not found')
    return
  }

  // Check if user is actually a member of this workspace
  const isMember = memberships.some(m => m.workspace_id === workspace.id)

  if (!isMember) {
    console.error(`❌ User is not a member of ${workspace.name}`)
    console.log('User workspaces:', memberships.map(m => m.workspace_id))
    return
  }

  console.log(`\n✅ Found workspace: ${workspace.name} (${workspace.id})`)

  // Update user's current_workspace_id
  const { error: updateError } = await supabase
    .from('users')
    .update({ current_workspace_id: workspace.id })
    .eq('id', userId)

  if (updateError) {
    console.error('❌ Error updating user:', updateError)
    return
  }

  console.log(`\n✅ Updated ${email}`)
  console.log(`   current_workspace_id set to: ${workspace.id}`)
  console.log(`   Workspace: ${workspace.name}`)
}

fixSamanthaWorkspace().catch(console.error)
