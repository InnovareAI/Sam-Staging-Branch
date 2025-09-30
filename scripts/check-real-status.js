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

async function checkReal() {
  console.log('🔍 Checking ACTUAL database state...\n')
  
  try {
    // Get ALL users with workspace info
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, email, current_workspace_id')
    
    console.log('=== ALL USERS ===')
    allUsers?.forEach(u => {
      console.log(`${u.email}`)
      console.log(`  ID: ${u.id}`)
      console.log(`  current_workspace_id: ${u.current_workspace_id || 'NULL'}`)
    })
    
    // Get ALL workspace memberships
    const { data: allMemberships } = await supabase
      .from('workspace_members')
      .select('user_id, workspace_id, role, status')
    
    console.log('\n=== ALL WORKSPACE MEMBERSHIPS ===')
    console.log(`Total: ${allMemberships?.length || 0}`)
    
    // Get ALL workspaces
    const { data: allWorkspaces } = await supabase
      .from('workspaces')
      .select('id, name, slug')
    
    console.log('\n=== ALL WORKSPACES ===')
    allWorkspaces?.forEach(w => {
      const memberCount = allMemberships?.filter(m => m.workspace_id === w.id).length || 0
      console.log(`${w.name} (${w.slug})`)
      console.log(`  ID: ${w.id}`)
      console.log(`  Members: ${memberCount}`)
    })
    
    // Check specific user memberships
    if (allUsers?.length > 0) {
      const user = allUsers[0]
      const userMemberships = allMemberships?.filter(m => m.user_id === user.id) || []
      
      console.log(`\n=== ${user.email} MEMBERSHIPS ===`)
      if (userMemberships.length === 0) {
        console.log('❌ NO MEMBERSHIPS FOUND!')
      } else {
        userMemberships.forEach(m => {
          const ws = allWorkspaces?.find(w => w.id === m.workspace_id)
          console.log(`${ws?.name || 'Unknown'}`)
          console.log(`  Role: ${m.role}`)
          console.log(`  Status: ${m.status}`)
        })
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkReal()
