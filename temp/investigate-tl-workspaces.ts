import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function investigateTLWorkspaces() {
  const email = 'tl@innovareai.com'

  console.log(`🔍 Investigating workspaces for ${email}...\n`)

  // Get user ID
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const user = authUsers.users.find(u => u.email === email)

  if (!user) {
    console.error('❌ User not found')
    return
  }

  console.log(`User ID: ${user.id}\n`)

  // Get workspace memberships
  const { data: memberships, error: memberError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, status, joined_at')
    .eq('user_id', user.id)

  if (memberError) {
    console.error('❌ Error fetching memberships:', memberError)
    return
  }

  console.log(`Found ${memberships?.length || 0} workspace memberships:\n`)

  // Get all workspaces
  const { data: allWorkspaces } = await supabase
    .from('workspaces')
    .select('id, name, tenant, created_at')

  const workspaceMap = new Map(allWorkspaces?.map(w => [w.id, w]) || [])

  memberships?.forEach(m => {
    const workspace = workspaceMap.get(m.workspace_id)

    console.log('─'.repeat(80))
    console.log(`Workspace ID: ${m.workspace_id}`)

    if (workspace) {
      console.log(`✅ Name: ${workspace.name}`)
      console.log(`   Tenant: ${workspace.tenant || 'N/A'}`)
      console.log(`   Created: ${workspace.created_at}`)
    } else {
      console.log(`❌ ORPHANED - No workspace record found`)
      console.log(`   This workspace_id exists in workspace_members but not in workspaces table`)
    }

    console.log(`   Your role: ${m.role}`)
    console.log(`   Status: ${m.status}`)
    console.log(`   Joined: ${m.joined_at}`)
  })

  console.log('\n' + '='.repeat(80))

  // Check user profile
  const { data: profile } = await supabase
    .from('users')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single()

  console.log(`\nCurrent workspace: ${profile?.current_workspace_id || 'Not set'}`)

  if (profile?.current_workspace_id) {
    const currentWorkspace = workspaceMap.get(profile.current_workspace_id)
    if (currentWorkspace) {
      console.log(`Current workspace name: ${currentWorkspace.name}`)
    } else {
      console.log(`❌ Current workspace ID is orphaned (not found in workspaces table)`)
    }
  }
}

investigateTLWorkspaces().catch(console.error)
