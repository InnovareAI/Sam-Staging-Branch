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

async function investigateMissingUsers() {
  console.log('🔍 Investigating missing users...\n')
  
  try {
    // Get all user IDs from workspace_members
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('user_id')
    
    const uniqueUserIds = [...new Set(memberships?.map(m => m.user_id) || [])]
    console.log(`📊 Found ${uniqueUserIds.length} unique user IDs in workspace_members\n`)
    
    // Check which ones exist in users table
    const { data: usersTable } = await supabase
      .from('users')
      .select('id, email')
    
    console.log(`📊 Found ${usersTable?.length || 0} users in users table\n`)
    
    // Find missing users
    const existingIds = new Set(usersTable?.map(u => u.id) || [])
    const missingUserIds = uniqueUserIds.filter(id => !existingIds.has(id))
    
    console.log(`❌ Missing ${missingUserIds.length} users from users table:\n`)
    
    // Check if they exist in auth.users (Supabase Auth)
    console.log('🔐 Checking Supabase Auth for these users...\n')
    
    for (const userId of missingUserIds) {
      // Try to get user from auth
      const { data: authUser, error } = await supabase.auth.admin.getUserById(userId)
      
      if (authUser && authUser.user) {
        console.log(`✅ Found in auth.users:`)
        console.log(`   ID: ${authUser.user.id}`)
        console.log(`   Email: ${authUser.user.email}`)
        console.log(`   Created: ${new Date(authUser.user.created_at).toLocaleDateString()}`)
        console.log(`   ⚠️  BUT MISSING from users table!\n`)
      } else {
        console.log(`❌ NOT in auth.users: ${userId.substring(0, 8)}...`)
        if (error) {
          console.log(`   Error: ${error.message}\n`)
        }
      }
    }
    
    // Count memberships per missing user
    console.log('\n📊 Workspace memberships for missing users:\n')
    
    const { data: allMemberships } = await supabase
      .from('workspace_members')
      .select('user_id, workspace_id, role')
    
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id, name')
    
    for (const userId of missingUserIds) {
      const userMemberships = allMemberships?.filter(m => m.user_id === userId) || []
      console.log(`User ${userId.substring(0, 8)}...:`)
      console.log(`   Memberships: ${userMemberships.length}`)
      userMemberships.forEach(m => {
        const ws = workspaces?.find(w => w.id === m.workspace_id)
        console.log(`      - ${ws?.name || 'Unknown'} (${m.role})`)
      })
      console.log()
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

investigateMissingUsers()
