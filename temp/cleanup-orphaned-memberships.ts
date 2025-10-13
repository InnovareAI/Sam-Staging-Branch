import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function cleanupOrphanedMemberships() {
  console.log('🧹 Cleaning up orphaned workspace memberships...\n')

  // Get all workspace memberships
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('id, user_id, workspace_id, role')

  // Get all workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name')

  // Get all auth users
  const { data: authUsers } = await supabase.auth.admin.listUsers()

  const workspaceIds = new Set(workspaces?.map(w => w.id) || [])
  const userIds = new Set(authUsers.users.map(u => u.id))

  let deletedCount = 0

  console.log('📊 Found:')
  console.log(`   ${memberships?.length || 0} workspace memberships`)
  console.log(`   ${workspaces?.length || 0} workspaces`)
  console.log(`   ${authUsers.users.length} auth users\n`)

  // Delete memberships for non-existent workspaces
  const orphanedWorkspaces = memberships?.filter(m => !workspaceIds.has(m.workspace_id)) || []
  console.log(`🔍 Orphaned workspace memberships: ${orphanedWorkspaces.length}`)

  for (const membership of orphanedWorkspaces) {
    console.log(`   Deleting membership for workspace ${membership.workspace_id}...`)
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', membership.id)

    if (error) {
      console.error(`   ❌ Error: ${error.message}`)
    } else {
      console.log(`   ✅ Deleted`)
      deletedCount++
    }
  }

  // Delete memberships for non-existent users
  const orphanedUsers = memberships?.filter(m => !userIds.has(m.user_id)) || []
  console.log(`\n🔍 Invalid user memberships: ${orphanedUsers.length}`)

  for (const membership of orphanedUsers) {
    console.log(`   Deleting membership for user ${membership.user_id}...`)
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', membership.id)

    if (error) {
      console.error(`   ❌ Error: ${error.message}`)
    } else {
      console.log(`   ✅ Deleted`)
      deletedCount++
    }
  }

  console.log(`\n✅ Cleanup complete!`)
  console.log(`   Total memberships deleted: ${deletedCount}`)
}

cleanupOrphanedMemberships().catch(console.error)
