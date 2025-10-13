import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifyWorkspaceAssociations() {
  console.log('🔍 Checking user-workspace associations...\n')

  // Get all users
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers()

  if (usersError) {
    console.error('❌ Error fetching users:', usersError)
    return
  }

  console.log(`📊 Total users: ${users.users.length}\n`)

  // Get all workspace memberships
  const { data: memberships, error: membershipsError } = await supabase
    .from('workspace_members')
    .select('user_id, workspace_id, role, status')

  if (membershipsError) {
    console.error('❌ Error fetching memberships:', membershipsError)
    return
  }

  // Get all workspaces separately
  const { data: workspaces, error: workspacesError } = await supabase
    .from('workspaces')
    .select('id, name')

  const workspaceMap = new Map(workspaces?.map(w => [w.id, w.name]) || [])

  // Get users table data
  const { data: userProfiles, error: profilesError } = await supabase
    .from('users')
    .select('id, email, current_workspace_id')

  const profileMap = new Map(userProfiles?.map(p => [p.id, p]) || [])

  // Analyze each user
  const issues: any[] = []

  for (const user of users.users) {
    const userMemberships = memberships?.filter(m => m.user_id === user.id) || []
    const profile = profileMap.get(user.id)

    const status = {
      email: user.email,
      id: user.id,
      workspace_count: userMemberships.length,
      workspaces: userMemberships.map((m: any) => workspaceMap.get(m.workspace_id) || 'Unknown'),
      current_workspace_id: profile?.current_workspace_id || null,
      has_profile: !!profile
    }

    // Check for issues
    if (userMemberships.length === 0) {
      issues.push({ ...status, issue: 'NO_WORKSPACE' })
    } else if (!profile?.current_workspace_id) {
      issues.push({ ...status, issue: 'NO_CURRENT_WORKSPACE' })
    } else if (!userMemberships.find(m => m.workspace_id === profile.current_workspace_id)) {
      issues.push({ ...status, issue: 'INVALID_CURRENT_WORKSPACE' })
    }

    // Log users with multiple workspaces
    if (userMemberships.length > 1) {
      console.log(`👥 ${user.email}: ${userMemberships.length} workspaces - ${status.workspaces.join(', ')}`)
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('📊 SUMMARY')
  console.log('='.repeat(80))
  console.log(`✅ Users with workspace access: ${users.users.length - issues.filter(i => i.issue === 'NO_WORKSPACE').length}`)
  console.log(`❌ Users without workspace: ${issues.filter(i => i.issue === 'NO_WORKSPACE').length}`)
  console.log(`⚠️  Users without current_workspace_id: ${issues.filter(i => i.issue === 'NO_CURRENT_WORKSPACE').length}`)
  console.log(`🔴 Users with invalid current_workspace: ${issues.filter(i => i.issue === 'INVALID_CURRENT_WORKSPACE').length}`)

  if (issues.length > 0) {
    console.log('\n' + '='.repeat(80))
    console.log('⚠️  ISSUES FOUND')
    console.log('='.repeat(80))
    issues.forEach(issue => {
      console.log(`\n${issue.issue}: ${issue.email}`)
      console.log(`  ID: ${issue.id}`)
      console.log(`  Workspaces: ${issue.workspaces.join(', ') || 'None'}`)
      console.log(`  Current workspace: ${issue.current_workspace_id || 'Not set'}`)
    })
  }
}

verifyWorkspaceAssociations().catch(console.error)
