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

async function fix() {
  console.log('🔧 Setting current_workspace_id for all users...\n')
  
  try {
    const { data: users } = await supabase.from('users').select('id, email')
    const { data: memberships } = await supabase.from('workspace_members').select('user_id, workspace_id')
    const { data: workspaces } = await supabase.from('workspaces').select('id, name')
    
    console.log(`Users: ${users.length}`)
    console.log(`Memberships: ${memberships.length}`)
    console.log(`Workspaces: ${workspaces.length}\n`)
    
    let updated = 0
    for (const user of users) {
      const membership = memberships.find(m => m.user_id === user.id)
      if (membership) {
        const workspace = workspaces.find(w => w.id === membership.workspace_id)
        const { error } = await supabase
          .from('users')
          .update({ current_workspace_id: membership.workspace_id })
          .eq('id', user.id)
        
        if (!error) {
          updated++
          console.log(`✅ ${user.email} → ${workspace?.name || membership.workspace_id}`)
        } else {
          console.log(`❌ ${user.email}: ${error.message}`)
        }
      } else {
        console.log(`⚠️  ${user.email}: No membership found`)
      }
    }
    
    console.log(`\n✅ Updated ${updated}/${users.length} users`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

fix()
