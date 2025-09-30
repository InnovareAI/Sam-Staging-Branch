import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ path: '.env.local' })

const { Client } = pg

async function addColumn() {
  console.log('🔧 Adding current_workspace_id column...\n')
  
  // Parse Supabase URL to get connection details
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  try {
    // Use Supabase client to execute raw SQL
    console.log('Step 1: Adding column and index...')
    
    // We'll do this through multiple small operations
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
    
    console.log(`Found ${users?.length || 0} users\n`)
    
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('user_id, workspace_id, created_at')
      .order('created_at', { ascending: true })
    
    console.log(`Found ${memberships?.length || 0} memberships\n`)
    
    // For each user, set their workspace
    console.log('Step 2: Setting current_workspace_id for users...\n')
    let updated = 0
    
    for (const user of users || []) {
      const userMembership = memberships?.find(m => m.user_id === user.id)
      if (userMembership) {
        const { error } = await supabase
          .from('users')
          .update({ current_workspace_id: userMembership.workspace_id })
          .eq('id', user.id)
        
        if (error) {
          console.log(`  ❌ Error for ${user.email}:`, error.message)
        } else {
          updated++
          console.log(`  ✅ Set workspace for ${user.email}`)
        }
      } else {
        console.log(`  ⚠️  No workspace membership for ${user.email}`)
      }
    }
    
    console.log(`\n✅ Updated ${updated} users`)
    
    // Verify
    const { data: check } = await supabase
      .from('users')
      .select('id, email, current_workspace_id')
    
    const withWorkspace = check?.filter(u => u.current_workspace_id).length || 0
    console.log(`\n📊 Verification:`)
    console.log(`  Users with workspace: ${withWorkspace}/${check?.length || 0}`)
    
  } catch (error) {
    console.error('\n❌ Failed:', error)
    process.exit(1)
  }
}

addColumn()
