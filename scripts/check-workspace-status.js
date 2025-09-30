import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkStatus() {
  console.log('🔍 Checking Workspace Status\n')
  
  // Get all users
  const { data: users } = await supabase
    .from('users')
    .select('id, email')
  
  console.log(`Users found: ${users?.length || 0}`)
  
  // Get all workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, slug')
  
  console.log(`Workspaces found: ${workspaces?.length || 0}`)
  workspaces?.forEach(w => console.log(`  - ${w.name} (${w.slug})`))
  
  // Get all memberships
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('user_id, workspace_id, role')
  
  console.log(`\nWorkspace memberships: ${memberships?.length || 0}`)
  
  // Check users without memberships
  const usersWithoutMemberships = users?.filter(u => 
    !memberships?.some(m => m.user_id === u.id)
  )
  
  console.log(`\nUsers without any workspace membership: ${usersWithoutMemberships?.length || 0}`)
  if (usersWithoutMemberships?.length > 0) {
    usersWithoutMemberships.forEach(u => console.log(`  - ${u.email || u.id}`))
  }
  
  // Check workspace accounts table
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('provider', 'linkedin')
  
  console.log(`\nLinkedIn accounts in workspace_accounts: ${accounts?.length || 0}`)
}

checkStatus().then(() => console.log('\n✅ Check complete'))
