import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkMembership() {
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b'
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'

  console.log('🔍 Checking workspace_members table directly...\n')

  // Query WITHOUT join
  const { data: memberships, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', userId)

  console.log('Query result:')
  console.log('  Error:', error)
  console.log('  Found:', memberships?.length || 0, 'membership(s)')

  if (memberships && memberships.length > 0) {
    console.log('\nMemberships found:')
    memberships.forEach(m => {
      console.log(`  - Workspace ID: ${m.workspace_id}`)
      console.log(`    Role: ${m.role}`)
      console.log(`    Created: ${m.created_at}`)
    })
  }

  // Check if the specific membership exists
  const { data: specificMembership } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .single()

  console.log('\nSpecific membership check (InnovareAI):')
  console.log('  Exists:', !!specificMembership)
  if (specificMembership) {
    console.log('  Role:', specificMembership.role)
    console.log('  Created:', specificMembership.created_at)
  }
}

checkMembership().catch(console.error)
