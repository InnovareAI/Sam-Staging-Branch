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

async function checkDetails() {
  console.log('🔍 Detailed membership check...\n')
  
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('id, user_id, workspace_id, role')
  
  console.log(`Total memberships: ${memberships?.length || 0}\n`)
  
  // Group by user_id
  const byUser = {}
  memberships?.forEach(m => {
    if (!byUser[m.user_id]) {
      byUser[m.user_id] = []
    }
    byUser[m.user_id].push(m)
  })
  
  console.log(`Unique users: ${Object.keys(byUser).length}\n`)
  
  Object.entries(byUser).forEach(([userId, userMemberships]) => {
    console.log(`User: ${userId}`)
    console.log(`  Memberships: ${userMemberships.length}`)
    userMemberships.forEach(m => {
      console.log(`    - ${m.workspace_id.substring(0, 8)}... (${m.role})`)
    })
  })
}

checkDetails()
