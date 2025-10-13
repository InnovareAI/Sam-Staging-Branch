import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function fixTLWorkspaceMembership() {
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b'
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  const email = 'tl@innovareai.com'

  console.log(`🔧 Fixing workspace membership for ${email}...\n`)

  // 1. Verify the workspace exists
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('id, name, tenant')
    .eq('id', workspaceId)
    .single()

  if (wsError || !workspace) {
    console.error('❌ Workspace not found:', wsError?.message)
    return
  }

  console.log(`✅ Workspace exists: ${workspace.name}`)
  console.log(`   ID: ${workspace.id}`)
  console.log(`   Tenant: ${workspace.tenant || 'N/A'}\n`)

  // 2. Check if membership already exists (shouldn't, but verify)
  const { data: existingMembership } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .single()

  if (existingMembership) {
    console.log('✅ Membership already exists!')
    console.log(JSON.stringify(existingMembership, null, 2))
    return
  }

  console.log('⚠️  No membership found - creating new membership entry...\n')

  // 3. Create workspace membership as OWNER
  const { data: newMembership, error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      role: 'owner',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (memberError) {
    console.error('❌ Error creating membership:', memberError)
    return
  }

  console.log('✅ Created workspace membership!')
  console.log(JSON.stringify(newMembership, null, 2))

  console.log('\n✅ Fix complete!')
  console.log(`   ${email} is now OWNER of ${workspace.name}`)
}

fixTLWorkspaceMembership().catch(console.error)
