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

async function checkInnovareAIUsers() {
  console.log('🔍 Checking all InnovareAI workspace members...\n')
  
  const innovareAIEmails = [
    'tl@innovareai.com',
    'cs@innovareai.com', 
    'cl@innovareai.com',
    'mg@innovareai.com'
  ]
  
  const innovareWorkspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  
  try {
    // Get all users
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, email, current_workspace_id')
    
    // Get all memberships for InnovareAI workspace
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('user_id, role, status')
      .eq('workspace_id', innovareWorkspaceId)
    
    console.log('=== InnovareAI Workspace Members ===\n')
    
    let needsUpdate = []
    
    for (const email of innovareAIEmails) {
      const user = allUsers?.find(u => u.email === email)
      
      if (!user) {
        console.log(`❌ ${email}: USER NOT FOUND IN DATABASE`)
        continue
      }
      
      const membership = memberships?.find(m => m.user_id === user.id)
      
      console.log(`${email}:`)
      console.log(`  User exists: ✅`)
      console.log(`  Has membership: ${membership ? '✅' : '❌'}`)
      if (membership) {
        console.log(`  Role: ${membership.role}`)
        console.log(`  Status: ${membership.status}`)
      }
      console.log(`  current_workspace_id set: ${user.current_workspace_id ? '✅' : '❌'}`)
      console.log(`  Points to InnovareAI: ${user.current_workspace_id === innovareWorkspaceId ? '✅' : '❌'}`)
      
      if (user.current_workspace_id !== innovareWorkspaceId && membership) {
        needsUpdate.push({ email, userId: user.id, currentWorkspace: user.current_workspace_id })
      }
      
      console.log()
    }
    
    if (needsUpdate.length > 0) {
      console.log('\n⚠️  Users needing workspace update:')
      needsUpdate.forEach(u => {
        console.log(`  - ${u.email} (currently: ${u.currentWorkspace || 'NULL'})`)
      })
      console.log('\nWould you like to update these users to InnovareAI Workspace?')
    } else {
      console.log('✅ All InnovareAI users are properly configured!')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkInnovareAIUsers()
