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

async function fixWorkspace() {
  console.log('🔧 Fixing current_workspace_id for all users...\n')
  
  try {
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
    
    if (usersError) throw usersError
    console.log(`Found ${users.length} users\n`)
    
    // Get all memberships  
    const { data: memberships, error: membError } = await supabase
      .from('workspace_members')
      .select('user_id, workspace_id, workspace:workspaces(name)')
      .order('joined_at', { ascending: true })
    
    if (membError) throw membError
    console.log(`Found ${memberships.length} workspace memberships\n`)
    
    // Update each user
    let updated = 0
    let skipped = 0
    
    for (const user of users) {
      const userMembership = memberships.find(m => m.user_id === user.id)
      
      if (userMembership) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ current_workspace_id: userMembership.workspace_id })
          .eq('id', user.id)
        
        if (updateError) {
          console.log(`  ❌ ${user.email}: ${updateError.message}`)
        } else {
          updated++
          const workspaceName = userMembership.workspace?.name || 'Unknown'
          console.log(`  ✅ ${user.email} → ${workspaceName}`)
        }
      } else {
        skipped++
        console.log(`  ⚠️  ${user.email} (no workspace membership)`)
      }
    }
    
    console.log(`\n📊 Results:`)
    console.log(`  Updated: ${updated}`)
    console.log(`  Skipped: ${skipped}`)
    
    // Verify
    const { data: verification } = await supabase
      .from('users')
      .select('id, email, current_workspace_id')
    
    const withWorkspace = verification?.filter(u => u.current_workspace_id).length || 0
    console.log(`\n✅ Final: ${withWorkspace}/${verification?.length || 0} users have current_workspace_id`)
    
  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  }
}

fixWorkspace()
