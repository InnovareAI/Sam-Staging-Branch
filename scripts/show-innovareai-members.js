import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function showMembers() {
  console.log('🔍 Showing actual InnovareAI Workspace members...\n')
  
  const innovareWorkspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  
  try {
    // Get memberships with user info
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('user_id, role, status, joined_at')
      .eq('workspace_id', innovareWorkspaceId)
    
    const { data: users } = await supabase
      .from('users')
      .select('id, email, current_workspace_id')
    
    console.log('=== InnovareAI Workspace Members ===\n')
    
    for (const membership of memberships || []) {
      const user = users?.find(u => u.id === membership.user_id)
      
      if (user) {
        console.log(`${user.email}`)
        console.log(`  Role: ${membership.role}`)
        console.log(`  Status: ${membership.status}`)
        console.log(`  current_workspace_id set: ${user.current_workspace_id === innovareWorkspaceId ? '✅ Correct' : `❌ Wrong (${user.current_workspace_id || 'NULL'})`}`)
        console.log(`  Joined: ${new Date(membership.joined_at).toLocaleString()}`)
      } else {
        console.log(`User ID: ${membership.user_id}`)
        console.log(`  ⚠️  User record not found!`)
        console.log(`  Role: ${membership.role}`)
      }
      console.log()
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

showMembers()
