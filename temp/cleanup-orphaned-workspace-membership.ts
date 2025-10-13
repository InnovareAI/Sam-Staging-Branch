import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function cleanupOrphanedMembership() {
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b'
  const orphanedWorkspaceId = 'ffed2d0f-a5a7-4d46-b221-b673a412bf44'
  const email = 'tl@innovareai.com'

  console.log(`🗑️  Cleaning up orphaned workspace membership for ${email}...\n`)

  // Verify it's truly orphaned
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('id', orphanedWorkspaceId)
    .single()

  if (workspace) {
    console.log('⚠️  Warning: Workspace exists! Not orphaned.')
    console.log(`   Workspace: ${workspace.name}`)
    return
  }

  console.log('✅ Confirmed: Workspace does not exist in workspaces table\n')

  // Delete the orphaned membership
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('user_id', userId)
    .eq('workspace_id', orphanedWorkspaceId)

  if (error) {
    console.error('❌ Error deleting membership:', error)
    return
  }

  console.log('✅ Deleted orphaned workspace membership!')
  console.log(`   User: ${email}`)
  console.log(`   Orphaned workspace_id: ${orphanedWorkspaceId}`)
}

cleanupOrphanedMembership().catch(console.error)
